import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { LoggerService } from 'src/shared/logger/logger.service';

interface ConfigCache {
  value: number;
  lastModified: number;
}

@Injectable()
export class WoaConfigService {
  private readonly configFilePath = process.env.WOA_CONFIG_FILE_PATH;
  private cache: ConfigCache | null = null;
  private readonly defaultThreshold = 18000;
  private readonly cacheCheckInterval = 10000; // Verificar cada 10 segundos
  private lastCacheCheck = 0;

  constructor(private readonly logger: LoggerService) {}

  /**
   * Obtiene el umbral de volumen de línea desde el archivo externo
   * El valor se cachea y se actualiza automáticamente si el archivo cambia
   * @returns Valor del umbral (por defecto: 18000)
   */
  getVolumenLineaThreshold(): number {
    const now = Date.now();
    
    // Verificar si necesitamos actualizar el cache
    if (this.shouldRefreshCache(now)) {
      this.refreshCache();
      this.lastCacheCheck = now;
    }

    return this.cache?.value ?? this.defaultThreshold;
  }

  /**
   * Determina si el cache debe ser refrescado
   */
  private shouldRefreshCache(now: number): boolean {
    // Si no hay cache, necesitamos leerlo
    if (!this.cache) {
      return true;
    }

    // Si pasó el intervalo de verificación, revisar el archivo
    if (now - this.lastCacheCheck > this.cacheCheckInterval) {
      try {
        const stats = fs.statSync(this.configFilePath);
        // Si el archivo fue modificado después del último cache, refrescar
        return stats.mtimeMs > this.cache.lastModified;
      } catch (error) {
        // Si no se puede leer el archivo, mantener el cache actual
        this.logger.logError(`Error al verificar archivo de configuración: ${error.message}`, error.stack);
        return false;
      }
    }

    return false;
  }

  /**
   * Refresca el cache leyendo el archivo de configuración
   */
  private refreshCache(): void {
    try {
      if (!fs.existsSync(this.configFilePath)) {
        this.logger.logError(`Archivo de configuración no encontrado: ${this.configFilePath}. Usando valor por defecto: ${this.defaultThreshold}`);
        this.cache = {
          value: this.defaultThreshold,
          lastModified: Date.now(),
        };
        return;
      }

      const stats = fs.statSync(this.configFilePath);
      const content = fs.readFileSync(this.configFilePath, 'utf-8').trim();
      
      // Buscar la línea con VOLUMEN_LINEA_THRESHOLD
      const lines = content.split('\n');
      let threshold = this.defaultThreshold;

      for (const line of lines) {
        const trimmedLine = line.trim();
        // Buscar formato: VOLUMEN_LINEA_THRESHOLD=18000 o VOLUMEN_LINEA_THRESHOLD:18000
        if (trimmedLine.startsWith('VOLUMEN_LINEA_THRESHOLD')) {
          const match = trimmedLine.match(/VOLUMEN_LINEA_THRESHOLD[=:]\s*(\d+)/);
          if (match && match[1]) {
            threshold = parseInt(match[1], 10);
            break;
          }
        }
      }

      // Si no se encontró en el archivo, usar el valor por defecto
      if (threshold === this.defaultThreshold && !content.includes('VOLUMEN_LINEA_THRESHOLD')) {
        this.logger.logError(`VOLUMEN_LINEA_THRESHOLD no encontrado en ${this.configFilePath}. Usando valor por defecto: ${this.defaultThreshold}`);
      }

      this.cache = {
        value: threshold,
        lastModified: stats.mtimeMs,
      };

      this.logger.logError(`Configuración actualizada desde archivo externo. VOLUMEN_LINEA_THRESHOLD = ${threshold}`);
    } catch (error) {
      this.logger.logError(`Error al leer archivo de configuración: ${error.message}`, error.stack);
      // Mantener el cache anterior o usar el valor por defecto
      if (!this.cache) {
        this.cache = {
          value: this.defaultThreshold,
          lastModified: Date.now(),
        };
      }
    }
  }

  /**
   * Fuerza la actualización del cache (útil para testing o actualizaciones manuales)
   */
  forceRefresh(): void {
    this.cache = null;
    this.lastCacheCheck = 0;
    this.refreshCache();
  }
}

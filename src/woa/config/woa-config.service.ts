import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/shared/logger/logger.service';
import { SystemParameterService } from 'src/shared/service/system-parameter.service';

interface ConfigCache {
  volumenLineaThreshold: number;
  obLpnTypes: string[];
  customerExceptions: string[],
  lastModified: number;
}

@Injectable()
export class WoaConfigService {
  private readonly interfaceName = 'WOA';
  private cache: ConfigCache | null = null;
  private readonly defaultThreshold = 18000;
  private readonly defaultObLpnTypes = ['06', '07'];
  private readonly defaultCustomerExceptions = [];
  private readonly cacheCheckInterval = 5000; // Verificar cada 5 segundos
  private lastCacheCheck = 0;

  constructor(
    private readonly logger: LoggerService,
    private readonly systemParameterService: SystemParameterService
  ) {}

  /**
   * Obtiene el umbral de volumen de línea desde la tabla de parámetros del sistema
   * El valor se cachea y se actualiza automáticamente si cambia en la BD
   * @returns Valor del umbral (por defecto: 18000)
   */
  async getVolumenLineaThreshold(): Promise<number> {
    await this.refreshCacheIfNeeded();
    return this.cache?.volumenLineaThreshold ?? this.defaultThreshold;
  }

  /**
   * Obtiene los tipos de ob_lpn_type desde la tabla de parámetros del sistema
   * Los valores se cachean y se actualizan automáticamente si cambian en la BD
   * @returns Array de tipos de ob_lpn_type (por defecto: ['06', '07'])
   */
  async getObLpnTypes(): Promise<string[]> {
    await this.refreshCacheIfNeeded();
    return this.cache?.obLpnTypes ?? this.defaultObLpnTypes;
  }

  /**
   * Verifica si un ob_lpn_type está en la lista configurada
   * @param obLpnType Tipo a verificar
   * @returns true si está en la lista configurada
   */
  async isObLpnTypeConfigured(obLpnType: string): Promise<boolean> {
    const configuredTypes = await this.getObLpnTypes();
    return configuredTypes.includes(obLpnType);
  }

    /**
   * Obtiene los códigos de clientes desde la tabla de parámetros del sistema
   * Los valores se cachean y se actualizan automáticamente si cambian en la BD
   * @returns Array de clientes de cust_nbr (por defecto: ['C002258','C000706','C012219'])
   */
  async getCustomerExceptions(): Promise<string[]> {
    await this.refreshCacheIfNeeded();
    return this.cache?.customerExceptions ?? this.defaultCustomerExceptions;
  }

  /**
   * Verifica si un customer_nbr está en la lista configurada
   * @param customer_nbr Código de cliente a verificar
   * @returns true si está en la lista configurada
   */
  async isCustomerExceptionConfigured(customer_nbr: string): Promise<boolean> {
    const customerExceptions = await this.getCustomerExceptions();
    return customerExceptions.includes(customer_nbr);
  }

  /**
   * Determina si el cache debe ser refrescado
   */
  private async shouldRefreshCache(now: number): Promise<boolean> {
    // Si no hay cache, necesitamos leerlo
    if (!this.cache) {
      return true;
    }

    // Si pasó el intervalo de verificación, revisar la base de datos
    if (now - this.lastCacheCheck > this.cacheCheckInterval) {
      try {
        const lastModified = await this.systemParameterService.getLastModifiedDate(this.interfaceName);
        if (lastModified && lastModified > this.cache.lastModified) {
          return true;
        }
      } catch (error) {
        // Si no se puede leer de la BD, mantener el cache actual
        this.logger.logError(`Error al verificar parámetros en BD: ${error.message}`, error.stack);
        return false;
      }
    }

    return false;
  }

  /**
   * Refresca el cache si es necesario
   */
  private async refreshCacheIfNeeded(): Promise<void> {
    const now = Date.now();
    if (await this.shouldRefreshCache(now)) {
      await this.refreshCache();
      this.lastCacheCheck = now;
    }
  }

  /**
   * Refresca el cache leyendo desde la tabla de parámetros del sistema
   */
  private async refreshCache(): Promise<void> {
    try {
      // Obtener todos los parámetros de la interfaz WOA
      const parameters = await this.systemParameterService.getParametersByInterface(this.interfaceName);
      
      // Valores por defecto
      let threshold = this.defaultThreshold;
      let obLpnTypes = [...this.defaultObLpnTypes];
      let customerExceptions = [];

      // Leer VOLUMEN_LINEA_THRESHOLD
      const thresholdValue = parameters.get('VOLUMEN_LINEA_THRESHOLD');
      if (thresholdValue) {
        const parsedThreshold = parseInt(thresholdValue, 10);
        if (!isNaN(parsedThreshold)) {
          threshold = parsedThreshold;
        } else {
          this.logger.logError(`VOLUMEN_LINEA_THRESHOLD tiene un valor inválido: ${thresholdValue}. Usando valor por defecto: ${this.defaultThreshold}`);
        }
      } else {
        this.logger.logError(`VOLUMEN_LINEA_THRESHOLD no encontrado en BD para interfaz ${this.interfaceName}. Usando valor por defecto: ${this.defaultThreshold}`);
      }

      // Leer OBLPN_TYPES
      const obLpnTypesValue = parameters.get('OBLPN_TYPES');
      if (obLpnTypesValue) {
        // Separar por comas y limpiar espacios
        const parsedTypes = obLpnTypesValue
          .split(',')
          .map(type => type.trim())
          .filter(type => type.length > 0);
        
        if (parsedTypes.length > 0) {
          obLpnTypes = parsedTypes;
        } else {
          this.logger.logError(`OBLPN_TYPES tiene un valor inválido: ${obLpnTypesValue}. Usando valores por defecto: ${this.defaultObLpnTypes.join(',')}`);
        }
      } else {
        this.logger.logError(`OBLPN_TYPES no encontrado en BD para interfaz ${this.interfaceName}. Usando valores por defecto: ${this.defaultObLpnTypes.join(',')}`);
      }

      // Leer CUSTOMER_EXCEPTIONS
      const customerExceptionsValue = parameters.get('CUSTOMER_EXCEPTIONS');
      if (customerExceptionsValue) {
        // Separar por comas y limpiar espacios
        const parsedCustomers = customerExceptionsValue
          .split(',')
          .map(type => type.trim())
          .filter(type => type.length > 0);
        
        if (parsedCustomers.length > 0) {
          customerExceptions = parsedCustomers;
        } else {
          this.logger.logError(`CUSTOMER_EXCEPTIONS tiene un valor inválido: ${customerExceptionsValue}. Usando valores por defecto: ${this.defaultCustomerExceptions.join(',')}`);
        }
      } else {
        this.logger.logError(`CUSTOMER_EXCEPTIONS no encontrado en BD para interfaz ${this.interfaceName}. Usando valores por defecto: ${this.defaultCustomerExceptions.join(',')}`);
      }

      // Obtener la fecha de última modificación
      const lastModified = await this.systemParameterService.getLastModifiedDate(this.interfaceName);

      this.cache = {
        volumenLineaThreshold: threshold,
        obLpnTypes: obLpnTypes,
        customerExceptions: customerExceptions,
        lastModified: lastModified ?? Date.now(),
      };

      this.logger.logError(`Configuración actualizada desde BD. VOLUMEN_LINEA_THRESHOLD = ${threshold}, OBLPN_TYPES = ${obLpnTypes.join(',')}`);
    } catch (error) {
      this.logger.logError(`Error al leer parámetros de BD: ${error.message}`, error.stack);
      // Mantener el cache anterior o usar los valores por defecto
      if (!this.cache) {
        this.cache = {
          volumenLineaThreshold: this.defaultThreshold,
          obLpnTypes: [...this.defaultObLpnTypes],
          customerExceptions: this.defaultCustomerExceptions,
          lastModified: Date.now(),
        };
      }
    }
  }

  /**
   * Fuerza la actualización del cache (útil para testing o actualizaciones manuales)
   */
  async forceRefresh(): Promise<void> {
    this.cache = null;
    this.lastCacheCheck = 0;
    await this.refreshCache();
  }
}

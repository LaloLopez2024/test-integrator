import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import SftpClient from 'ssh2-sftp-client';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class SftpPrintService implements OnModuleInit, OnModuleDestroy {
  private client: SftpClient;
  
  constructor(private readonly logger: LoggerService) {
    this.client = new SftpClient();
  }

  async onModuleInit() {
    this.logger.logError("Inicio de SftpPrintService");

    await this.connectToSftp();
  }

  async onModuleDestroy() {
    await this.disconnectFromSftp();
  }

  private async connectToSftp() {
    try {
      await this.client.connect({
        host: process.env.SFTP_PRINT_SERVER,
        port: process.env.SFTP_PRINT_PORT,
        username:  process.env.SFTP_PRINT_USER,
        password: process.env.SFTP_PRINT_PASSWORD,
      });

      this.logger.logError('Conexión SFTP Print establecida');
    } catch (error) {
      this.logger.logError(`Error al conectar al servidor SFTP Print: ${error.message}`, error.stack);
    }
  }

  private async disconnectFromSftp() {
    try {
       if (this.client) {
        await this.client.end();
        this.logger.logError('Conexión SFTP Print cerrada');
      }
    } catch (error) {
      this.logger.logError(`Error al cerrar la conexión SFTP Print ${error.message}`, error.stack);
    }
  }

  private async ensureConnection(): Promise<void> {
    try {
      // ssh2-sftp-client no expone método isConnected, pero podemos validar sftp property
      if (!this.client.sftp) {
        this.logger.logError('Cliente SFTP no está conectado. Reintentando conexión...');
        await this.connectToSftp();
      }
    } catch (error) {
      this.logger.logError('Error al verificar la conexión SFTP:', error.stack);
      await this.connectToSftp(); // reconectar ante cualquier duda
    }
  }

  async uploadFile(remotePath: string, localPath: string): Promise<string> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        await this.ensureConnection();

        this.logger.logError(`Intentando subir archivo (intento ${attempt + 1}): ${localPath} -> ${remotePath}`);
        await this.client.put(localPath, remotePath);

        this.logger.logError(`Archivo subido exitosamente al SFTP: ${remotePath}`);
        return 'Archivo subido exitosamente al SFTP Print.';
      } catch (error) {
        attempt++;
        this.logger.logError(`
           (intento ${attempt}): ${error.message}`, error.stack);

        if (attempt >= maxRetries) {
          throw new Error(`Fallo permanente al subir el archivo al SFTP después de ${maxRetries} intentos`);
        }

        // Backoff progresivo antes de reintentar
        await new Promise((res) => setTimeout(res, 1000 * attempt));
        await this.connectToSftp(); // reconecta antes de reintentar
      }
    }

    return 'Error desconocido al subir archivo al SFTP Print.';
  }
}
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import * as net from 'net';
import { LoggerService } from '../logger/logger.service';
import * as iconv from 'iconv-lite';
import { TraceService } from 'src/trace/trace.service';
import * as fs from 'fs';
import portfinder from 'portfinder';
import { resolve } from 'path';

@Injectable()
export class TcpService implements OnModuleInit, OnModuleDestroy  {
  private readonly host: string = process.env.TCP_HOST;
  private readonly port: number = +process.env.KISOFT_IN_PORT;
  private client: net.Socket;
  private readonly timeoutRead: number = 3000;
  private isConnected = false;
  private sendQueue: { id: number; trama: string; resolve: (response: string) => void; reject: (error: any) => void }[] = [];
  private pendingResponses: Map<number, (response: string) => void> = new Map();
  private currentSending: { id: number; trama: string } | null = null;
  private initializingSocket = false;
  private processing = false;
  private processInterval: NodeJS.Timeout = null;
  private heartbeatInterval: NodeJS.Timeout = null;
  private lastHeartbeatTimestamp = 0;
  private readonly heartbeatMessage = '000081HR';
  private heartbeatDisconect: NodeJS.Timeout = null;
  private lastHeartbeatDisconect = 0;
  private reintentosHeartbeatDisconect = 0;
  private disconectReceived = 0;
  private disconectfromServer = 0;
  private reintentosHearbeatSinRespuesta = 0;
  private reintentosEnvioSinRespuesta = 0;
  private reconectando = false;
  private conectadoTimestamp = 0;
  private validandoConexion = false;
  private readonly PORT_FILE = './local-port.txt';
  private localPort: number;
  localPortToReuse: number | null = null;
  private connectionId = 0;

  constructor(private readonly logger: LoggerService,
              private readonly traceService: TraceService
  ) {};

  async onModuleInit() {
    this.logError(`*** onModuleInit ***`);
    this.localPort = await this.loadOrAssignLocalPort();
    this.initSocket();
  }

  onModuleDestroy() {
    this.logError('*** onModuleDestroy ****');
    this.cleanupSocket();
  }

  private async loadOrAssignLocalPort(): Promise<number> {
    if (fs.existsSync(this.PORT_FILE)) {
      const savedPort = parseInt(fs.readFileSync(this.PORT_FILE, 'utf8'), 10);
      if (!isNaN(savedPort)) return savedPort;
    }
  
    try {
      const port = await portfinder.getPortPromise();
      fs.writeFileSync(this.PORT_FILE, port.toString());
      return port;
    } catch (err) {
      this.logError(`Error asignando puerto local: ${err.message}`);
      throw err;
    }
  }

  private initSocket() {
    this.reconectando = false;
    this.validandoConexion = false;

    if (this.client && !this.client.destroyed) {
      this.logError('initSocket - Socket ya existente, no se recrea');
      this.reintentosEnvioSinRespuesta = 0;
      return;
    }

    this.connectionId += 1;
    this.client = new net.Socket();
    this.client.setKeepAlive(true, 10000);
    this.initializingSocket = true;

    const options: net.NetConnectOpts = {
      host: this.host,
      port: this.port, // puerto del servidor remoto
      ...(this.localPortToReuse ? { localPort: this.localPortToReuse } : {}),
    };

    this.client.connect(options, () => {
      this.logError(`Connected to TCP server at ${this.host}:${this.port} localPort ${this.client.localPort}`);

      if (!this.localPortToReuse) {
        this.localPortToReuse = this.client.localPort;
        console.log(`Puerto local usado por primera vez: ${this.localPortToReuse}`);
      } else {
        console.log(`Reconectado usando el puerto local: ${this.localPortToReuse}`);
      }

      this.conectadoTimestamp = Date.now();
      this.initConnect();
    });

    this.client.on('data', async (data) => {
      try {
        this.reintentosHearbeatSinRespuesta = 0;
        const received = data.toString().trim();
        this.logError(`Received data: ${received}`);
        await this.processesReceivedData(received);
      } catch (error) {
        this.logError(`Error en datos recibidos: ${error.message}`, error.stack);
      } 
    });

    this.client.on('error', (err) => {
      this.logError(`Connection error: ${err.message}`, err.stack);
      this.isConnected = false;
      
      this.reconnect();
    });

    this.client.on('close', () => {
      this.logError(`*****CONNECTION CLOSE*****`);
      this.validConnection();
    });

    this.client.on('end', () => {
      this.logError(`*****CONNECTION CLOSE FROM SERVER*****`);
      this.validConnection();
    });

    this.client.setTimeout(0);
  }

  private async checkPortAvailability(port: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const tester = net.createServer().listen(port, this.port);
      
      tester.on('listening', () => {
        tester.close(() => resolve(true));  // Si se puede abrir el puerto, está disponible
      });

      tester.on('error', (err) => {
        if (err) {
          // Aquí puedes acceder a `err.code` de forma segura
          this.logError(`Connection error: ${err.message}`);
        } else {
          // Si no existe el código, solo muestra el mensaje
          this.logError(`Connection error: ${err.message}`);
        }
      });
    });
  }

  validConnection() {
    if(this.validandoConexion) {
      return;
    }     
    
    this.validandoConexion = true;

    const now = Date.now();
    const timeActual = now - this.conectadoTimestamp;

    this.logError(`close - now = ${now}`);
    this.logError(`close - timeActual = ${timeActual}`);
    
    if(timeActual >= 100000) {
      this.isConnected = false;
      this.reconnect();
    }
  }

  async initConnect() {
    try {
      if (this.processInterval) {
        clearInterval(this.processInterval);
      }

      this.isConnected = true;
      this.startProcess();

    } finally {
      this.initializingSocket = false;
    }
  }

  async processesReceivedData(received: string) {
    try {
      this.reintentosHearbeatSinRespuesta = 0;
      this.reintentosEnvioSinRespuesta = 0;
      this.reintentosHeartbeatDisconect = 0;
      this.disconectfromServer = 0;
      this.disconectReceived = 0;
      this.isConnected = true;
      
      if(received == '000102HR00') {
        this.logError(`Se recibió un hearbeat`);
      }
      else {
        this.logError(`Received data - currentSending = `, JSON.stringify(this.currentSending, null, 2));
        this.logError(`Received data - pendingResponses = `, JSON.stringify(this.pendingResponses, null, 2));
  
        if (this.currentSending) {
          const { id } = this.currentSending;
    
          // Procesar la respuesta
          const resolve = this.pendingResponses.get(id);
          if (resolve) {
            resolve(received);
            this.pendingResponses.delete(id);
          }
    
          await this.traceService.update(id, received);
          this.currentSending = null;
        }
        else {
          this.logError(`No se esperaba la respuesta ${received}`);
        }
      }    
    } catch (error) {
      this.logError(`Error enviando trama: ${error.message}`, error.stack);
    }   
  }

  private reconnect() {
    if(this.reconectando) {
      return;
    }
    this.reconectando = true;
    this.reintentosHearbeatSinRespuesta = 0;
    this.reintentosHeartbeatDisconect = 0;
    this.disconectfromServer = 0;
    this.disconectReceived = 0;
    this.reintentosEnvioSinRespuesta = 0;

    this.cleanupSocket();

    this.logError('***RECONECTANDOSE***');
    setTimeout(() => this.initSocket(), 3000);
  }

  async sendMessage(id: number, trama: string, interfaceName: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      this.logError(`sendMessage - interface = ${interfaceName} - nueva trama = ${trama}`);
      this.sendQueue.push({ id, trama, resolve, reject });      
    });
  }

  private startProcess() {
    this.processInterval = setInterval(async () => {
      if(this.sendQueue.length > 0) {
        await this.processQueue();
      }
    }, 1000);
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    this.logError(`processQueue - isConnected = ${this.isConnected}`);
    this.logError(`processQueue - currentSending = `, JSON.stringify(this.currentSending, null, 2));
    this.logError(`processQueue - sendQueue.length = ${this.sendQueue.length}`);

    try {
      const workData = this.isConnected && 
                      !this.currentSending && 
                      this.sendQueue.length > 0;

      if(workData) {
        this.logError(`processQueue - se inicia el recorrido de tramas a enviar, tramas = `, JSON.stringify(this.sendQueue, null, 2));

        const item = this.sendQueue[0];
        this.logError(`processQueue - se enviará la trama`, JSON.stringify(item, null, 2));
        await this.processMessage(item);
      }
      else {
        this.logError(`processQueue - DESCONEXIÓN - aún no se envían tramas = `, JSON.stringify(this.sendQueue, null, 2));
        this.reintentosEnvioSinRespuesta = this.reintentosEnvioSinRespuesta + 1;

        this.logError(`processQueue - reintentosEnvioSinRespuesta = ${this.reintentosEnvioSinRespuesta}`);
        if(this.reintentosEnvioSinRespuesta >= 5) {
          this.logError(`processQueue - RECONEXIÓN = ${this.reintentosEnvioSinRespuesta}`);
          this.reconnect();
        }
      }

    } catch (error) {
      this.logError(`Error enviando trama: ${error.message}`, error.stack);
    } finally {
      this.processing = false;
    }
  }

  private async processMessage(item: any) {
    try {

      if(item != null) {
        this.currentSending = { id: item.id, trama: item.trama };

        if (!this.isSocketAvailable()) {
          this.currentSending = null;
          this.logError('Socket no disponible o no writable al intentar enviar');
          this.reconnect();
          return;
        }
  
        const timeoutPerMessage = setTimeout(() => {
          this.logError(`Timeout esperando respuesta para id: ${item.id}`);
          this.pendingResponses.delete(item.id);
          this.currentSending = null;
          item.resolve?.('TIMEOUT');
        }, this.timeoutRead);
  
        this.pendingResponses.set(item.id, (response: string) => {
          clearTimeout(timeoutPerMessage);
          item.resolve(response);
          this.currentSending = null;
        });
  
        const message = `\n${item.trama}\r`;
        const encodedMessage = iconv.encode(message, 'ISO-8859-15');
  
        try {
          const result = this.sendData(encodedMessage.toString('binary'));    
          
          if(result) {
            this.logError(`Trama enviada: ${encodedMessage.toString('binary')}`);
            this.sendQueue.shift();
          }
          
        } catch (error) {
          this.logError(`Error enviando trama: ${error.message}`, error.stack);
          this.currentSending = null;
        }
      }
    } catch (error) {
      this.logError(`Error enviando trama: ${error.message}`, error.stack);
    }
  }

  private sendData(data: string): boolean {
    this.logError(`sendData - datos a enviar data = ${data}`);

    const flushed = this.client.write(data, (err) => {
      if (err) {
        this.logError(`sendData - ERROR AL ENVIAR DATOS: ${err.message}`);
        this.isConnected = false;
        return false;
      }
      this.logError(`sendData - datos enviadas`);
    });

    if (!flushed) {
      this.client.once('drain', () => {
        this.logError('Buffer drenado, se completó el write');
      });
    }

    this.logError(`sendData - datos ENVIADOS CORRECTAMENTE`);
    return true;
  }

  private cleanupSocket() {
    this.logError('cleanupSocket');

    if (this.client) {
      this.logError('Cleaning up existing socket connection');
      this.client.removeAllListeners();
      this.client.destroy();
      this.client.unref();
      this.client = null;
    }
    this.isConnected = false;

    return new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 1000); // Espera 1 segundo (ajustable)
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(async () => {
      try{
        const now = Date.now();
        const time = now - this.lastHeartbeatTimestamp;
  
        this.logError(`startHeartbeat - time = ${time}`);
        this.logError(`startHeartbeat - isConnected = ${this.isConnected}`);
        this.logError(`startHeartbeat - reconectando = ${this.reconectando}`);
        this.logError(`startHeartbeat - currentSending = ${this.currentSending}`);
        this.logError(`startHeartbeat - this.sendQueue.length === 0 = ${this.sendQueue.length === 0}`);
  
        const timeActual = now - this.lastHeartbeatTimestamp;
        this.logError(`startHeartbeat - timeActual = ${timeActual}`);
  
        const shouldSendHeartbeat = !this.currentSending &&
                                  !this.reconectando &&
                                  this.sendQueue.length === 0 &&
                                  timeActual>= 30000;
  
        this.logError(`startHeartbeat - shouldSendHeartbeat = ${shouldSendHeartbeat}`);
        
        if (shouldSendHeartbeat) {
          this.logError(`startHeartbeat - se inicia heartbeat`);
  
          if(this.reintentosHearbeatSinRespuesta >= 5) {
            this.logError(`startHeartbeat disconect - 5 reintentos - reconexión *** RECONEXIÓN POR HEARBEAT ***`);
            this.reconnect();
          }
          
          const message = `\n${this.heartbeatMessage}\r`;
          const encodedMessage = iconv.encode(message, 'ISO-8859-15');      
          const sended = this.sendData(encodedMessage.toString('binary'));
  
          if(!sended){
            this.logError(`startHeartbeat NO SE ENVIÓ HEARBEAT POR QUE NO HAY CONEXIÓN`);
          }
          
          this.logError(`startHeartbeat reintentosHearbeatSinRespuesta = ${this.reintentosHearbeatSinRespuesta}`);
          this.reintentosHearbeatSinRespuesta = this.reintentosHearbeatSinRespuesta + 1;
          this.lastHeartbeatTimestamp = Date.now();
          this.logError('Heartbeat enviado');
        }
      }
      catch (error) {
        this.logError(`startHeartbeat - Error en prceso de heartbeat: ${error.message}`, error.stack);
      }
    }, 1000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendHearbetWithDisconect() {
    this.stopHeartbeat();
    this.reintentosHeartbeatDisconect = 0;
    this.lastHeartbeatDisconect = 0;

    this.heartbeatDisconect = setInterval(async () => {
      const now = Date.now();
      const time = this.lastHeartbeatDisconect > 0 ? now - this.lastHeartbeatDisconect : 0;

      this.logError(`sendHearbetWithDisconect - time = ${time}`);
      this.logError(`sendHearbetWithDisconect - lastHeartbeatDisconect = ${this.lastHeartbeatDisconect}`);

      const shouldSendHeartbeat = !this.isConnected &&
                                  now - this.lastHeartbeatTimestamp >= 30000;

      const tiempoTranscurrido = now - this.lastHeartbeatTimestamp;
      this.logError(`sendHearbetWithDisconect tiempoTranscurrido = ${tiempoTranscurrido}`);
      this.logError(`sendHearbetWithDisconect shouldSendHeartbeat = ${shouldSendHeartbeat}`);

      if (shouldSendHeartbeat) {
        this.logError(`sendHearbetWithDisconect disconect - se inicia heartbeat`);

        if(this.reintentosHeartbeatDisconect >= 3) {
          this.isConnected = false;
          this.logError(`sendHearbetWithDisconect disconect - 3 reintentos - *** RECONEXIÓN POR HEARBEAT WITH DISCONECT ***`);
          this.reconnect();
        }
        
        const message = `\n${this.heartbeatMessage}\r`;
        const encodedMessage = iconv.encode(message, 'ISO-8859-15');      
        const sended = this.sendData(encodedMessage.toString('binary'));        
        
        this.lastHeartbeatDisconect = Date.now();
        this.logError('sendHearbetWithDisconect disconect enviado');
        this.logError(`sendHearbetWithDisconect reintentosHeartbeatDisconect = ${this.reintentosHeartbeatDisconect}`);
        this.reintentosHeartbeatDisconect = this.reintentosHeartbeatDisconect + 1;
      }
    }, 1000);
  }

  private stopHeartbeatWithDisconect() {
    if (this.heartbeatDisconect) {
      clearInterval(this.heartbeatDisconect);
      this.heartbeatDisconect = null;
    }
  }

  private getLogContext(): string {
    const currentId = this.currentSending ? this.currentSending.id : 'none';
    return `connectionId=${this.connectionId} queueSize=${this.sendQueue.length} currentSendingId=${currentId}`;
  }

  private logError(message: string, ...optionalParams: any[]) {
    this.logger.logError(`${message} | ${this.getLogContext()}`, ...optionalParams);
  }

  private isSocketAvailable(): boolean {
    return this.client && !this.client.destroyed && this.client.writable;
  }
}

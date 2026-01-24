import { MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { ReturnService } from './return.service';
import { Server, Socket } from 'socket.io';
import { LoggerService } from 'src/shared/logger/logger.service';

@WebSocketGateway({ cors: true, namespace: '/', port: process.env.KISOFT_OUT_PORT })
export class ReturnGateway implements OnGatewayConnection, OnGatewayDisconnect {

  constructor(private readonly returnService: ReturnService,
              private readonly logger: LoggerService) {}

  @WebSocketServer()
    server: Server;

  handleDisconnect(client: Socket) {
  }

  handleConnection(client: Socket) {
  } 
}

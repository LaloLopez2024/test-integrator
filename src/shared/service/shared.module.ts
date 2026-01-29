import { Global, Module, Provider } from '@nestjs/common';
import { FileWatcherService } from './file-watcher.service';
import { TextService } from './text.service';
import { TcpService } from './tcp-service';
import { FileTrackerService } from './file-tracker.service';
import { FileRemoveService } from './file-remove.service';
import { LoggerService } from '../logger/logger.service';
import { TraceService } from 'src/trace/trace.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trace } from 'src/trace/entities/trace.entity';
import { Trama32RTrackerService } from './trama32r-tracker.service';
import { ApiService } from './api.service';
import { HttpModule } from '@nestjs/axios';
import { SftpPrintService } from './sftp-print-service';
import { HeartbeatService } from './heartbeat.service';
import { TcpModule } from './tcp/tcp.module';
import { SystemParameter } from '../entities/system-parameter.entity';
import { SystemParameterService } from './system-parameter.service';

@Global()
@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([ Trace, SystemParameter ]),
  ],
  providers: [
    SftpPrintService,
    FileWatcherService,
    TextService,
    FileRemoveService,
    FileTrackerService,
    TraceService,
    TcpModule,
    //TcpListenerService,
    Trama32RTrackerService,
    ApiService,
    SystemParameterService,
    {
      provide: LoggerService,
      useFactory: () => new LoggerService('SHARED'),
    },
  ],
  exports: [
    SftpPrintService,
    FileWatcherService,
    TextService,
    FileRemoveService,
    FileTrackerService,
    TraceService,
    TcpModule,
    //TcpListenerService,
    Trama32RTrackerService,
    HttpModule,
    ApiService,
    SystemParameterService,
  ],
})
export class SharedModule {}
import { Module } from '@nestjs/common';
import { TestService } from './test.service';
import { TestController } from './test.controller';
import { LoggerService } from 'src/shared/logger/logger.service';
import { AuthModule } from 'src/auth/auth.module';
import { AuthService } from 'src/auth/auth.service';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/auth/entities/user.entity';
import { ReturnService } from 'src/return/return.service';
import { TWoaResponse } from 'src/return/entities/twoa-response.entity';
import { WoaModule } from 'src/woa/woa.module';
import { ArticleService } from 'src/article/article.service';
import { XmlService } from 'src/shared/service/xml.service';
import { ApiService } from 'src/shared/service/api.service';
import { Woa } from 'src/woa/entities/woa.entity';
import { RouteService } from 'src/route/route.service';
import { SequenceService } from 'src/woa/secuence.service';
import { SequenceDetailService } from 'src/woa/secuence-detail.service';
import { Article } from 'src/article/entities/article.entity';
import { Route } from 'src/route/entities/route.entity';
import { TSequence } from 'src/woa/entities/tsequence.entity';
import { TSequenceDetail } from '../woa/entities/tsequence-detail.entity';
import { TraceService } from 'src/trace/trace.service';
import { Trama32RTrackerService } from 'src/shared/service/trama32r-tracker.service';
import { TextService } from 'src/shared/service/text.service';
import { FileRemoveService } from 'src/shared/service/file-remove.service';
import { FileTrackerService } from 'src/shared/service/file-tracker.service';
import { SftpPrintService } from 'src/shared/service/sftp-print-service';
import { Trace } from 'src/trace/entities/trace.entity';
import { TcpModule } from 'src/shared/service/tcp/tcp.module';
import { ProcessReturnService } from 'src/return/process-return.service';

@Module({
  controllers: [TestController],
  providers: [
    TestService,
    AuthService,
    AuthModule,
    ProcessReturnService,
    ReturnService,
    ArticleService,
    XmlService,
    ApiService,
    RouteService,
    SequenceService,
    SequenceDetailService,
    TraceService,
    TcpModule,
    Trama32RTrackerService,
    TextService,
    FileRemoveService,
    FileTrackerService,
    SftpPrintService,
    { 
      provide: LoggerService,
      useFactory: () => new LoggerService('TEST'),
    },
  ],
   imports:[
      WoaModule,
      HttpModule,
      TypeOrmModule.forFeature([ User, TWoaResponse, Woa, Article, Route, TSequence, TSequenceDetail, Trace ])
    ]
})
export class TestModule {}

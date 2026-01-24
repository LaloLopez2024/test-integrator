import { Module } from '@nestjs/common';
import { RouteInstructionService } from './route-instruction.service';
import { RouteInstructionController } from './route-instruction.controller';
import { TcpService } from 'src/shared/service/tcp-service';
import { TextService } from 'src/shared/service/text.service';
import { ApiService } from 'src/shared/service/api.service';
import { XmlService } from 'src/shared/service/xml.service';
import { WoaModule } from 'src/woa/woa.module';
import { InductionService } from './tinduction.service';
import { SequenceService } from 'src/woa/secuence.service';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Woa } from 'src/woa/entities/woa.entity';
import { Route } from 'src/route/entities/route.entity';
import { TInduction } from './entities/tinduction.entity';
import { Article } from 'src/article/entities/article.entity';
import { TWoaResponse } from 'src/return/entities/twoa-response.entity';
import { SequenceDetailService } from 'src/woa/secuence-detail.service';
import { RouteService } from 'src/route/route.service';
import { LoggerService } from 'src/shared/logger/logger.service';
import { TSequence } from 'src/woa/entities/tsequence.entity';
import { TSequenceDetail } from 'src/woa/entities/tsequence-detail.entity';
import { AuthService } from 'src/auth/auth.service';
import { AuthModule } from 'src/auth/auth.module';
import { User } from 'src/auth/entities/user.entity';
import { ArticleService } from 'src/article/article.service';
import { TcpModule } from 'src/shared/service/tcp/tcp.module';

@Module({
  controllers: [RouteInstructionController],
  providers: [
    RouteInstructionService,
    TcpModule,
    XmlService,
    TextService,
    ApiService,
    InductionService,
    SequenceService,
    SequenceDetailService,
    RouteService,
    AuthService,
    AuthModule,
    ArticleService,
    {
      provide: LoggerService,
      useFactory: () => new LoggerService('ROUTE_INSTRUCTION'),
    },
  ],
  imports:[
      WoaModule,
      HttpModule,
      TypeOrmModule.forFeature([ TInduction, TWoaResponse, Woa, Article, TSequence, Route, TSequenceDetail, User  ])
    ]
})
export class RouteInstructionModule {}

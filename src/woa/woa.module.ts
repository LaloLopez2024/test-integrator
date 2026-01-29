import { Module } from '@nestjs/common';
import { WoaService } from './woa.service';
import { WoaController } from './woa.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Woa } from './entities/woa.entity';
import { TextService } from 'src/shared/service/text.service';
import {  TSequence } from './entities/tsequence.entity';
import { SequenceService } from './secuence.service';
import { RouteService } from 'src/route/route.service';
import { Route } from 'src/route/entities/route.entity';
import { TSequenceDetail } from './entities/tsequence-detail.entity';
import { SequenceDetailService } from './secuence-detail.service';
import { ApiService } from 'src/shared/service/api.service';
import { PrintFileService } from './printFile.service';
import { HttpModule } from '@nestjs/axios';
import { LoggerService } from 'src/shared/logger/logger.service';
import { AuthModule } from 'src/auth/auth.module';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/auth/entities/user.entity';
import { ArticleService } from 'src/article/article.service';
import { Article } from 'src/article/entities/article.entity';
import { Trace } from 'src/trace/entities/trace.entity';
import { SharedModule } from 'src/shared/service/shared.module';
import { ProcessFilesService } from './process-files.service';
import { WoaCalculationService } from './woa-calculation.service';
import { WoaConfigService } from './config/woa-config.service';

@Module({
  controllers: [WoaController],
  providers: [
    WoaService,
    SequenceService,
    SequenceDetailService,
    RouteService,
    TextService,
    ApiService,
    AuthService,
    ArticleService,
    AuthModule,
    SharedModule,
    PrintFileService,
    ProcessFilesService,
    WoaCalculationService,
    WoaConfigService,
    {
      provide: LoggerService,
      useFactory: () => new LoggerService('WOA'),
    },
  ],
  exports: [
    WoaService,
    PrintFileService,
  ],
  imports:[
    HttpModule,
    TypeOrmModule.forFeature([ Woa, TSequence, Route, TSequenceDetail, User, Article, Trace ])
  ]
})
export class WoaModule {}

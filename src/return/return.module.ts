import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ReturnService } from "./return.service";
import { TWoaResponse } from "./entities/twoa-response.entity";
import { WoaModule } from "src/woa/woa.module";
import { ArticleService } from "src/article/article.service";
import { RouteService } from "src/route/route.service";
import { TextService } from "src/shared/service/text.service";
import { SequenceService } from "src/woa/secuence.service";
import { SequenceDetailService } from "src/woa/secuence-detail.service";
import { Article } from "src/article/entities/article.entity";
import { Woa } from "src/woa/entities/woa.entity";
import { Route } from "src/route/entities/route.entity";
import { XmlService } from "src/shared/service/xml.service";
import { HttpModule } from "@nestjs/axios";
import { ApiService } from "src/shared/service/api.service";
import { LoggerService } from "src/shared/logger/logger.service";
import { TSequence } from "src/woa/entities/tsequence.entity";
import { TSequenceDetail } from "src/woa/entities/tsequence-detail.entity";
import { Trace } from "src/trace/entities/trace.entity";
import { ReturnController } from "./return.controller";
import { AuthService } from "src/auth/auth.service";
import { AuthModule } from "src/auth/auth.module";
import { User } from "src/auth/entities/user.entity";
import { ProcessReturnService } from "./process-return.service";

@Module({
    controllers: [ReturnController],
    providers: [
        ProcessReturnService,
        ArticleService,
        ReturnService,
        TextService, 
        RouteService, 
        SequenceService, 
        SequenceDetailService,
        XmlService,
        ApiService,
        AuthService,
        AuthModule,
        {
            provide: LoggerService,
            useFactory: () => new LoggerService('RETURN'),
        },
    ],
     imports:[
        WoaModule,
        HttpModule,
        TypeOrmModule.forFeature([ TWoaResponse, Woa, Article, TSequence, Route, TSequenceDetail, Trace, User ])
      ]
  })
  export class ReturnModule {}
  
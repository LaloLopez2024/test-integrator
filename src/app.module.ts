import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WoaModule } from './woa/woa.module';
import { ArticleModule } from './article/article.module';
import { RouteModule } from './route/route.module';
import { IhtModule } from './iht/iht.module';
import { ReturnModule } from './return/return.module';
import { HttpModule } from '@nestjs/axios';
import { RouteInstructionModule } from './route-instruction/route-instruction.module';
import { SharedModule } from './shared/service/shared.module';
import { SeederModule } from './shared/seeder/seeder.module';
import { AuthModule } from './auth/auth.module';
import { TraceModule } from './trace/trace.module';
import { TestModule } from './test/test.module';
import { TcpModule } from './shared/service/tcp/tcp.module';
import { PartnerModule } from './partner/partner.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      database: process.env.DB_NAME,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      extra: {
        max: 10,
        idleTimeoutMillis: 30000,
      },
    }),
    HttpModule,
    SharedModule,
    TcpModule,
    AuthModule,
    WoaModule,
    ArticleModule,
    RouteModule,
    IhtModule,
    ReturnModule,
    RouteInstructionModule,
    PartnerModule,
    SeederModule,
    TraceModule,
    TestModule
  ], 
  controllers: [AppController],
  providers: [
    AppService
  ],
})
export class AppModule {}

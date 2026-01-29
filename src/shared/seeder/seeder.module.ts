import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeederService } from './seeder.service';
import { TSequence } from 'src/woa/entities/tsequence.entity';
import { TSequenceDetail } from 'src/woa/entities/tsequence-detail.entity';
import { SystemParameter } from '../entities/system-parameter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TSequence, TSequenceDetail, SystemParameter])],
  providers: [SeederService],
  exports: [SeederService],
})
export class SeederModule {}
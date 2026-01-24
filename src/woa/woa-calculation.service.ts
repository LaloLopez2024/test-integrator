import { Injectable } from '@nestjs/common';
import { CreateWoaDto } from './dto/create-woa.dto';
import { LoggerService } from 'src/shared/logger/logger.service';

@Injectable()
export class WoaCalculationService {
  constructor(private readonly logger: LoggerService) {}

  /**
   * Calcula la suma de volumen_linea para todos los registros WOA con el mismo oblpn
   * @param data Array de CreateWoaDto
   * @param oblpn Número de OBLPN a buscar
   * @returns Suma total de volumen_linea para el oblpn especificado
   */
  getSumaVolumenLinea(data: CreateWoaDto[], oblpn: string): number {
    const volumenLineas = data
      .filter(woa => woa.oblpn === oblpn && woa.volumen_linea != null)
      .map(woa => woa.volumen_linea);

    return volumenLineas.reduce((acc, item) => {
      return acc + (item != null && typeof item === 'number' ? item : 0);
    }, 0);
  }
}

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TSequence } from 'src/woa/entities/tsequence.entity';
import { TSequenceDetail } from 'src/woa/entities/tsequence-detail.entity';
import { SystemParameter } from '../entities/system-parameter.entity';

@Injectable()
export class SeederService {
  constructor(
    @InjectRepository(TSequence) private readonly tsecuenceRepository: Repository<TSequence>,
    @InjectRepository(TSequenceDetail) private readonly tsecuenceDetailsRepository: Repository<TSequenceDetail>,
    @InjectRepository(SystemParameter) private readonly systemParameterRepository: Repository<SystemParameter>,
  ) {}

  async seed(): Promise<void> {
    console.log("CARGANDO SEEDERS");
    //await this.createSequences();
    //await this.createSequenceDetails();
    //await this.createWoaSystemParameters();
  }

  private async createSequences(): Promise<void> {
    const sequences = [
        { 
            id: 1,
            ob_lpn_type_kisoft: '01', 
            description: 'Excesos Mal Estado',
            SEC1: '125',
            SEC5: 'R1',
            percentage: 100
        },
        { 
            id: 2,
            ob_lpn_type_kisoft: '31', 
            description: 'Excesos Mal Estado',
            SEC5: 'R2',
            percentage: 100
        },
        { 
            id: 3,
            ob_lpn_type_kisoft: '32', 
            description: 'P04-Split (Int_Tox_Hosp)',
            SEC5: 'R1',
            percentage: 100
        },
        { 
            id: 4,
            ob_lpn_type_kisoft: '01', 
            description: '06-PK Cadena No bono',
            SEC1: '125',
            SEC2: '121',
            SEC3: '152',
            SEC4: '181',
            SEC5: 'R1',
            percentage: 50
        },
        { 
            id: 5,
            ob_lpn_type_kisoft: '01', 
            description: '07-PK Excesos',
            SEC0: '040',
            SEC1: '125',
            SEC5: 'R1',
            percentage: 100
        },
        { 
          id: 6,
          ob_lpn_type_kisoft: '01', 
          description: '11-PK Excesos ME',
          SEC0: '041',
          SEC1: '125',
          SEC5: 'R1',
          percentage: 100
        },
        { 
          id: 7,
          ob_lpn_type_kisoft: '01', 
          description: '08-PK Ruteo',
          SEC1: '125',
          SEC2: '121',
          SEC3: '152',
          SEC4: '181',
          SEC5: 'R1',
          percentage: 100
        }
    ];

    for (const sequence of sequences) {
      const existingSecuence = await this.tsecuenceRepository.findOneBy({ id: sequence.id,  ob_lpn_type_kisoft: sequence.ob_lpn_type_kisoft });
      if (!existingSecuence) {
        const newSequence = this.tsecuenceRepository.create(sequence);
        await this.tsecuenceRepository.save(newSequence);
      }
    }    
  }

  private async createSequenceDetails(): Promise<void> {
    const sequenceDetails = [
        { 
            ob_lpn_type_wms: '02',
            ob_lpn_type_kisoft: '01', 
            description: 'Droguería',
            sequenceId: 1
        },
        { 
            ob_lpn_type_wms: '03',
            ob_lpn_type_kisoft: '31', 
            description: 'Droguería/Cadena',
            sequenceId: 2
        },
        { 
            ob_lpn_type_wms: '04',
            ob_lpn_type_kisoft: '32', 
            description: 'Droguería/Cadena',
            sequenceId: 3
        },
        { 
            ob_lpn_type_wms: '01',
            ob_lpn_type_kisoft: '31', 
            description: 'Full Original',
            sequenceId: 2
        },
        { 
            ob_lpn_type_wms: '05',
            ob_lpn_type_kisoft: '01', 
            description: 'Cadena - Si Bono',
            sequenceId: 1
        },
        { 
            ob_lpn_type_wms: '06',
            ob_lpn_type_kisoft: '01', 
            description: 'Cadena - No Bono (llena)',
            sequenceId: 4
        },
        { 
            ob_lpn_type_wms: '07',
            ob_lpn_type_kisoft: '01', 
            description: 'Excesos',
            sequenceId: 5
        },
        { 
            ob_lpn_type_wms: '08',
            ob_lpn_type_kisoft: '01', 
            description: 'Ruteo',
            sequenceId: 7
        },
        { 
            ob_lpn_type_wms: '09',
            ob_lpn_type_kisoft: '31', 
            description: 'Ruteo',
            sequenceId: 2
        },
        { 
          ob_lpn_type_wms: '11',
          ob_lpn_type_kisoft: '01', 
          description: 'Excesos Mal Estado',
          sequenceId: 6
      },
    ];

    for (const sequenceDetail of sequenceDetails) {
      const existing = await this.tsecuenceDetailsRepository.findOneBy({ ob_lpn_type_wms: sequenceDetail.ob_lpn_type_wms,  ob_lpn_type_kisoft: sequenceDetail.ob_lpn_type_kisoft });
      if (!existing) {
        const newSequenceDetail = this.tsecuenceDetailsRepository.create(sequenceDetail);
        await this.tsecuenceDetailsRepository.save(newSequenceDetail);
      }
    }    
  }

  private async createWoaSystemParameters(): Promise<void> {
    const woaParameters = [
      {
        interface_name: 'WOA',
        parameter_name: 'VOLUMEN_LINEA_THRESHOLD',
        parameter_value: '18000',
        description: 'Umbral de volumen de línea para determinar el flujo de procesamiento. Si la suma de volumen_linea > VOLUMEN_LINEA_THRESHOLD, se aplican reglas especiales.',
        CreatedDate: new Date(),
        CreatedUser: 3,
      },
      {
        interface_name: 'WOA',
        parameter_name: 'OBLPN_TYPES',
        parameter_value: '06,07',
        description: 'Tipos de ob_lpn_type que aplican para la lógica de volumenOverLimit y envioChequeo. Formato: valores separados por comas (ej: 06,07 o 07,08,09).',
        CreatedDate: new Date(),
        CreatedUser: 3,
      },
      {
        interface_name: 'WOA',
        parameter_name: 'CUSTOMER_EXCEPTIONS',
        parameter_value: 'C015883',
        description: 'Códigos de clientes (woa.cust_nbr) para la lógica de tramas con ob_lpn_type = 2 y que deben enviarse las secciones SEC3 Y SEC4 y generar el archivo de impresión. Formato: valores separados por comas (ej: C002258,C000706,C012219).',
        CreatedDate: new Date(),
        CreatedUser: 3,
      }
    ];

    for (const param of woaParameters) {
      const existing = await this.systemParameterRepository.findOne({
        where: {
          interface_name: param.interface_name,
          parameter_name: param.parameter_name,
        },
      });

      if (!existing) {
        const newParameter = this.systemParameterRepository.create(param);
        await this.systemParameterRepository.save(newParameter);
        console.log(`Parámetro WOA creado: ${param.interface_name}.${param.parameter_name} = ${param.parameter_value}`);
      } else {
        console.log(`Parámetro WOA ya existe: ${param.interface_name}.${param.parameter_name}`);
      }
    }
  }
}
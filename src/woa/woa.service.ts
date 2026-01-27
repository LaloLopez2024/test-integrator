import { Injectable } from '@nestjs/common';
import { CreateWoaDto } from './dto/create-woa.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Woa } from './entities/woa.entity';
import { Repository } from 'typeorm';
import { pickOrderConfig } from 'src/woa/mapping/pickorder-config';
import { TcpService } from 'src/shared/service/tcp-service';
import { TextService } from 'src/shared/service/text.service';
import { WoaKisoftConfig } from './mapping/woa-kisoft.config';
import { RouteService } from 'src/route/route.service';
import { SequenceService } from './secuence.service';
import { SequenceDetailService } from './secuence-detail.service';
import { PrintFileService } from './printFile.service';
import { LoggerService } from 'src/shared/logger/logger.service';
import { TraceService } from 'src/trace/trace.service';
import moment from 'moment';
import { ArticleService } from 'src/article/article.service';
import * as csvParse from 'csv-parse/sync';
import { Article } from 'src/article/entities/article.entity';
import { WoaCalculationService } from './woa-calculation.service';
import { WoaConfigService } from './config/woa-config.service';

@Injectable()
export class WoaService {

constructor(
  @InjectRepository(Woa)
  private readonly woaRepository:  Repository<Woa>,
  private readonly logger: LoggerService,
  private readonly textService: TextService,
  private readonly tcpService: TcpService,
  private readonly routeService: RouteService,
  private readonly sequenceService: SequenceService,
  private readonly sequenceDetailService: SequenceDetailService,
  private readonly printFileService: PrintFileService,
  private readonly traceService: TraceService,
  private readonly articleService: ArticleService,
  private readonly woaCalculationService: WoaCalculationService,
  private readonly woaConfigService: WoaConfigService
){}

  async iniciarProceso(trama: string) {
    setImmediate(async () => {
      await this.create(trama);
    });
  }

  async create(trama: string) {

    try
    {
      this.logger.logError("Inicio procesamiento de datos recibidos en WOA");
      let createWoaList = await this.procesarTramaWAO(trama);
      
      if(createWoaList && createWoaList.length > 0) {
        const dataSaved = await this.saveWoa(createWoaList);
        
        if(dataSaved && dataSaved.length > 0){
          this.logger.logError("Inicio de envío de tramas WOA");
          await this.sendToKisoft(dataSaved);
    
          this.logger.logError("Inicio de generación de archivo de impresión");
          await this.printFileService.generatePrintFile(dataSaved);
        }
      }
    }
    catch(error) {
      this.logger.logError(`Ocurrió un error en create, error: ${error.message}`, error.stack);
    }
  }

  private async procesarTramaWAO(trama: string): Promise<CreateWoaDto[]> {
    try {
      const createWoaList: CreateWoaDto[] = [];
      const waoMappingConfig = pickOrderConfig;
  
      const records = csvParse.parse(trama, {
        delimiter: '|',
        quote: '"',
        escape: '"',
        relax_quotes: true,
        relax_column_count: true,
        skip_empty_lines: true,
      });
  
      for (const woaData of records) {
        const createWoaDto = new CreateWoaDto();
  
        for (let index = 0; index < waoMappingConfig.length; index++) {
          const config = waoMappingConfig[index];
          if (woaData[index] !== undefined) {
            if (config.type && (config.type === 'date' || config.type === 'numeric')) {
              if (woaData[index] !== '') {
                createWoaDto[config.field] = woaData[index];
              }
            } else {
              createWoaDto[config.field] = woaData[index];
            }
          }
        }
  
        createWoaList.push(createWoaDto);
      }
  
      return createWoaList;
    } catch (error) {
      this.logger.logError(`Ocurrió un error en procesarTramaWAO, error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async calculateVolumenLinea(data: CreateWoaDto[]): Promise<CreateWoaDto[]> {
    try {
      const articles = await this.articleService.findAddByKeys(data);
      
      const articlesMap = new Map<string, Article>();
      for (const article of articles) {
        const key = `${article.Cod_Barra_Ubicacion}_${article.Cod_Alt_Producto}`;
        articlesMap.set(key, article);
      }

      for (const dto of data) {
        const articleKey = `${dto.allocated_location}_${dto.part_a}`;
        const article = articlesMap.get(articleKey);

        if (article && dto.allocated_qty) {
          dto.volumen_linea = Number(dto.allocated_qty) * Number(article.Volumen_Unidad);
        } else {
          dto.volumen_linea = 0;
        }
        
        this.logger.logError(`oblpn:${dto.oblpn} - allocated_location: ${dto.allocated_location} - part_a:${dto.part_a} - allocated_qty:${dto.allocated_qty} - volumen_linea: ${dto.volumen_linea}`);
      }

      return data;
    } catch (error) {
      this.logger.logError(`Error al calcular volumen_linea, error: ${error.message}`, error.stack);
      return data;
    }
  }

  private async saveWoa(data: CreateWoaDto[]): Promise<CreateWoaDto[]> {
    const batchSize = 300;
    const woaSaved: CreateWoaDto[] = [];

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const woaInsert = await this.saveWoaByChunk(batch);
      woaSaved.push(...woaInsert);
    }

    return woaSaved;
  }

  private async saveWoaByChunk(data: CreateWoaDto[]): Promise<CreateWoaDto[]> {
    const woaSaved: CreateWoaDto[] = [];

    const duplicates = this.findDuplicates(data);
    this.logger.logError(`saveWoa - duplicates: ${JSON.stringify(duplicates, null, 2)}`);

    for(const d of duplicates) {
      this.logger.logError(`saveWoa - duplicates - key: ${d.key}, count = ${d.count}`);
    }

    const existingWoas = await this.woaRepository.find({
      where: data.map(dto => ({
        wave_number: dto.wave_number,
        order_number: dto.order_number,
        oblpn: dto.oblpn,
        part_a: dto.part_a,
        allocated_location: dto.allocated_location,
        mhe_system_code: dto.mhe_system_code,
        batch_nbr: dto.batch_nbr,
        order_seq_nbr1: dto.order_seq_nbr1,
      })),
    });

    const existingWoasMap = new Map<string, Woa>();
    for (const woa of existingWoas) {
      const key = `${woa.wave_number}_${woa.order_number}_${woa.oblpn}_${woa.part_a}_${woa.allocated_location}_${woa.mhe_system_code}_${woa.batch_nbr}_${woa.order_seq_nbr1}`;
      existingWoasMap.set(key, woa);
    }

    const articles = await this.articleService.findAddByKeys(data);

    const articlesMap = new Map<string, Article>();
    for (const article of articles) {
      const key = `${article.Cod_Barra_Ubicacion}_${article.Cod_Alt_Producto}`;
      articlesMap.set(key, article);
    }    

    for (const dto of data) {
      let volumen_linea = 0;

      const woaKey = `${dto.wave_number}_${dto.order_number}_${dto.oblpn}_${dto.part_a}_${dto.allocated_location}_${dto.mhe_system_code}_${dto.batch_nbr}_${dto.order_seq_nbr1}`;
      const existingWoa = existingWoasMap.get(woaKey);

      const articleKey = `${dto.allocated_location}_${dto.part_a}`;
      const article = articlesMap.get(articleKey);
      
      if (article && dto.allocated_qty) {
        volumen_linea = Number(dto.allocated_qty) * Number(article.Volumen_Unidad);
      }
      
      try{
        if (article && dto.allocated_qty) {
          volumen_linea = Number(dto.allocated_qty) * Number(article.Volumen_Unidad);
        }
        else {
          volumen_linea = 0;
        }
      }
      catch(error) {
        this.logger.logError(`Error al obtener el article, error: ${error.message}`, error.stack);
      } 

      if(dto.shipto_facility_code == null && dto.cust_nbr == null){
        this.logger.logError("saveWoa - DATOS NULOS - dto", JSON.stringify(dto, null, 2));
      }

      if (existingWoa) {
        try {
          Object.assign(existingWoa, dto);
          existingWoa.volumen_linea = volumen_linea;
          existingWoa.ModifiedDate = new Date();
          existingWoa.ModifiedUser = 3;
          woaSaved.push(existingWoa);
        }
        catch(error) {
          this.logger.logError(`Error al actualizar woa en bd, error: ${error.message}`, error.stack);
        } 
       
      } else {
        try {
          dto.volumen_linea = volumen_linea;
          dto.CreatedDate = new Date();
          dto.CreatedUser = 3;
          woaSaved.push(this.woaRepository.create(dto));
        }
        catch(error) {
          this.logger.logError(`Error al actualizar woa en bd, error: ${error.message}`, error.stack);
        }        
      }
    };

    this.logger.logError(`Inicio de registro en WOA`);
    const woaReturn = await this.woaRepository.save(woaSaved, { chunk: 100 }); 
    this.logger.logError(`fin de registro en WOA`);

    return woaReturn;
  }

  findDuplicates(data: CreateWoaDto[]) {
    const map = new Map<string, { count: number, items: CreateWoaDto[] }>();

    for (const dto of data) {
      const key = `${dto.wave_number}|${dto.order_number}|${dto.oblpn}|${dto.part_a}|${dto.allocated_location}|${dto.mhe_system_code}|${dto.batch_nbr}|${dto.order_seq_nbr1}`;
      
      if (map.has(key)) {
        const entry = map.get(key);
        entry.count++;
        entry.items.push(dto);
      } else {
        map.set(key, { count: 1, items: [dto] });
      }
    }

    // Devuelve solo los duplicados
    const duplicates = Array.from(map.entries())
      .filter(([_, value]) => value.count > 1)
      .map(([key, value]) => ({
        key,
        count: value.count,
        items: value.items,
      }));

    return duplicates;
  }

  private async buildTramaKisoft(createWoaDto: CreateWoaDto, data: CreateWoaDto[]): Promise<string> {
    try
    {
      this.logger.logError("buildTramaKisoft - createWoaDto", JSON.stringify(createWoaDto, null, 2));

      const woaConfig = WoaKisoftConfig;
      let partsTrama: string[] = [];
      let ob_lpn_type_kisoft = '';
      const sequenceDetailService = await this.sequenceDetailService.findByObLpnType(createWoaDto.ob_lpn_type);
      this.logger.logError("buildTramaKisoft - sequenceDetailService", JSON.stringify(sequenceDetailService, null, 2));

      for (const config of woaConfig) {        
        if(config.field != undefined) {

          switch (config.field) {
            case 'action_code': {              
              const valueField = createWoaDto.action_code;
              const trama =  valueField == 'CREATE' ? '12N' : '12D';
              
              if(trama == '12D') {
                partsTrama.push('12D001402');
                partsTrama.push(this.textService.padText(createWoaDto.oblpn.toString(), 14));
                partsTrama.push('01');
                return partsTrama.join('');
              }

              partsTrama.push(this.textService.padText(trama, config.longitud));              
              break;
            }
            case 'ob_lpn_type': {
              if(sequenceDetailService != null ) {
                ob_lpn_type_kisoft = sequenceDetailService.ob_lpn_type_kisoft;
              }
              
              partsTrama.push(this.textService.padText(ob_lpn_type_kisoft, config.longitud));
              break;
            }
            case 'ob_lpn_type_f25': {
              const valueField = createWoaDto.ob_lpn_type;
              const trama = valueField == '31' ? 'FULL' : 'LARGE';
              partsTrama.push(this.textService.padRight(trama, config.longitud));
              break;
            }
            case 'ob_lpn_type_f28': {
              const ob_lpn_type_allow: string[] = [ '01', '03', '04', '09' ];
              
              if(ob_lpn_type_allow.includes(createWoaDto.ob_lpn_type)) {
                partsTrama.push('D');                
                const lengthUnitCode = createWoaDto.oblpn.length > 6 ? '14' : '06';
                partsTrama.push(lengthUnitCode);

                if(sequenceDetailService != null && sequenceDetailService.ob_lpn_type_kisoft == '31') {
                  partsTrama.push(this.textService.padText(createWoaDto.oblpn, parseInt(lengthUnitCode), '0'));
                }
              }
              
              break;
            }
            case 'shipto_facility_code': {
              const valueField = createWoaDto.shipto_facility_code;
              const trama = valueField == '' ? createWoaDto.cust_nbr : valueField;
              partsTrama.push(this.textService.padText(trama, config.longitud));
              break;
            }
            case 'route_nbr': {
              let valueField = '';

              if(this.validateNullString(createWoaDto.route_nbr) && createWoaDto.ob_lpn_type != '08') {
                valueField = '339';
              }
              else {
                valueField = this.validateNullString(createWoaDto.route_nbr) ? createWoaDto.shipto_name : createWoaDto.route_nbr;
                valueField = valueField.replace(/^\s+/, '').substring(0, 3);
              }
              
              const trama = valueField == '' ? '00000000' : valueField.replace(/^\s+/, '').slice(0, 3);
              partsTrama.push(this.textService.padText(trama, config.longitud));
              break;
            }
            case 'rampa_f44': {
              let valueField = '';

              if(this.validateNullString(createWoaDto.route_nbr) && createWoaDto.ob_lpn_type != '08') {
                valueField = '339';
              }
              else {
                valueField = this.validateNullString(createWoaDto.route_nbr) ? createWoaDto.shipto_name : createWoaDto.route_nbr;
                valueField = valueField.replace(/^\s+/, '').substring(0, 3);
              }

              const routeId = valueField != '' ? valueField.substring(0, 3).replace(/\s+/g, '') : valueField;
              const route = await this.routeService.findByRuta(routeId);

              if(route != undefined) {
                const trama = createWoaDto.ob_lpn_type == '31' ? route.HDR_CUST2 : route.HDR_CUST1;
                partsTrama.push(this.textService.padText(trama, config.longitud));
              }
              else {
                partsTrama.push(this.textService.padText('', config.longitud));
              }
              break;
            }
            case 'create_ts': {
              if(process.env.FLG_AGREGA_HORA == '1') {
                const value = this.addHours(createWoaDto.create_ts);
                partsTrama.push(this.textService.padText(value, config.longitud));
              }
              break;
            }
            case 'estacion_destino_f56': {
              const ob_lpn_type_station_allow: string[] = [ '02', '04', '05', '06', '07', '08', '11' ];

              if(ob_lpn_type_station_allow.includes(createWoaDto.ob_lpn_type)) {
                const volumenLinea = this.woaCalculationService.getSumaVolumenLinea(data, createWoaDto.oblpn);
                const sumaVolumenLinea = createWoaDto.ob_lpn_type === '06' ? volumenLinea : 0;
                const threshold = this.woaConfigService.getVolumenLineaThreshold();
                const secuenceTrama = await this.getSeccionesConcatenadas(ob_lpn_type_kisoft, createWoaDto, sequenceDetailService.sequenceId, sumaVolumenLinea > threshold);
                partsTrama.push(secuenceTrama);
              }
              break;
            }
            case 'ob_lpn_type_f60': {
              const ob_lpn_type_station_allow: string[] = [ '02', '05', '06', '07', '08', '11' ];

              if(ob_lpn_type_station_allow.includes(createWoaDto.ob_lpn_type)) {
                  partsTrama.push('U03');
                  partsTrama.push(this.textService.padText(createWoaDto.order_priority.toString(), 3, '0'));
              }
              break;
            }
            case 'ob_lpn_type_f65': {
              const ob_lpn_type_station_allow: string[] = [ '02', '05', '06', '08', '09' ];

              if(ob_lpn_type_station_allow.includes(createWoaDto.ob_lpn_type)) {
                const woaList = await this.findByOblpn(createWoaDto.oblpn);
                partsTrama.push('Z');
                
                if(woaList != null) {
                  partsTrama.push(this.textService.padText(woaList.length.toString(), 3, '0'));
                }
                else {
                  partsTrama.push(this.textService.padText('0', 3, '0'));
                }
                
                partsTrama.push('00031004000000000400');
              }
              break;
            }
            default: {
              partsTrama.push(this.textService.padText(createWoaDto[config.field] ?? '', config.longitud));
              break;
            }
          }
        }
        else {
          partsTrama.push(config.value);
        }
      };
  
      return partsTrama.join('');
    }
    catch(error) {
      this.logger.logError(`Error al construir trama kisoft, error: ${error.message}`, error.stack);
    }
  }


  async getSeccionesConcatenadas(oblpnTypeKisoft: string, woa: CreateWoaDto, sequenceId: number, flgVolumenLinea: boolean) : Promise<string> {
    const sequenceTrama: string[] = [];
    const sequence = await this.sequenceService.findById(sequenceId);
    let cantSections = 0;

    this.logger.logError(`oblpn:${woa.oblpn} - getSeccionesConcatenadas - sequence = ${JSON.stringify(sequence, null, 2)}`);

    if(sequence) {
      const sec0 = sequence.SEC0 ? sequence.SEC0.replace(/\s+/g, '') : '';
      let sec1 = sequence.SEC1 ? sequence.SEC1.replace(/\s+/g, '') : '';
      const sec2 = sequence.SEC2 ? sequence.SEC2.replace(/\s+/g, '') : '';
      let sec3 = sequence.SEC3 ? sequence.SEC3.replace(/\s+/g, '') : '';
      let sec4 = sequence.SEC4 ? sequence.SEC4.replace(/\s+/g, '') : '';
      const sec5 = sequence.SEC5 ? sequence.SEC5.replace(/\s+/g, '') : '';

      // Si volumen > VOLUMEN_LINEA_THRESHOLD y es PAR, eliminar SEC1
      if(flgVolumenLinea && Number(woa.oblpn) % 2 == 0) {
        sec1 = '';
      }

      // Si volumen <= VOLUMEN_LINEA_THRESHOLD, eliminar SEC3 y SEC4
      if(!flgVolumenLinea) {
        sec3 = '';
        sec4 = '';
      }

      if(sec0 != '') {
        sequenceTrama.push(this.textService.padText(sec0, 3, '0'));
        cantSections++;
      }

      if(sec1 != '') {
        sequenceTrama.push(this.textService.padText(sec1, 3, '0'))
        cantSections++;
      }

      if(sec2 != '') {
        sequenceTrama.push(this.textService.padText(sec2, 3, '0'));
        cantSections++;
      }

      if(sec3 != '') {
        sequenceTrama.push(this.textService.padText(sec3, 3, '0'));
        cantSections++;
      }

      if(sec4 != '') {
        sequenceTrama.push(this.textService.padText(sec4, 3, '0'));
        cantSections++;
      }

      if(sec5 != '') {
        let fieldSearch = woa.route_nbr != '' ? woa.route_nbr : woa.shipto_name;
        fieldSearch = fieldSearch.substring(0, 3).replace(/\s+/g, '');

        const route = await this.routeService.findByRuta(fieldSearch);

        if(route != null) {
          let sec5Value = '';

          if(oblpnTypeKisoft == '01') {
            sec5Value = this.textService.padText(route.HDR_CUST3, 3, '0');
          }
          else {
            sec5Value = this.textService.padText(route.HDR_CUST4, 3, '0');
          }

          sequenceTrama.push(sec5Value);
        }

        cantSections++;
      }

      if(sequenceTrama.length > 0) {
        sequenceTrama.unshift(`K${this.textService.padText(sequenceTrama.length.toString(), 2, '0')}03`);
        return sequenceTrama.join('');
      }
    }
    
    return '';
  }

  private buildTramaDetalleKisoft(data: CreateWoaDto[], oblpn: string): string {
    const partsTrama: string[] = [];

    try
    {
      const dataSearch = data.filter(w => w.oblpn == oblpn);

      if(dataSearch != undefined) {  
        dataSearch.forEach(dto => {
          
          if(dto.allocated_location && dto.allocated_location.trimStart().substring(0, 4) == ('AE10')) {
            partsTrama.push(this.textService.padText('061', 3));
          }
          else {
            partsTrama.push(this.textService.padText(dto.allocated_zone, 3));
          }
                    
          partsTrama.push(this.textService.padText(dto.item_alternate_code, 10));
          partsTrama.push('0001');
          partsTrama.push(this.textService.padText(dto.allocated_qty.toString(), 4, '0'));
        });

        return partsTrama.join('');
      }
    }
    catch(error) {
      this.logger.logError(`Error al construir trama kisoft, error: ${error.message}`, error.stack);
    }
  }

  private async sendToKisoft(data: CreateWoaDto[]){
    try
    {
      if(data) {
        const dataProcessed = this.removeDuplicates(data);

        for(const dto of dataProcessed) {
          try {
            //Se construye trama y se envía a puerto Kisoft
            this.logger.logError(`dto: ${JSON.stringify(dto, null, 2)}`);
            const tramaKisoft = await this.buildTramaKisoft(dto, data);
            let trama = '';

            if(dto.action_code == "CREATE"){
              const ob_lpn_type_station_allow: string[] = [ '02', '05', '06', '08', '09' ];

              if(ob_lpn_type_station_allow.includes(dto.ob_lpn_type)) {
                const tramaDetalleKisoft = this.buildTramaDetalleKisoft(data, dto.oblpn);

                trama = tramaKisoft + tramaDetalleKisoft;
              }
              else {
                trama = tramaKisoft;
              }
            }
            else {
              trama = tramaKisoft;
            }

            const tramaLentgh = trama.length + 5;
            const formatKisoft = `${this.textService.padText(tramaLentgh.toString(), 5, '0')}${trama}`;

            this.logger.logError("tramaKisoft enviada", formatKisoft);

            const traceId = await this.traceService.create("WOA", formatKisoft, JSON.stringify(dto, null, 2));

            await this.tcpService.sendMessage(traceId, formatKisoft, 'WOA');
          }
          catch(error) {
            this.logger.logError(`Recorriendo tramas - Error al enviar trama kisoft, error: ${error.message}`, error.stack);
          }         
        };

        this.logger.logError(`Finalizó envio de trama`);
      }
    }
    catch(error) {
      this.logger.logError(`Error al enviar trama kisoft, error: ${error.message}`, error.stack);
    }
  }

  private removeDuplicates(data: CreateWoaDto[]): CreateWoaDto[] {
    const uniqueItems = new Map();
    const uniqueRepetidos = new Map();

    data.forEach((item) => {
      if (!uniqueItems.has(item.oblpn)) {
        uniqueItems.set(item.oblpn, item);
      }
      else {
        if (!uniqueRepetidos.has(item.oblpn)) {
          uniqueRepetidos.set(item.oblpn, item);
        }
      }
    });

    const oblpnRepetidos = Array.from(uniqueItems.values()).map(item => item.oblpn);
    this.logger.logError(`oblpn repeditos: ${JSON.stringify(Array.from(oblpnRepetidos.values()), null, 2)}`);

    return Array.from(uniqueItems.values());
  }

  async findByFilter(oblpn: string, item_alternate_code: string, batch_brn: string){
    return await this.woaRepository.find({ 
        where: { 
          oblpn: oblpn,
          item_alternate_code: item_alternate_code,
          batch_nbr: batch_brn
        } 
      });
  }

  async findByOblpnAlternativeCode(oblpn: string, item_alternate_code: string) {
    return await this.woaRepository
      .createQueryBuilder('woa')
      .where('woa.oblpn = :oblpn', { oblpn })
      .andWhere('woa.item_alternate_code = :item_alternate_code', { item_alternate_code })
      .andWhere('woa.allocated_qty > COALESCE(woa.cant_return, 0)')
      .getMany();
  }

  async updateWOA(woa: Woa){
    await this.woaRepository.save(woa);    
  }

  async findByOblpnAndRotueInstruction(oblpn: string){
    return await this.woaRepository.findOne({
        where: { 
          oblpn: oblpn,
          send_route_instruction: true
        } 
      });
  }

  async findByOblpn(oblpn: string) {
    return await this.woaRepository.find({
        where: { oblpn: oblpn }
      });
  }

  async findByOblpnWithQtyPending(oblpn: string) {
    return await this.woaRepository
      .createQueryBuilder('woa')
      .where('woa.oblpn = :oblpn', { oblpn })
      .andWhere('woa.allocated_qty > COALESCE(woa.cant_return, 0)')
      .getMany();
  }

  addHours(dateString: string): string {
    const date = moment(dateString, 'YYYYMMDDHHmmss');
    const horas = +process.env.HORA_ENVIO;
    date.add(horas, 'hours');
    return date.format('YYYYMMDDHHmmss');
  }

  validateNullString(text: string | undefined) {
    return text === undefined || (typeof text === 'string' && text.replace(/^\s+/, '').length == 0);
  }
}

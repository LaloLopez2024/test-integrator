import { Injectable } from '@nestjs/common';
import { CreateIhtDto } from './dto/create-iht.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Iht } from './entities/iht.entity';
import { TcpService } from 'src/shared/service/tcp-service';
import { TextService } from 'src/shared/service/text.service';
import { ihtKisoftConfig } from './mapping/iht-kisoft-config';
import { ArticleService } from 'src/article/article.service';
import { XmlService } from 'src/shared/service/xml.service';
import { LoggerService } from 'src/shared/logger/logger.service';
import { Article } from 'src/article/entities/article.entity';
import { TraceService } from 'src/trace/trace.service';

@Injectable()
export class IhtService {

  constructor(
    @InjectRepository(Iht)
    private readonly ihtRepository:  Repository<Iht>,
    private readonly tcpService: TcpService,
    private readonly textService: TextService,
    private readonly articleService: ArticleService,
    private readonly xmlService: XmlService,
    private readonly traceService: TraceService,
    private readonly logger: LoggerService
  ){}

  async iniciarProceso(xml: string) {
    setImmediate(async () => {
      await this.processData(xml);
    });
  }

  async processData(xml: string) {
    this.logger.logError(`Inicia proceso de xml en IHT`);
    
    const createIthDtoList = await this.procesarTramaIHT(xml);

    if(createIthDtoList) {
      this.logger.logError("createIthDtoList length", createIthDtoList.length.toString());  
    }
    
    const processData = await this.saveIth(createIthDtoList);

    if(processData) {
      this.logger.logError("processDatalength ", processData.length.toString());
    }

    await this.sendToKisoft(processData);
  }

  private async procesarTramaIHT(xml: string): Promise<CreateIhtDto[]> {
    try
    {
      const parsedData = await this.xmlService.processXml(xml);  
      
      const items = Array.isArray(parsedData.data.LgfData.ListOfInventoryHistories.inventory_history)
        ? parsedData.data.LgfData.ListOfInventoryHistories.inventory_history
        : [parsedData.data.LgfData.ListOfInventoryHistories.inventory_history];

      const dtos: CreateIhtDto[] = items.map(
        (load: any) => ({
          group_nbr: this.removeWhitespaces(load.group_nbr),
          seq_nbr: this.removeWhitespaces(load.seq_nbr),
          lock_code: this.removeWhitespaces(load.lock_code),
          activity_code: this.removeWhitespaces(load.activity_code),
          lpn_nbr: this.removeWhitespaces(load.lpn_nbr),
          location: this.removeWhitespaces(load.location),
          item_code: this.removeWhitespaces(load.item_code),
          orig_qty: load.orig_qty == '' ? 0 : this.removeWhitespaces(load.orig_qty),
          adj_qty: load.adj_qty == '' ? 0 : this.removeWhitespaces(load.adj_qty),
          ref_value_1: this.removeWhitespaces(load.ref_value_1),
          screen_name: this.removeWhitespaces(load.screen_name),
          module_name: this.removeWhitespaces(load.module_name),
        } as CreateIhtDto),
      );

      return dtos;
    }
    catch(error) {
      this.logger.logError(`Error al obtener datos de trama de IHT, error: ${error.message}`, error.stack);
    }    
  }

  private async saveIth(data: CreateIhtDto[]): Promise<CreateIhtDto[]> {
    let processData: CreateIhtDto[] = [];

    try
    {
      for(const dto of data) {
        const ith = await this.ihtRepository.findOne({ 
          where: { 
            group_nbr: dto.group_nbr,
            seq_nbr: dto.seq_nbr,
            activity_code: dto.activity_code
          } 
        });

        if(ith != null || ith != undefined) {
          ith.lock_code = dto.lock_code;

          if(dto.lpn_nbr != undefined) {
            ith.lpn_nbr = dto.lpn_nbr;
          }

          ith.location = dto.location;
          ith.item_code = dto.item_code; 

          if(dto.orig_qty != undefined) {
            ith.orig_qty = dto.orig_qty;
          }

          if(dto.orig_qty != undefined) {
            ith.adj_qty = dto.adj_qty;
          } 
          
          ith.ref_value_1 = ith.ref_value_1;
          ith.ModifiedDate = new Date();
          ith.ModifiedUser = 3;
          
          await this.ihtRepository.save(ith);
        }
        else {
          dto.CreatedDate = new Date();
          dto.CreatedUser = 3;
          const ithEntity = this.ihtRepository.create(dto);        
          await this.ihtRepository.save(ithEntity);
          processData.push(dto);
        }
      };

      return processData;
    }
    catch(error) {
      this.logger.logError(`Error al grabar la trama de IHT, error: ${error.message}`, error.stack);
    } 
  }

  private async sendToKisoft(data: CreateIhtDto[]) {
    try {
      if(data && data.length > 0) {
        this.logger.logError(`data length = ${data.length.toString()}`);

        const groupedData: Record<string, CreateIhtDto[]> = {};

        for (const item of data) {
          const groupKey = item.group_nbr?.toString() || 'undefined';
          if (!groupedData[groupKey]) {
            groupedData[groupKey] = [];
          }
          groupedData[groupKey].push(item);
        }

        // Procesar cada grupo
        for (const [group_nbr, groupItems] of Object.entries(groupedData)) {
          this.logger.logError(`Procesando grupo ${group_nbr} con ${groupItems.length} elementos`);
          await this.procesaGrupo(groupItems);
        }
      }
    }
    catch(error) {
      this.logger.logError(`Error al procesar la trama de IHT para enviar a kisoft, error: ${error.message}`, error.stack);
    }   
  }

  private async procesaGrupo(data: CreateIhtDto[])
  {
    const groupValidSet = new Set<string>();
    const excluded = ['AE-101', 'AE-102', 'AE-103', 'AE-104', 'AE-105', 'AE-106'];
  
    try 
    {
      this.logger.logError(`procesaGrupo - data = ${JSON.stringify(data, null, 2)}`);

      if(data) {
        let dtoCode2 = null;
        let dtoCode4 = null;
        let dtoCode17 = null;
        let dtoCode29 = null;
        dtoCode2 = data.filter(x => x.activity_code == '2');
        dtoCode17 = data.filter(x => x.activity_code == '17');
        dtoCode4 = data.filter(x => x.activity_code == '4');
        dtoCode29 = data.filter(x => x.activity_code == '29');
        const dto =  data[0];

        if(dto) {
          try {
            this.logger.logError(`procesaGrupo - iniciando extracción de datos - group_nbr = ${dto.group_nbr} - dto = ${JSON.stringify(dto, null, 2)}`);

              let ihtType = '1UN';        
              const nbrWithCode2 = await this.ihtRepository.findOne({ 
                where: { 
                  group_nbr: dto.group_nbr,
                  seq_nbr: dtoCode2 != null ? dtoCode2.seq_nbr : dto.seq_nbr,
                  activity_code: '2'
                } 
              });

              this.logger.logError(`procesaGrupo - group_nbr = ${dto.group_nbr} - nbrWithCode2 = ${JSON.stringify(nbrWithCode2, null, 2)}`);
              
              const nbrWithCode4 = await this.ihtRepository.findOne({ 
                where: { 
                  group_nbr: dto.group_nbr,
                  seq_nbr: dtoCode4 != null ? dtoCode4.seq_nbr : dto.seq_nbr,
                  activity_code: '4'
                }
              });

              this.logger.logError(`procesaGrupo - group_nbr = ${dto.group_nbr} - nbrWithCode4 = ${JSON.stringify(nbrWithCode4, null, 2)}`);
        
              const nbrWithCode17 = await this.ihtRepository.findOne({ 
                where: { 
                  group_nbr: dto.group_nbr,
                  seq_nbr: dtoCode17 != null ? dtoCode17.seq_nbr : dto.seq_nbr,
                  activity_code: '17'
                } 
              });

              this.logger.logError(`procesaGrupo - group_nbr = ${dto.group_nbr} - nbrWithCode17 = ${JSON.stringify(nbrWithCode17, null, 2)}`);
    
              const nbrWithCode29 = await this.ihtRepository.findOne({ 
                where: { 
                  group_nbr: dto.group_nbr,
                  seq_nbr: dtoCode29 != null ? dtoCode29.seq_nbr : dto.seq_nbr,
                  activity_code: '29'
                } 
              });

              this.logger.logError(`procesaGrupo - group_nbr = ${dto.group_nbr} - nbrWithCode29 = ${JSON.stringify(nbrWithCode29, null, 2)}`);

              if (nbrWithCode4 && nbrWithCode4?.location) {
                const loc = nbrWithCode4.location.toUpperCase().trim();

                if (loc.startsWith('AE') && !excluded.some(prefix => loc.startsWith(prefix))) {
                  groupValidSet.add(dto.group_nbr);
                }
                else {
                  this.logger.logError(`procesaGrupo - no se envía la trama a kisoft del grupo: ${dto.group_nbr} debido a que el campo location:${nbrWithCode4?.location} no cumple con las reglas`);
                }
              }
              else{
                this.logger.logError(`procesaGrupo - no se envía trama a kisoft del grupo: ${dto.group_nbr} porque no tiene el campo el activity_code = 4 o no tiene el campo location`);
              }

              if(groupValidSet.has(dto.group_nbr)) {
                
                if((nbrWithCode2 || nbrWithCode17) && nbrWithCode4) {                
                  dto.lpn_nbr = nbrWithCode2.lpn_nbr;
                  dto.location = nbrWithCode4.location;
                  dto.ref_value_1 = nbrWithCode4.ref_value_1;

                  this.logger.logError(`procesaGrupo - group_nbr = ${dto.group_nbr} - OPCIÓN 1`);
                
                  if(nbrWithCode2 || nbrWithCode17) {
                    dto.orig_qty = nbrWithCode2 ? nbrWithCode2.orig_qty : (nbrWithCode17 ? nbrWithCode17.orig_qty : 0);

                    this.logger.logError(`procesaGrupo - group_nbr = ${dto.group_nbr} - OPCIÓN 2`);
                  }
                }
                else {        
                  if(nbrWithCode4 && nbrWithCode29) {
                    dto.lpn_nbr = nbrWithCode29.lpn_nbr;
                    dto.orig_qty = nbrWithCode4.orig_qty;
                    dto.adj_qty = nbrWithCode4.adj_qty;
                    dto.location = nbrWithCode4.location;

                    const sumQty: number = (Number(nbrWithCode4.orig_qty)) + (Number(nbrWithCode4.adj_qty));        
                    ihtType = sumQty > 0 ? '1UU' : sumQty == 0 ? '1UD' : '';

                    this.logger.logError(`procesaGrupo - group_nbr = ${dto.group_nbr} - OPCIÓN 3`);
                  }        
                }

                this.logger.logError(`procesaGrupo - dto con datos de acuerdo a lógica - dto = ${JSON.stringify(dto, null, 2)}`);
                this.logger.logError(`procesaGrupo - ihtType = ${ihtType}`);
                
                const tramaKisoft = await this.buildTramaKisoft(dto, ihtType);

                this.logger.logError(`buildTramaKisoft - group_nbr ${dto.group_nbr} - tramaKisoft = ${tramaKisoft}`);

                if(tramaKisoft && tramaKisoft.length > 0) {
                  const tramaLentgh = tramaKisoft.length + 5;
                  const formatKisoft = `${this.textService.padText(tramaLentgh.toString(), 5, '0')}${tramaKisoft}`;

                  this.logger.logError(`tramaKisoft del group_nbr ${dto.group_nbr} a enviarse = ${formatKisoft}`);
                  
                  const traceId = await this.traceService.create("IHT", formatKisoft, JSON.stringify(dto, null, 2));

                  this.logger.logError(`procesaGrupo - group_nbr ${dto.group_nbr}  - public.trace.traceId = ${traceId}`);

                  await this.tcpService.sendMessage(traceId, formatKisoft, 'IHT');
      
                  this.logger.logError(`tramaKisoft  - group_nbr = ${dto.group_nbr} - traceId = ${traceId} - enviada con exito`);
                }      
                
              }
            }
            catch(error) {
              this.logger.logError(`Error al crear trama antes de enviar sendToKisoft, error: ${error.message}`, error.stack);
            }
        }
        else {
          this.logger.logError(`Objeto dto vacío`);
        }
      }
    }
    catch(error) {
      this.logger.logError(`Error al recorrer datos antes de enviar sendToKisoft, error: ${error.message}`, error.stack);
    }
  }

  private async buildTramaKisoft(createIhtDto: CreateIhtDto, ihtType: string): Promise<string> {
    try
    {
      const ihtConfig = ihtKisoftConfig;
      let partsTrama: string[] = [];

      if(ihtType == '1UN' || ihtType == '1UU') {
        for (const config of ihtConfig) {
          if(config.field != undefined) {
  
            switch (config.field) {
              case 'iht_type': {
                partsTrama.push(ihtType);
                break;
              }
              case 'lpn_nbr': {              
                const valueField = createIhtDto.lpn_nbr;
                partsTrama.push(this.textService.padText(valueField, config.longitud));
                break;
              }
              case 'location': {
                this.logger.logError(`procesaGrupo - group_nbr = ${createIhtDto.group_nbr} - location = ${createIhtDto.location}`);
                const articles = await this.articleService.findByMascara(createIhtDto.location);

                this.logger.logError(`procesaGrupo - group_nbr = ${createIhtDto.group_nbr} - articles = ${JSON.stringify(articles, null, 2)}`);
                const articlesFilter = this.removeDuplicatesCustomFiled(articles);
                const article = articlesFilter[0];

                if(article != null) {
                  partsTrama.push(this.textService.padText(article.Zona_Asig, 3));
                  partsTrama.push(this.textService.padText(article.Cod_Barra_Ubicacion, 16));
                }
                else {
                  partsTrama.push(this.textService.padText('', 3));
                  partsTrama.push(this.textService.padText('', 16));
                }
                break;
              }
              case 'seq_nbr': {              
                const ihtList = await this.ihtRepository.find({ 
                  where: { 
                      group_nbr: createIhtDto.group_nbr,
                      seq_nbr: createIhtDto.seq_nbr
                  } 
                });

                this.logger.logError(`procesaGrupo - group_nbr = ${createIhtDto.group_nbr} - ihtList = ${JSON.stringify(ihtList, null, 2)}`);
  
                if(ihtList != null){
                  partsTrama.push(this.textService.padText(ihtList.length.toString(), config.longitud, '0'));
                }
                break;
              }
              case 'item_code': {              
                const valueField = createIhtDto.item_code;
                partsTrama.push(this.textService.padText(valueField, config.longitud));
                break;
              }
              case 'ref_value_1': {        
                const valueField = createIhtDto.ref_value_1;
                partsTrama.push(this.textService.padText(valueField, config.longitud));
                break;
              }
              case 'orig_qty': {        
                const valueField = ihtType == '1UU' ? (Number(createIhtDto.orig_qty) + Number(createIhtDto.adj_qty)) : createIhtDto.orig_qty;
                partsTrama.push(this.textService.padText(valueField.toString(), config.longitud, '0'));
                break;
              }
              case 'lock_code': {              
                const valueField = createIhtDto.lock_code;
                
                if(valueField == undefined || valueField.trim() == '') {
                  partsTrama.push(this.textService.padText("00", config.longitud))
                }
                else {
                  partsTrama.push(this.textService.padText("01", config.longitud))
                }
                break;
              }
            }
          }
          else {
            partsTrama.push(config.value);
          }
        };
      }
      else {
        if(ihtType =='1UD') {
          partsTrama.push(`${ihtType}14${this.textService.padText(createIhtDto.lpn_nbr, 14)}`);
        }
      }

      this.logger.logError(`procesaGrupo - group_nbr = ${createIhtDto.group_nbr} - partsTrama = ${JSON.stringify(partsTrama, null, 2)}`);

      return partsTrama.join('');
    }
    catch(error) {
      this.logger.logError(`Error al construir trama kisoft - group_nbr = ${createIhtDto.group_nbr}, error: ${error.message}`, error.stack);
      return '';
    }
  }

  removeDuplicates(objects: CreateIhtDto[]): CreateIhtDto[] {
    const uniqueObjects = new Map();

    objects.forEach((obj) => {
      uniqueObjects.set(obj.group_nbr, obj);
    });

    return Array.from(uniqueObjects.values());
  }

  removeDuplicatesTwoKeys(objects: CreateIhtDto[]): CreateIhtDto[] {
    const seen = new Set();
    return objects.filter(item => {
      const compositeKey = `${item['group_nbr']}|${item['activity_code']}`;
      if (seen.has(compositeKey)) {
        return false;
      }
      seen.add(compositeKey);
      return true;
    });
  }

  removeDuplicatesCustomFiled(data: Article[]): Article[] {
    const uniqueMap = new Map();

    data.forEach((item: Article) => {
      const key = `${item.Zona_Asig}-${item.Cod_Barra_Ubicacion}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    return Array.from(uniqueMap.values());
  }

  removeWhitespaces(input: any): any {
    if (typeof input === 'string') {
      return input.replace(/\s+/g, '');
    }
    return input;
  }
}

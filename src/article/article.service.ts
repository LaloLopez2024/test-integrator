import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { Article } from './entities/article.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { TcpService } from 'src/shared/service/tcp-service';
import { articleWmsConfig } from './mapping/article-wms-config';
import { articleKisoftConfig } from './mapping/article-kisoft-config';
import { TextService } from 'src/shared/service/text.service';
import { FileRemoveService } from 'src/shared/service/file-remove.service';
import { FileTrackerService } from 'src/shared/service/file-tracker.service';
import { LoggerService } from 'src/shared/logger/logger.service';
import * as iconv from 'iconv-lite';
import { TraceService } from 'src/trace/trace.service';
import { HeartbeatService } from 'src/shared/service/heartbeat.service';

@Injectable()
export class ArticleService {
  private readonly kisoftPort = +process.env.KISOFT_IN_PORT

  constructor(
    @InjectRepository(Article)
    private readonly articleRepository:  Repository<Article>,
    private readonly tcpService: TcpService,
    private readonly textService: TextService,
    private readonly fileRemoveService: FileRemoveService,
    private readonly fileTrackerService: FileTrackerService,
    private readonly traceService: TraceService,
    private readonly logger: LoggerService
  ){}

  async iniciarProceso(tramas: string[]) {
    setImmediate(async () => {
      await this.procesaTramas(tramas);
    });
  }

  async procesaTramas(tramas: string[]) {
   
    if(tramas) {
      try {
        await this.tcpService.sendMessage(0, '00008141', 'ARTICLE');
        await this.traceService.create("ARTICLE", '00008141', null);
  
        for(const trama of tramas) {
          try
          {
            this.logger.logError(`tramaKisoft enviada = ${trama}`);
  
            const traceId = await this.traceService.create("ARTICLE", trama, '');
            this.logger.logError(`traceId = ${traceId}`);
            
            await this.tcpService.sendMessage(traceId, trama, 'ARTICLE');
          }
          catch(error) {
            this.logger.logError(`Error al procesar trama para enviar a kisoft, error: ${error.message}`, error.stack);
          } 
        }
  
        await this.tcpService.sendMessage(0, '00008149', 'ARTICLE');
        await this.traceService.create("ARTICLE", '00008149', null);
      }
      catch(error) {
        this.logger.logError(`Error al procesar trama para enviar a kisoft, error: ${error.message}`, error.stack);
      }
    }
  }

  async processFileWMS(data: any[], fileName: string) {
    try {
      this.fileTrackerService.removeItem(fileName);

      const createArticleDtoList = this.buildDTOFromDataFile(data);
      this.logger.logError("createArticleDtoList", JSON.stringify(createArticleDtoList, null, 2));

      console.log("articles cantidad", createArticleDtoList.length);
      if(createArticleDtoList.length > 0) {
        const articleList = await this.saveArticles(createArticleDtoList);

        this.logger.logError("createArticleDtoList - saveArticles", JSON.stringify(articleList, null, 2));
  
        const processedData = this.applyBusinessLogic(articleList);
        
        console.log("articles cantidad a enviar", processedData.length);
        console.log("processedData", processedData);
        await this.sendToKisoft(processedData);
      }

      this.fileRemoveService.addFile(fileName);
      
    }
    catch(error) {
      this.logger.logError(`Ocurrió un error en el método processFileWMS, error: ${error.message}`, error.stack);
    }
  }

  private buildDTOFromDataFile(data: any[]) : CreateArticleDto[]{
    try
    {
      this.logger.logError("buildDTOFromDataFile:", JSON.stringify(data, null, 2));
      

      if (data instanceof Array && data.length > 0) {
        const arcticleConfig = articleWmsConfig;
        const createArticleDtoList: CreateArticleDto[] = [];
        let index = 0;

        data.forEach(value => {

          const validObj = Object.keys(value);

          if(validObj.length == 1) {
            this.logger.logError("ERROR EN FORMATO DE ARCHIVO CSV");
            return [];
          }

          index = index + 1;

          const createArticleDto = new CreateArticleDto();
    
          arcticleConfig.forEach(item => { 
            const valueItem = value[item.field];
            if(valueItem != '' && valueItem != undefined){
              createArticleDto[item.field] = valueItem;
            }          
          });

          createArticleDtoList.push(createArticleDto);
        });
    
        return createArticleDtoList;
      }
      else {
        this.logger.logError("No se leyeron datos del archivo");
        return [];
      }
    }
    catch(error){
      this.logger.logError(`Ocurrió un error en buildDTOFromDataFile, error: ${error.message}`, error.stack);
    }    
  }

  private async saveArticles(data: CreateArticleDto[]) : Promise<CreateArticleDto[]>{
    this.logger.logError("saveArticles");
    const listArticles : CreateArticleDto[] = [];
    try
    {
      for(const dto of data) {
        try 
        {
          this.logger.logError("saveArticles - dto", JSON.stringify(dto, null, 2));

          const article = await this.articleRepository.findOne({ 
            where: { 
              Cod_Barra_Ubicacion: dto.Cod_Barra_Ubicacion,
              Cod_Alt_Producto: dto.Cod_Alt_Producto              
            } 
          });
  
          if(article != null || article != undefined) {           
            article.Area = dto.Area;
            article.Pasillo = dto.Pasillo;
            article.Bahia = dto.Bahia;
            article.Posicion = dto.Posicion;
            article.Nivel = dto.Nivel;
            article.Zona_Asig = dto.Zona_Asig;
            article.Cod_Eyeccion = dto.Cod_Eyeccion;
            article.Cantidad_Max = dto.Cantidad_Max;
            article.Longitud = dto.Longitud;
            article.Ancho = dto.Ancho;
            article.Altura = dto.Altura;
            article.Descripcion = dto.Descripcion;
            article.Unds_Min = dto.Unds_Min;
            article.Unds_Max = dto.Unds_Max;
            article.Texto_Corto = dto.Texto_Corto;
            article.Pick_Sequence = dto.Pick_Sequence;
            article.Mascara = dto.Mascara;
            article.Cod_Barra_2 = dto.Cod_Barra_2;
            article.Cod_Barra_Producto = dto.Cod_Barra_Producto;
            article.ModifiedDate = new Date();
            article.ModifiedUser = 3
            
            await this.articleRepository.save(article);
          }
          else {  
            dto.CreatedDate = new Date();
            dto.CreatedUser = 3
            const articleEntity = this.articleRepository.create(dto);
  
            await this.articleRepository.save(articleEntity);
          }

          const valid14D = await this.articleRepository
          .createQueryBuilder('article')
          .where('article.Cod_Barra_Ubicacion = :ubicacion', { ubicacion: dto.Cod_Barra_Ubicacion })
          .andWhere('article.Cod_Alt_Producto != :codigo', { codigo: dto.Cod_Alt_Producto })
          .orderBy('COALESCE(article."ModifiedDate", article."CreatedDate")', 'DESC')
          .getOne();

          this.logger.logError("valid14D", JSON.stringify(valid14D, null, 2));
          dto.Send14D = valid14D != null ? true : false;

          if(dto.Send14D) {
            dto.Delete_Cod_Alt_Producto = valid14D.Cod_Alt_Producto;
            dto.Delete_Zona_Asig = valid14D.Zona_Asig;
          }
          
          listArticles.push(dto);
        }
        catch(error){
          this.logger.logError(`Ocurrió un error en saveArticles recorriendo datos, error: ${error.message}`, error.stack);
        }        
      }

      return listArticles;
    }
    catch(error){
      this.logger.logError(`Ocurrió un error en saveArticles, error: ${error.message}`, error.stack);
    }
  }

  private applyBusinessLogic(data: CreateArticleDto[]): CreateArticleDto[] {
    try
    {
      var processedData: CreateArticleDto[] = [];
      this.logger.logError("applyBusinessLogic - data", JSON.stringify(data, null, 2));
      var duplicados = this.findDuplicates(data, ['Cod_Barra_Ubicacion','Cod_Alt_Producto']);

      this.logger.logError("applyBusinessLogic - duplicados", JSON.stringify(duplicados, null, 2));

      data.forEach(dto => {
        var index = duplicados.findIndex(a => a.Cod_Barra_Ubicacion == dto.Cod_Barra_Ubicacion && a.Cod_Alt_Producto == dto.Cod_Alt_Producto);

        this.logger.logError(`applyBusinessLogic - index=${index}`);

        if(index >= 0) {
          var indexProcesados = processedData.findIndex(a => a.Cod_Barra_Ubicacion == dto.Cod_Barra_Ubicacion && a.Cod_Alt_Producto == dto.Cod_Alt_Producto);
          this.logger.logError(`applyBusinessLogic - indexProcesados=${indexProcesados}`);

          if(indexProcesados == -1) {
            var dataDuplicados = duplicados.filter(a => a.Cod_Barra_Ubicacion == dto.Cod_Barra_Ubicacion && a.Cod_Alt_Producto == dto.Cod_Alt_Producto);
            var codBarraFinal = '';

            this.logger.logError("applyBusinessLogic - dataDuplicados", JSON.stringify(dataDuplicados, null, 2));

            dataDuplicados.forEach(item => {
              codBarraFinal += this.textService.padText(item.Cod_Barra_Producto ?? '', 20, '0');   
            });

            this.logger.logError(`codBarraFinal = ${codBarraFinal}`);

            dto.Cod_Barra_Producto = codBarraFinal;
            dto.Cant_Codigos = dataDuplicados.length;
            processedData.push(dto);
          }
        }
        else {
          dto.Cant_Codigos = 1;
          processedData.push(dto);
        }
      });

      this.logger.logError("applyBusinessLogic - processedData", JSON.stringify(processedData, null, 2));
      
      return processedData;
    }
    catch(error){
      this.logger.logError(`Ocurrió un error en saveArticles, error: ${error.message}`, error.stack);
    }
  }

  private buildTramaKisoft(createArticleDto: CreateArticleDto): string {
    try
    {
      const articleConfig = articleKisoftConfig;
      const partsTrama: string[] = [];

      articleConfig.forEach(config => {
        var defaultValue = (config.type != undefined && config.type == 'numeric') ? '0' : ' ';

        if(config.field != undefined) {

          let valueField = '0';
          
          if(config.field == 'Cod_Barra_Producto_Count') {
            if(createArticleDto.Cant_Codigos) {
              valueField = createArticleDto.Cant_Codigos.toString();
            } 
            else {
              if(createArticleDto.Cod_Barra_Producto != undefined) {
                valueField = '1';
              }
            }
          }
          else {
            const value = this.cleanText(createArticleDto[config.field] ?? '');
            valueField = this.validateLength(value, config.maxLength ?? 0)
          }

          partsTrama.push(this.textService.padText(valueField, config.longitud, defaultValue));
        }
        else {
          partsTrama.push(this.textService.padText(config.value, config.longitud, defaultValue));
        }
      });

      this.logger.logError(`buildTramaKisoft - partsTrama`, JSON.stringify(partsTrama, null, 2));
  
      return partsTrama.join('');
    }
    catch(error) {
      this.logger.logError(`Error al construir trama kisoft, error: ${error.message}`, error.stack);
    }
  }

  private buildTrama14DKisoft(createArticleDto: CreateArticleDto): string {
    const partsTrama: string[] = [];
    partsTrama.push("14D0010040316");
    partsTrama.push(this.textService.padText(createArticleDto.Delete_Cod_Alt_Producto, 10));
    partsTrama.push("0001");
    partsTrama.push(this.textService.padText(createArticleDto.Delete_Zona_Asig, 3, '0'));
    partsTrama.push(this.textService.padText(createArticleDto.Cod_Barra_Ubicacion, 16));

    this.logger.logError(`buildTrama14DKisoft - partsTrama`, JSON.stringify(partsTrama, null, 2));
  
    return partsTrama.join('');
  }


  private async sendToKisoft(data: CreateArticleDto[]) {    
    this.logger.logError(`INGRESO A sendToKisoft`);

    try
    {
      let datosProcesados: string[] = [];
      if(data) {        
        await this.tcpService.sendMessage(0, '00008141', 'ARTICLE');
        await this.traceService.create("ARTICLE", '00008141', null);
  
        this.logger.logError(`INICIA RECORRIDO DE DATOS data.length = ${data!.length}`);

        for(const dto of data) {
          try
          {
            if(dto.Send14D) {
              const trama14DKisoft = this.buildTrama14DKisoft(dto);
              await this.sendTrama(trama14DKisoft, dto);
            }

            const duplicado = datosProcesados.includes(dto.Cod_Barra_Ubicacion + dto.Cod_Alt_Producto);
            
            this.logger.logError(`dto.Cod_Barra_Ubicacion + dto.Cod_Alt_Producto: ${dto.Cod_Barra_Ubicacion + dto.Cod_Alt_Producto}`);
            this.logger.logError(`duplicado: ${duplicado}`);

            if(!duplicado) {
              datosProcesados.push(dto.Cod_Barra_Ubicacion + dto.Cod_Alt_Producto);
              const tramaKisoft = this.buildTramaKisoft(dto);
              await this.sendTrama(tramaKisoft, dto);              
            }

            this.logger.logError(`datosProcesados`, JSON.stringify(datosProcesados, null, 2));
          }
          catch(error) {
            this.logger.logError(`Error al procesar trama para enviar a kisoft, error: ${error.message}`, error.stack);
          }         
        }

        this.logger.logError(`TERMINA RECORRIDO DE DATOS data.length = ${data!.length}`);

        await this.tcpService.sendMessage(0, '00008149', 'ARTICLE');
        await this.traceService.create("ARTICLE", '00008149', null);
      }    
    }
    catch(error) {
      this.logger.logError(`Error al enviar tramas a kisoft en método sendToKisoft, error: ${error.message}`, error.stack);
    }
  }

  private async sendTrama(trama:  string, dto: CreateArticleDto){
    const tramaLentgh = trama.length + 5;
    const formatKisoft = `${this.textService.padText(tramaLentgh.toString(), 5, '0')}${trama}`;
    this.logger.logError(`tramaKisoft enviada = ${formatKisoft}`);

    const traceId = await this.traceService.create("ARTICLE", formatKisoft, JSON.stringify(dto, null, 2));
    this.logger.logError(`traceId = ${traceId}`);
    
    await this.tcpService.sendMessage(traceId, formatKisoft, 'ARTICLE');
  }

  private validateLength(text: string, maxLength: number) : string {
    if (text.length <= maxLength) {
      return text;
    } else {
      return text.slice(-maxLength);
    }
  }

  private cleanText(text: string) {
    return text.replace(/[^a-zA-Z0-9-_]/g, '');
  }

  private findDuplicates<T>(array: T[], keys: (keyof T)[]): T[] {
    const map = new Map<string, T[]>();

    for (const item of array) {
      const key = keys.map((k) => item[k]).join('|');
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(item);
    }

    return Array.from(map.values()).filter((items) => items.length > 1).flat();
  }

  async findByMascara(mascara: string) {
    return await this.articleRepository.find({ 
        where: { 
            Mascara: mascara
        } 
      });
  }

  findAll() {
    return `This action returns all article`;
  }

  findOne(id: number) {
    return `This action returns a #${id} article`;
  }

  update(id: number, updateArticleDto: UpdateArticleDto) {
    return `This action updates a #${id} article`;
  }

  remove(id: number) {
    return `This action removes a #${id} article`;
  }

  async findByCodBarra2(ocodBarra2: string){
    return await this.articleRepository.findOne({ 
        where: { 
          Cod_Barra_2: ocodBarra2
        } 
      });
  }

  async findByCodBarraUbicacion(CodbarraUbicacion: string){
    return await this.articleRepository.findOne({ 
        where: { 
          Cod_Barra_Ubicacion: CodbarraUbicacion
        } 
      });
  }

  async findByKeys(CodbarraUbicacion: string, CodAltProducto: string){
    return await this.articleRepository.findOne({ 
        where: { 
          Cod_Barra_Ubicacion: CodbarraUbicacion,
          Cod_Alt_Producto: CodAltProducto
        } 
      });
  }

  async findAddByKeys(data: any) {
    return await this.articleRepository.find({
      where: data.map(dto => ({
        Cod_Barra_Ubicacion: dto.allocated_location,
        Cod_Alt_Producto: dto.part_a
      })),
    });
  }
}

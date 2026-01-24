import { Injectable } from '@nestjs/common';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { Route } from './entities/route.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TcpService } from 'src/shared/service/tcp-service';
import { TextService } from 'src/shared/service/text.service';
import { RouteKisoftConfig } from './mapping/route-kisoft.config';
import { RouteWmsConfig } from './mapping/route-wms-config';
import { FileRemoveService } from 'src/shared/service/file-remove.service';
import { FileTrackerService } from 'src/shared/service/file-tracker.service';
import { LoggerService } from 'src/shared/logger/logger.service';
import { TraceService } from 'src/trace/trace.service';
import { HeartbeatService } from 'src/shared/service/heartbeat.service';

@Injectable()
export class RouteService {

  constructor(
    @InjectRepository(Route)
    private readonly routeRepository:  Repository<Route>,
    private readonly tcpService: TcpService,
    private readonly textService: TextService,
    private readonly fileRemoveService: FileRemoveService,
    private readonly fileTrackerService: FileTrackerService,
    private readonly traceService: TraceService,
    private readonly logger: LoggerService
    
  ){}

  async procesaTramas(tramas: string[]) {
   
    if(tramas) {
      try {
        await this.tcpService.sendMessage(0, '00008161', 'ROUTE');
        await this.traceService.create("ROUTE", '00008161', null);
  
        for(const trama of tramas) {
          try
          {
            this.logger.logError(`tramaKisoft enviada = ${trama}`);
  
            const traceId = await this.traceService.create("ROUTE", trama, '');
            this.logger.logError(`traceId = ${traceId}`);
            
            await this.tcpService.sendMessage(traceId, trama, 'ROUTE');
          }
          catch(error) {
            this.logger.logError(`Error al procesar trama para enviar a kisoft, error: ${error.message}`, error.stack);
          } 
        }
  
        await this.tcpService.sendMessage(0, '00008169', 'ROUTE');
        await this.traceService.create("ROUTE", '00008169', null);
      }
      catch(error) {
        this.logger.logError(`Error al procesar trama para enviar a kisoft, error: ${error.message}`, error.stack);
      }  
    }
  }

  async processFileWMS(data: any[], fileName: string) {
    try
    {
      this.fileTrackerService.removeItem(fileName);

      const  createRouteDtoList = this.buildDTOFromDataFile(data);
      this.logger.logError(`rutas cantidad = ${createRouteDtoList.length}`);

      var processedData = this.applyBusinessLogic(createRouteDtoList);

      this.logger.logError(`rutas cantidad a enviarcls = ${processedData.length}`);

      await this.saveRoutes(processedData);      

      await this.sendToKisoft(processedData);
      
      this.fileRemoveService.addFile(fileName);
    }
    catch(error) {
      this.logger.logError(`Error al procesar datos de route WMS, error: ${error.message}`, error.stack);
    }
  }

  create(createRouteDto: CreateRouteDto) {
    return 'This action adds a new route';
  }

  findAll() {
    return `This action returns all route`;
  }

  async findByRuta(ruta: string) {
    return await this.routeRepository.findOne({ 
      where: { 
          RUTA: ruta
      } 
    });
  }

  update(id: number, updateRouteDto: UpdateRouteDto) {
    return `This action updates a #${id} route`;
  }

  remove(id: number) {
    return `This action removes a #${id} route`;
  }

  private buildDTOFromDataFile(data: any[]) : CreateRouteDto[]{
    const config = RouteWmsConfig;
    const createRouteDtoList: CreateRouteDto[] = [];

    data.forEach(value => {
      const createRouteDto = new CreateRouteDto();

      config.forEach(item => {  
        const valueItem = value[item.field];

        if(valueItem != '' && valueItem != undefined){
          createRouteDto[item.field] = valueItem;
        }          
      });   
      
      createRouteDtoList.push(createRouteDto);
    });

    return createRouteDtoList;
  }

  private applyBusinessLogic(data: CreateRouteDto[]): CreateRouteDto[] {
    var processedData: CreateRouteDto[] = [];

    data.forEach(async dto => {
      var index = processedData.findIndex(r => r.RUTA == dto.RUTA);
      
      if(index < 0) {
        processedData.push(dto);
      }
    });

    return processedData;
  }

  private async saveRoutes(data: CreateRouteDto[]) {
    data.forEach(async dto => {
      const route = await this.routeRepository.findOne({ 
        where: { 
          RUTA: dto.RUTA
        } 
      });

      this.logger.logError("saveRoutes - route", JSON.stringify(route, null, 2));

      if(route != null || route != undefined) {
        this.logger.logError("OP1");
        route.Activo = dto.Activo;
        route.HDR_CUST1 = dto.HDR_CUST1;
        route.HDR_CUST2 = dto.HDR_CUST2;
        route.HDR_CUST3 = dto.HDR_CUST3;
        route.HDR_CUST4 = dto.HDR_CUST4;
        route.Mod = dto.Mod;
        route.Parada = dto.Parada;
        route.DTL_CUST_1 = dto.DTL_CUST_1;
        route.DTL_CUST_2 = dto.DTL_CUST_2;
        route.ModifiedDate = new Date();
        route.ModifiedUser = 3;

        await this.routeRepository.save(route);
      }
      else {
        this.logger.logError("OP2");
        dto.CreatedDate = new Date();
        dto.CreatedUser = 3;

        const routeEntity = this.routeRepository.create(dto);
        await this.routeRepository.save(routeEntity);
      }      
    });
  }

  private buildTramaKisoft(createRouteDto: CreateRouteDto): string {
    try
    {
      const config = RouteKisoftConfig;
      const partsTrama: string[] = [];

      config.forEach(config => {
        if(config.field) {  
          

          if(config.field == 'HDR_CUST1'){
            const cust1 = this.textService.padText(createRouteDto.HDR_CUST1, config.longitud);
            const cust2 = this.textService.padText(createRouteDto.HDR_CUST2, config.longitud);

            partsTrama.push(`${cust1}${cust2}`);
          }
          else {
            const value = (createRouteDto[config.field] ?? '').replace(/:/g, '');
            partsTrama.push(this.textService.padText(value, config.longitud));
          }          
        }
        else {
          partsTrama.push(config.value);
        }
      });

      this.logger.logError("partsTrama", JSON.stringify(partsTrama, null, 2));
  
      return partsTrama.join('');
    }
    catch(error) {
      this.logger.logError(`Error al construir trama kisoft, error: ${error.message}`, error.stack);
    }
  }

  private async sendToKisoft(data: CreateRouteDto[]) {
    if(data) {
      await this.tcpService.sendMessage(0, '00008161', 'ROUTE');

      for(const dto of data) {
        //Se construye trama y se envía a puerto Kisoft
        const tramaKisoft = this.buildTramaKisoft(dto);
        const tramaLentgh = tramaKisoft.length + 5;
        const formatKisoft = `${this.textService.padText(tramaLentgh.toString(), 5, '0')}${tramaKisoft}`;

        this.logger.logError("tramaKisoft enviada", formatKisoft);

        const traceId = await this.traceService.create("ROUTE", formatKisoft, JSON.stringify(dto, null, 2));

        await this.tcpService.sendMessage(traceId, formatKisoft, 'ROUTE');
      };

      await this.tcpService.sendMessage(0, '00008169', 'ROUTE');
    }
  }
}

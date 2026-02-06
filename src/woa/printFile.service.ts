import { Injectable } from "@nestjs/common";
import { ApiService } from '../shared/service/api.service';
import { CreateWoaDto } from './dto/create-woa.dto';
import { ResponseDataShippingDto } from "./dto/response-data-shipping.dto";
import * as fs from 'fs';
import * as path from 'path';
import { LoggerService } from "src/shared/logger/logger.service";
import { SftpPrintService } from "src/shared/service/sftp-print-service";
import { TextService } from "src/shared/service/text.service";
import { SequenceService } from "./secuence.service";
import { SequenceDetailService } from "./secuence-detail.service";
import { WoaCalculationService } from "./woa-calculation.service";
import { WoaConfigService } from "./config/woa-config.service";


@Injectable()
export class PrintFileService {
    private readonly printFileDirectory = process.env.DIRECTORY_PRINT_FILES;
    
    constructor(private readonly apiService: ApiService,
                private readonly sftpService: SftpPrintService,
                private readonly logger: LoggerService,
                private readonly textService: TextService,
                private readonly sequenceService: SequenceService,
                private readonly sequenceDetailService: SequenceDetailService,
                private readonly woaCalculationService: WoaCalculationService,
                private readonly woaConfigService: WoaConfigService,
    ){}
    
    async generatePrintFile(data: CreateWoaDto[]) {
      if (!data || data.length === 0) {
        this.logger.logError(`generatePrintFile - No se recibieron datos para procesar`);
        return;
      }

      if (!data[0] || !data[0].facility_code) {
        this.logger.logError(`generatePrintFile - Error: facility_code no está disponible en los datos recibidos`);
        return;
      }

      const facilityCode = data[0].facility_code;
      const oblpnList:string[] = [];
      
      try
      {
        for (const dto of data) {
          this.logger.logError(`generatePrintFile - action_code = ${dto.action_code} - oblpn= ${dto.oblpn} - ob_lpn_type = ${dto.ob_lpn_type} - flg_print = ${dto.flg_print}`);
          
          if (dto.action_code === 'CREATE' && !this.validateNullString(dto.oblpn)) {
            if (dto.flg_print === true) {
              this.logger.logError(`generatePrintFile - oblpn= ${dto.oblpn} agregado (flg_print=true)`);
              oblpnList.push(dto.oblpn);
            } else {
              this.logger.logError(`generatePrintFile - oblpn= ${dto.oblpn} NO agregado (flg_print=false o undefined)`);
            }
          }
        }
        this.logger.logError(`generatePrintFile - oblpnList = ${JSON.stringify(oblpnList, null, 2)}`);

        if (oblpnList.length > 0) {
          const uniqueArray = Array.from(new Set(oblpnList));

          this.logger.logError(`generatePrintFile - oblpnList.length = ${uniqueArray.length}`);
          const chunkSize = 40;
          const chunks = [];

          for (let i = 0; i < uniqueArray.length; i += chunkSize) {
            chunks.push(uniqueArray.slice(i, i + chunkSize));
          }
          this.logger.logError(`generatePrintFile - chunks = ${JSON.stringify(chunks, null, 2)}`);

          for (const chunk of chunks) {
            const cartones = chunk.join(',');
            this.logger.logError(`generatePrintFile - cartones = ${cartones}`);

            await this.getDataShipping('Etiq_Env_Kisoft_V2', facilityCode, 'BOFASA', cartones, uniqueArray.length, chunk);
          }
        }
      }
      catch(error) {
        this.logger.logError(`Error al generar archivo de impresión, error: ${error.message}`, error.stack);
      }      
    }

    async validateEstacion152(dto: CreateWoaDto, data: CreateWoaDto[]) {
      try
      {
        this.logger.logError(`validateEstacion152 - oblpn:${dto.oblpn} - ob_lpn_type:${dto.ob_lpn_type}`);

        // Obtener los tipos configurados desde la tabla de parámetros del sistema
        const configuredObLpnTypes = await this.woaConfigService.getObLpnTypes();
        
        if(configuredObLpnTypes.includes(dto.ob_lpn_type)) {          
          const sumaVolumenLinea = this.woaCalculationService.getSumaVolumenLinea(data, dto.oblpn);
          this.logger.logError(`validateEstacion152 - oblpn:${dto.oblpn} - sumaVolumenLinea = ${sumaVolumenLinea}`);

          const threshold = await this.woaConfigService.getVolumenLineaThreshold();
          if(sumaVolumenLinea > threshold) {
            const sequenceDetailService = await this.sequenceDetailService.findByObLpnType(dto.ob_lpn_type);
            this.logger.logError(`validateEstacion152 - oblpn:${dto.oblpn} - sequenceDetailService = ${JSON.stringify(sequenceDetailService, null, 2)}`);
            const sequence = await this.sequenceService.findById(sequenceDetailService.sequenceId);
            this.logger.logError(`validateEstacion152 - oblpn:${dto.oblpn} - sequence = ${JSON.stringify(sequence, null, 2)}`);
            return sequence.SEC3 === '152';
          }
          return false;
        }
        else
          return true;
      }
      catch(error) {
        this.logger.logError(`validateEstacion152 - Error al obtener la secuencia, error: ${error.message}`, error.stack);
      }      
    }

    async getDataShipping(label_designer_code: string, facility_id__code: string, company_id__code: string, container_nbr__in: string, data_count: number, requestedOblpns: string[] = []) {
      try
      {
        this.logger.logError(`getDataShipping label_designer_code = ${label_designer_code}`);
        this.logger.logError(`getDataShipping facility_id__code = ${facility_id__code}`);
        this.logger.logError(`getDataShipping company_id__code = ${company_id__code}`);
        this.logger.logError(`getDataShipping container_nbr__in = ${container_nbr__in}`);

        const headers = {
          'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(`${process.env.API_WMS_USER}:${process.env.API_WMS_PASSWORD}`).toString('base64')}`
          };

        const url = `${process.env.SHIPPING_URL}?label_designer_code=${encodeURIComponent(label_designer_code)}&facility_id__code=${encodeURIComponent(facility_id__code)}&company_id__code=${encodeURIComponent(company_id__code)}&container_nbr__in=${encodeURIComponent(container_nbr__in)}`;
        this.logger.logError(`URL SHIPPING: ${url}`);
        const response = await this.apiService.requestWithRetriesTime('GET', url, { headers : headers }, data_count > 200);

        if(response) {
          this.logger.logError(`getDataShipping response = ${JSON.stringify(response, null, 2)}`);

          const data = this.mapResponse(response);
          this.logger.logError(`getDataShipping data = ${JSON.stringify(data, null, 2)}`);

          // Track which OBLPNs were found in the response
          const foundOblpns = new Set<string>();
          for(const shipping of data){
            foundOblpns.add(shipping.id);
            await this.savePrintAndUploadFile(shipping.id, shipping.value);
          }

          // Log OBLPNs that were requested but not found in the response
          if (requestedOblpns && requestedOblpns.length > 0) {
            const missingOblpns = requestedOblpns.filter(oblpn => !foundOblpns.has(oblpn));
            if (missingOblpns.length > 0) {
              this.logger.logError(`getDataShipping - OBLPNs solicitados pero no encontrados en la respuesta de la API: ${JSON.stringify(missingOblpns, null, 2)}`);
            } else {
              this.logger.logError(`getDataShipping - Todos los OBLPNs solicitados fueron encontrados en la respuesta de la API`);
            }
          }
        } else {
          this.logger.logError(`getDataShipping - La respuesta de la API está vacía o es null. OBLPNs solicitados: ${JSON.stringify(requestedOblpns, null, 2)}`);
        }
      }
      catch(error) {
        this.logger.logError(`Error al generar archivo de impresión, error: ${error.message}`, error.stack);
        if (requestedOblpns && requestedOblpns.length > 0) {
          this.logger.logError(`getDataShipping - Error al obtener datos para OBLPNs: ${JSON.stringify(requestedOblpns, null, 2)}`);
        }
      }
    }

    mapResponse(apiResponse: any): ResponseDataShippingDto[] {
        const { data } = apiResponse;
        return Object.entries(data).map(([key, value]) => ({
          id: key,
          value: this.decodeBase64(value.toString()),
        }));
    }

    decodeBase64(encoded: string): string {
        return Buffer.from(encoded, 'base64').toString('utf8');
    }

    async savePrintAndUploadFile(oblpn_nbr: string, data: string): Promise<void> {
        if (!fs.existsSync(this.printFileDirectory)) {
            fs.mkdirSync(this.printFileDirectory, { recursive: true });
        }
        this.logger.logError(`savePrintAndUploadFile - oblpn_nbr = ${oblpn_nbr}`);

        const oblpn = this.textService.padText(oblpn_nbr, 10, '0');
        
        const fileName = `${oblpn}.01.008.000.01`;
        const filePath = path.join(this.printFileDirectory, fileName);
        this.logger.logError(`savePrintAndUploadFile - filePath = ${filePath}`);

        await this.createAndAppendFile(filePath, data);

        const remotePrintFilePath = path.join(process.env.SFTP_PRINT_PATH_FILES, fileName);

        await this.sftpService.uploadFile(remotePrintFilePath, filePath);

        const fileNameEnd = `${oblpn}.01.008.000.end`;
        const filePathEnd = path.join(this.printFileDirectory, fileNameEnd);
        this.logger.logError(`savePrintAndUploadFile - filePathEnd = ${filePathEnd}`);

        await this.createAndAppendFile(filePathEnd, '');

        const remotePrintFileEndPath = path.join(process.env.SFTP_PRINT_PATH_FILES, fileNameEnd);
        
        await this.sftpService.uploadFile(remotePrintFileEndPath, filePathEnd);
    }

    private async createAndAppendFile(filePath: string, content: string): Promise<void> {
        return new Promise((resolve, reject) => {
          fs.appendFile(filePath, content, { encoding: 'utf8' }, (err) => {
            if (err) {
              reject(`Error creando o agregando contenido al archivo: ${err.message}`);
            } else {
              resolve();
            }
          });
        });
    }

    validateNullString(text: string | undefined) {
      return text === undefined || (typeof text === 'string' && text.replace(/^\s+/, '').length == 0);
    }
}
import { Injectable } from "@nestjs/common";
import { TWoaResponse } from "./entities/twoa-response.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { WoaService } from "src/woa/woa.service";
import { ArticleService } from "src/article/article.service";
import { XmlService } from "src/shared/service/xml.service";
import { LoggerService } from "src/shared/logger/logger.service";
import { TraceService } from "src/trace/trace.service";
import { CreateWoaResponseDto } from "./dto/create-woa-response.dto";
import { ReturnDto } from "./dto/return.dto";
import { Woa } from "src/woa/entities/woa.entity";

interface LoteCantidad {
  lote: string,
  qty: number
}

interface WoaResumen {
  woaId: number,
  returnId: number
}

interface OblpnArticle {
  to_container_nbr: string;
  item_alternate_code: string;
  returnId: number
}

interface WoaActualizado {
  woaId: number,
  qty: number
}

@Injectable()
export class ProcessReturnService {

    constructor(
        @InjectRepository(TWoaResponse)
        private readonly woaResponseRepository:  Repository<TWoaResponse>,
        private readonly woaService: WoaService,
        private readonly articleService: ArticleService,
        private readonly xmlService: XmlService,
        private readonly logger: LoggerService,
        private readonly traceService: TraceService
    ){}

    async processReturn(trama: string) {
        this.logger.logError(`PROCESA RETURN ${trama}`);
        const toContainerNbr = trama.substring(9, 23).replace(/\s+/g, '');
        this.logger.logError(`toContainerNbr ${toContainerNbr}`);

        const seccionT = trama.substring(23, 24);
        this.logger.logError(`seccionT ${seccionT}`);
        let indexTrama = seccionT == 'T' ? 31 : 26;
        this.logger.logError(`indexTrama ${indexTrama}`);

        const loadUnitCode = trama.substring(indexTrama, indexTrama + 6).replace(/\s+/g, '');
        this.logger.logError(`loadUnitCode ${loadUnitCode}`);

        const articlesCount = trama.substring(indexTrama + 32, indexTrama + 35);
        this.logger.logError(`articlesCount ${articlesCount}`);

        const secciont2 = trama.substring(indexTrama + 6, indexTrama + 7);
        this.logger.logError(`indexTrama ${indexTrama}`);
        this.logger.logError(`secciont2 ${secciont2}`);
        let stationNumber = secciont2 == 't' ? trama.substring(indexTrama + 13, indexTrama + 16) : '000';
        this.logger.logError(`stationNumber ${stationNumber}`); 

        const sectionDetail = stationNumber == '087' ? '' : trama.slice(indexTrama + 67);
        this.logger.logError(`indexTrama ${indexTrama}`); 
        this.logger.logError(`trama ${trama}`); 
        this.logger.logError(`sectionDetail ${sectionDetail}`); 

        let returnList: CreateWoaResponseDto[] = [];
        returnList = this.procesaArticulos(sectionDetail, +articlesCount, toContainerNbr, loadUnitCode, stationNumber);        
        
        returnList = await this.saveWoaResponse(returnList);
        let xmlReturnObject: any;
        const traceId = await this.traceService.create("32R-RETURN", trama, '');

        this.logger.logError("articleList", JSON.stringify(returnList, null, 2));

        if(stationNumber != '087') {
            const data = await this.getDataToSend(returnList, traceId);
            this.logger.logError("processReturn - data", JSON.stringify(data, null, 2));

            this.logger.logError("***DESPUES DE getDataToSend- data", JSON.stringify(data, null, 2));
        
            if(data != null && data.length > 0) {
                xmlReturnObject = await this.buildXmlReturnStructure(data);
                
                this.logger.logError("xmlReturnObject", JSON.stringify(xmlReturnObject, null, 2));

                this.logger.logError("URL Return", process.env.PICK_CONFIRM_URL);
            
                await this.traceService.update(traceId, JSON.stringify(xmlReturnObject, null, 2));
        
                const response = await this.xmlService.sendSoapRequest(xmlReturnObject, process.env.PICK_CONFIRM_URL, traceId);
                this.logger.logError('SOAP response', JSON.stringify(response));
            }
        }
        else {
            this.delay(30000);
            xmlReturnObject = this.buildXmlReturnStructureShortPick(toContainerNbr, loadUnitCode, traceId);
        }
    }

    procesaArticulos(trama: string, articlesCount: number, toContainerNbr: string, loadUnitCode: string, stationNumber: string) : CreateWoaResponseDto[] {
        const articleList: CreateWoaResponseDto[] = [];
        this.logger.logError(`trama ${trama}`);
        const maxLentghArticle: number = 74;
        const tramaArticle = trama;
        let index: number = 0;

        this.logger.logError(`articlesCount ${articlesCount}`);

        if(articlesCount == 0) {
            const createPickItemDto: CreateWoaResponseDto = {
            to_container_nbr: toContainerNbr.replace(/\s+/g, ''),
            load_unit_code: loadUnitCode.replace(/\s+/g, ''),
            station_number: stationNumber,
            CreatedDate: new Date(),
            CreatedUser: 3,
            Processed: true
            }

            this.logger.logError("procesaArticulos for", JSON.stringify(createPickItemDto, null, 2));

            articleList.push(createPickItemDto);
        }
        else {
            this.logger.logError(`procesaArticulos - OPCIÓN CANTIDAD = 0 ************************************************************`);
            const details = this.getDetails(trama);
            this.logger.logError(`details`, JSON.stringify(details, null, 2));
            index = 0;

            for(const detail of details) {
                this.logger.logError(`detail = ${detail}`);
                this.logger.logError(`index = ${index}`);
                const qty = this.limpiarNumero(detail.substring(index + 44, index + 48));
                this.logger.logError(`qty = ${qty}`);
                const articleNumber = detail.substring(index, 10).replace(/\s+/g, '');
                
                this.logger.logError(`${articleNumber} - qty detail ${qty}`);
            
                if(parseInt(qty) > 0) {
                    const createPickItemDto: CreateWoaResponseDto = {
                        to_container_nbr: toContainerNbr.replace(/\s+/g, ''),
                        load_unit_code: loadUnitCode.replace(/\s+/g, ''),
                        //item_alternate_code: detail.substring(index, 10).replace(/\s+/g, ''),
                        item_alternate_code: articleNumber,
                        batch_nbr: detail.substring(index + 14, index + 44).replace(/\s+/g, ''),
                        //qty: this.limpiarNumero(detail.substring(index + 44, index + 48)),
                        qty: qty,
                        wworker: detail.substring(index + 50, index + 58).replace(/\s+/g, ''),
                        pick_location: detail.substring(index + 58, index + 74).replace(/\s+/g, ''),
                        //dispatch_ramp_number: dispatchRampNumber.trim(),
                        CreatedDate: new Date(),
                        CreatedUser: 3,
                        Processed: false
                    }
            
                    this.logger.logError("procesaArticulos for", JSON.stringify(createPickItemDto, null, 2));
            
                    articleList.push(createPickItemDto);
                } 
            }
        }

        return articleList;
    }

    async getDataToSend(data: CreateWoaResponseDto[], id: number): Promise<ReturnDto[]> {
        const list: ReturnDto[] = [];
        let listWoaToProcess: Woa[] = [];
        let detail = '';

        for (let i = 0; i < data.length; i++) {
            const dto = data[i];
            this.logger.logError(`getDataToSend - CreateWoaResponseDto`, JSON.stringify(dto, null, 2));

            const woaList = await this.woaService.findByOblpnAlternativeCode(dto.to_container_nbr, dto.item_alternate_code);
            
            //this.logger.logError(`getDataToSend - woaList`, JSON.stringify(woaList, null, 2));

            if(woaList != null) {
                //this.logger.logError("ENTRA woaList != null");
                if(woaList.length == 1) { //Casos Tipo 1 (Solo 1 retorna un woa)
                    //this.logger.logError(`getDataToSend - woa`, JSON.stringify(woaList[0], null, 2));
                    this.logger.logError(`getDataToSend - Se encontró un WOA para to_container_nbr:${dto.to_container_nbr} y item_alternate_code:${dto.item_alternate_code}`);
                    const listReturn = await this.procesaCasosTipo1(woaList[0], dto, id);

                    this.logger.logError(`***LUEGO DE procesaCasosTipo1 - dto`, JSON.stringify(dto, null, 2));
                    if(dto.Processed) {
                        data[i] = dto;
                    }
                    
                    if(listReturn != null && listReturn.length > 0) {
                        list.push(...listReturn);
                    }
                }
                else { //Casos Tipo 2 (Retorna más de un woa)
                    //this.logger.logError("ENTRA woaList != null");
                    this.logger.logError(`getDataToSend - Se encontró más de un WOA para to_container_nbr:${dto.to_container_nbr} y item_alternate_code:${dto.item_alternate_code}`);
                    listWoaToProcess = this.copyUniqueObjects(woaList, listWoaToProcess);
                }
            }
            else {
                this.logger.logError(`getDataToSend - No se encuentra datos en WOA para to_container_nbr:${dto.to_container_nbr} y item_alternate_code:${dto.item_alternate_code}`);
            }
        }

        //this.logger.logError(`getDataToSend - data`, JSON.stringify(data, null, 2)); 
        //this.logger.logError(`getDataToSend - listWoaToProcess`, JSON.stringify(listWoaToProcess, null, 2)); 


        //this.logger.logError(`getDataToSend - ReturnDto  BEFORE procesaCasosTipo2`, JSON.stringify(list, null, 2));

        const listReturn = await this.procesaCasosTipo2(listWoaToProcess, data);

        if(listReturn != null && listReturn.length > 0) {
            list.push(...listReturn);
        }

        this.logger.logError(`getDataToSend - ReturnDto list`, JSON.stringify(list, null, 2));
        
        return list;
    }

    private async saveWoaResponse(data: CreateWoaResponseDto[]) {
        for(const dto of data) {
            const woaResponseEntity = this.woaResponseRepository.create(dto);
            await this.woaResponseRepository.save(woaResponseEntity);
            dto.id = woaResponseEntity.id;
        }
    
        return data;
    }

    async buildXmlReturnStructure(list: ReturnDto[]) {
        this.logger.logError(`buildXmlReturnStructure list `, JSON.stringify(list, null, 2));

        const ListTemp = [...list];
        const oblpnProcessList = [];

        for(const dto of ListTemp) {
            if(!oblpnProcessList.includes(dto.to_container_nbr)) {
                if(dto.qty_dif) {
                    //this.logger.logError(`return con diferencia `, JSON.stringify(dto, null, 2));
                    oblpnProcessList.push(dto.to_container_nbr);
            
                    const woaList = await this.woaService.findByOblpnAlternativeCode(dto.to_container_nbr, dto.item_alternate_code);
                    const returnList = list.filter(x => x.to_container_nbr == dto.to_container_nbr && x.item_alternate_code == dto.item_alternate_code && x.pick_location == dto.pick_location);
            
                    //this.logger.logError(`return con diferencia, woaList `, JSON.stringify(woaList, null, 2));
                    //this.logger.logError(`return con diferencia, returnList `, JSON.stringify(returnList, null, 2));
            
                    if(woaList.length == 1 && returnList.length == 1) {
                        this.logger.logError(`Se completa con OPCIÓN 1`);
                        const woa = woaList[0];
                        const qty = Number(woa.qty_missing);
            
                        list.push({
                        facility_id__code: dto.facility_id__code,
                        company_id__code: dto.company_id__code,
                        wave_nbr: dto.wave_nbr,
                        order_nbr: dto.order_nbr,
                        item_alternate_code: dto.item_alternate_code,
                        batch_nbr: woa.batch_nbr,//dto.batch_nbr != undefined ? dto.batch_nbr : woaList[0].batch_nbr,
                        load_unit_code: dto.load_unit_code,
                        qty: qty.toString(),
                        orig_invn_attr_a: dto.orig_invn_attr_a,
                        invn_attr_a: dto.invn_attr_a,
                        from_container_nbr: dto.from_container_nbr,
                        to_container_nbr: dto.to_container_nbr,
                        mhe_system_code: 'KISOFT',//dto.mhe_system_code,
                        pick_location: dto.pick_location,
                        short_flg: (Number(dto.qty) < Number(woa.allocated_qty)) ? 'true' : 'false',
                        orig_batch_nbr: '',//dto.batch_nbr != woaList[0].batch_nbr ? woaList[0].batch_nbr : '',
                        orig_iblpn_nbr: '',
                        send_driver: false,
                        qty_dif: true
                        });

                        woa.cant_return = woa.allocated_qty;
                        await this.woaService.updateWOA(woa);
                    }
                    else {
                        const lotesConFaltantes: LoteCantidad[] = [];
                        const lotesSobrantes: LoteCantidad[] = [];
                        let qtySobrante = 0;
                        let qtyFaltante = 0;

                        this.logger.logError(`Se completa con OPCIÓN 2`);

                        for(const woaLote of woaList) {
                            //Se actualizan todos los lotes que vinieron con una cantidad mayor al registro en el woa
                            if(woaLote.qty_surplus > 0) {
                                //Buscar el lote en el arreglo de items a procesar
                                const returnDto = list.find(x => x.to_container_nbr == dto.to_container_nbr && x.item_alternate_code == dto.item_alternate_code && x.pick_location == dto.pick_location && x.batch_nbr == woaLote.batch_nbr);
                                const returnIndex = list.findIndex(x => x.to_container_nbr == dto.to_container_nbr && x.item_alternate_code == dto.item_alternate_code && x.pick_location == dto.pick_location && x.batch_nbr == woaLote.batch_nbr);
                                returnDto.qty = woaLote.allocated_qty.toString();
                                returnDto.qty_dif = false;  

                                //Actualizar en el arreglo el item del lote seleccionado, actualizando la cantidad con lo que está en woa.allocated_qty
                                list[returnIndex] = { ...list[returnIndex], ...returnDto };
                                
                                qtySobrante = Number(qtySobrante) + Number(woaLote.qty_surplus);

                                const searchLote = lotesSobrantes.find(l => l.lote == woaLote.batch_nbr);
                                const searchLoteIndex = lotesSobrantes.findIndex(l => l.lote == woaLote.batch_nbr);

                                if(searchLoteIndex >= 0) {
                                    lotesSobrantes[searchLoteIndex].qty = Number(lotesSobrantes[searchLoteIndex].qty) + Number(searchLote.qty);
                                }
                                else {
                                    lotesSobrantes.push({
                                        lote: woaLote.batch_nbr,
                                        qty: woaLote.qty_surplus
                                    } as LoteCantidad);
                                }                  
                            }

                            if(woaLote.qty_missing > 0) {
                                qtyFaltante = qtyFaltante + woaLote.qty_missing;

                                lotesConFaltantes.push({
                                    lote: dto.batch_nbr,
                                    qty: woaLote.qty_missing
                                } as LoteCantidad)
                            }
                        }

                        //this.logger.logError(`lotesSobrantes `, JSON.stringify(lotesSobrantes, null, 2));

                        //this.logger.logError(`lotesConFaltantes `, JSON.stringify(lotesConFaltantes, null, 2));

                        //Se agregan como sobrantes todos los lotes que llegaron y que no existen en woa
                        const lotesNoExistentes = list.filter(l => !l.lot_exists);

                        //this.logger.logError(`lotesNoExistentes `, JSON.stringify(lotesNoExistentes, null, 2));

                        //this.logger.logError(`Lista actual `, JSON.stringify(list, null, 2));

                        if(lotesNoExistentes != undefined && lotesNoExistentes.length > 0) {
                            for(const returLote of lotesNoExistentes) {
                                if(!returLote.lot_exists) {
                                    const searchLote = lotesSobrantes.find(l => l.lote == returLote.batch_nbr);
                                    const searchLoteIndex = lotesSobrantes.findIndex(l => l.lote == returLote.batch_nbr);

                                    if(searchLoteIndex >= 0) {
                                        lotesSobrantes[searchLoteIndex].qty = Number(lotesSobrantes[searchLoteIndex].qty) + Number(searchLote.qty);
                                    }
                                    else {
                                        lotesSobrantes.push({
                                            lote: returLote.batch_nbr,
                                            qty: Number(returLote.qty)
                                        } as LoteCantidad);
                                    }

                                    qtySobrante = Number(qtySobrante) + Number(returLote.qty);
                    
                                    const deleteIndex = list.findIndex(x => x.to_container_nbr == returLote.to_container_nbr && x.item_alternate_code == returLote.item_alternate_code && x.pick_location == returLote.pick_location && x.batch_nbr == returLote.batch_nbr);
                                    list.splice(deleteIndex, 1); 
                                }                
                            }
                        }        
                        
                        //this.logger.logError(`Lista sin lotes que no existen en woa `, JSON.stringify(list, null, 2));

                        //this.logger.logError(`lotesSobrantes `, JSON.stringify(lotesSobrantes, null, 2));
                        //this.logger.logError(`lotesConFaltantes `, JSON.stringify(lotesConFaltantes, null, 2));
                        //this.logger.logError(`qtySobrante = ${qtySobrante}`);

                        let lotesFaltantesPendientes = [...lotesConFaltantes];

                        //Se recorren todos los lotes faltantes para completar con los sobrantes
                        for(const loteFaltante of lotesConFaltantes){
                            //this.logger.logError(`lote faltante = ${loteFaltante.lote} `);

                            //Se obtiene el lote seleccionado
                            const woaLote = woaList.find(x => x.batch_nbr == loteFaltante.lote);
                            //this.logger.logError(`woaLote faltante = ${loteFaltante.lote} `);

                            //Cuando la cantidad total de items sobrantes cubre los items que le falta a un lote
                            //this.logger.logError(`loteFaltante `, JSON.stringify(loteFaltante, null, 2));

                            if(Number(woaLote.qty_missing) <= Number(qtySobrante)) {
                                //this.logger.logError(`Se completarán los lotes faltates con los sobrantes`);
                                const ListLote = this.getReturnStructureToComplete(loteFaltante.lote, woaLote, dto, lotesSobrantes, lotesFaltantesPendientes, list, woaLote.qty_missing);
                                qtySobrante = (qtySobrante > woaLote.qty_missing) ? qtySobrante - woaLote.qty_missing : 0;

                                list = [...ListLote];
                            }
                        }

                        //this.logger.logError(`lotesFaltantesPendientes `, JSON.stringify(lotesFaltantesPendientes, null, 2));

                        for(const loteFaltante of lotesFaltantesPendientes){
                            this.logger.logError(`lote faltante = ${loteFaltante.lote} `);

                            //Se obtiene el lote seleccionado
                            const woaLote = woaList.find(x => x.batch_nbr == loteFaltante.lote);

                            //Cuando ya no hay cantidad de items sobrantes y le falta aún items a un lote se envía un shortpick con lo que falta
                            list.push({
                            facility_id__code: dto.facility_id__code,
                            company_id__code: dto.company_id__code,
                            wave_nbr: dto.wave_nbr,
                            order_nbr: dto.order_nbr,
                            item_alternate_code: dto.item_alternate_code,
                            batch_nbr: woaLote.batch_nbr,
                            load_unit_code: dto.load_unit_code,
                            qty: woaLote.qty_missing.toString(),
                            orig_invn_attr_a: dto.orig_invn_attr_a,
                            invn_attr_a: dto.invn_attr_a,
                            from_container_nbr: dto.from_container_nbr,
                            to_container_nbr: dto.to_container_nbr,
                            mhe_system_code: 'KISOFT',
                            pick_location: dto.pick_location,
                            short_flg: 'true',
                            orig_batch_nbr: '',//loteFaltante.lote,
                            orig_iblpn_nbr: '',
                            send_driver: false,
                            qty_dif: false
                            });
                        }
                    }
                }
            }
        }
        
        //this.logger.logError(`return - lista a enviar, list `, JSON.stringify(list, null, 2));

        const xmlStructure = {
            Request: {
                mhe_mode_flg: 'true',
                async_flg: 'true',
                pick_list: {
                    "list-item": list.map((obj) => ({
                        facility_id__code: obj.facility_id__code,
                        company_id__code: process.env.COMPANY_CODE,
                        wave_nbr: obj.wave_nbr,
                        order_nbr: obj.order_nbr,
                        item_alternate_code: obj.item_alternate_code,
                        batch_nbr: obj.batch_nbr,
                        qty: obj.qty,
                        orig_invn_attr_a: obj.orig_invn_attr_a,
                        invn_attr_a: obj.invn_attr_a,
                        to_container_nbr: obj.to_container_nbr,
                        mhe_system_code: 'KISOFT',//obj.mhe_system_code,
                        pick_location: obj.pick_location,
                        short_flg: obj.short_flg,
                        //orig_batch_nbr: '',//obj.orig_batch_nbr
                    })),
                },
            },
        };
    
        return xmlStructure;
      }
    
    getDetails(input: string, chunkSize = 74): string[] {
        const result = [];
        for (let i = 0; i < input.length; i += chunkSize) {
        result.push(input.substring(i, i + chunkSize));
        }
        return result;
    }

    async buildXmlReturnStructureShortPick(to_container_nbr: string, load_unit_code: string, id: number) {
        let woaList = await this.woaService.findByOblpnWithQtyPending(to_container_nbr);

        //this.logger.logError(`buildXmlReturnStructureShortPick - woaList por oblpn`, JSON.stringify(woaList, null, 2));

        //woaList = woaList.filter(w => (w.cant_return == null || w.cant_return == 0 || w.cant_return < w.allocated_qty));
        //this.logger.logError(`buildXmlReturnStructureShortPick - con cant_return == 0 O w.cant_return < w.allocated_qty`, JSON.stringify(woaList, null, 2));

        let tramaList = [];

        //this.logger.logError(`buildXmlReturnStructureShortPick - woaList`, JSON.stringify(woaList, null, 2));

        for(const dto of woaList){
            //this.logger.logError(`dto.order_number = ${dto.order_number}`);
            const qty = dto.cant_return == null || dto.cant_return == 0 ? dto.allocated_qty : Number(dto.allocated_qty) - Number(dto.cant_return);

            try
            {
                const xmlStructure = {
                Request: {
                    mhe_mode_flg: 'true',
                    async_flg: 'true',
                    pick_list: {
                        "list-item": {
                            facility_id__code: dto.facility_code,
                            company_id__code: process.env.COMPANY_CODE,
                            wave_nbr: dto.wave_number,
                            order_nbr: dto.order_number,
                            item_alternate_code: dto.item_alternate_code,
                            batch_nbr: dto.batch_nbr,
                            qty: qty,
                            orig_invn_attr_a: dto.invn_attr_a,
                            invn_attr_a: dto.invn_attr_a,
                            to_container_nbr: to_container_nbr,
                            mhe_system_code: 'KISOFT',
                            pick_location: dto.allocated_location,
                            short_flg: 'true'
                        },
                    },
                },
                };
        
                //this.logger.logError("buildXmlReturnStructureShortPick - xmlReturnObject", JSON.stringify(xmlStructure, null, 2));
        
                this.logger.logError(`tradId:${id} - URL Return`, process.env.PICK_CONFIRM_URL);
                
                try
                {
                    const response = await this.xmlService.sendSoapRequest(xmlStructure, process.env.PICK_CONFIRM_URL, id);
                    this.logger.logError(`tradId:${id} - SOAP response`, JSON.stringify(response));
                }
                catch(error) {
                    this.logger.logError(`tradId:${id} - Ocurrió un error buildXmlReturnStructureShortPick al enviar a WMS: ${error.message}`, error.stack);
                }
                
                tramaList.push(JSON.stringify(xmlStructure, null, 2));
        
                dto.cant_return = dto.allocated_qty;
                await this.woaService.updateWOA(dto);
            }
            catch(error) {
                this.logger.logError(`tradId:${id} - Ocurrió un error buildXmlReturnStructureShortPick: ${error.message}`, error.stack);
            }
        }

        await this.traceService.update(id, `Se envía tramas Short Pick, ${tramaList.join('')}`);
    }

    limpiarNumero(valor: string): string {
        return valor.replace(/^[0\s]+/, '');
    }

    async procesaCasosTipo1(woa: Woa, dto: CreateWoaResponseDto, id: number) {
        const list: ReturnDto[] = [];
        let detail = '';
    
        if(woa != null) {
            this.logger.logError(`procesaCasosTipo1 - item_alternate_code = ${dto.item_alternate_code}`);
    
            const article = await this.articleService.findByCodBarraUbicacion(woa.allocated_location);
    
    
            let dtoReturn: ReturnDto = {
                facility_id__code: woa.facility_code,
                company_id__code: process.env.COMPANY_CODE,
                wave_nbr: woa.wave_number,
                order_nbr: woa.order_number,
                item_alternate_code: dto.item_alternate_code,
                batch_nbr: woa.batch_nbr,
                load_unit_code: dto.load_unit_code,
                qty: dto.qty,
                orig_invn_attr_a: woa.invn_attr_a,
                invn_attr_a: woa.invn_attr_a,
                from_container_nbr: woa.oblpn,
                to_container_nbr: dto.to_container_nbr,
                mhe_system_code: 'KISOFT',//woa.mhe_system_code,
                pick_location: article != undefined ? article.Cod_Barra_2 : ' ',
                short_flg: 'false',
                orig_batch_nbr: '',//origBatchNbr,
                orig_iblpn_nbr: '',
                send_driver: false,
                qty_dif: (woa.allocated_qty != undefined ? woa.allocated_qty : 0) != parseInt(dto.qty),
                lot_exists: true
            };
    
            list.push(dtoReturn);
        
            woa.wworker = dto.wworker;
            woa.asset_nbr = dto.load_unit_code;
        
            if(woa.allocated_qty != undefined) {
                const loteQty = Number(woa.allocated_qty) - Number(woa.cant_return ?? 0);
        
                if(loteQty < Number(dto.qty)) {
                woa.cant_return = Number(woa.allocated_qty);
        
                const diff = Number(dto.qty) - Number(loteQty);
                woa.qty_surplus = diff;
                woa.qty_dif = diff > 0;
                }
                else {
                    woa.cant_return = Number(woa.cant_return ?? 0) + Number(dto.qty);
            
                    if(Number(dto.qty) < Number(loteQty)) {              
                        woa.qty_missing = Number(loteQty) - Number(dto.qty);
                        woa.qty_dif = true;
                    }
                    else {
                        woa.qty_missing = 0;
                        woa.qty_surplus = 0;
                        woa.qty_dif = false;
                        dto.Processed = true;
                    }
                }
            }
            else {
                this.logger.logError(`ERROR EN woa.allocated_qty = ${woa.allocated_qty}`);
            }
        
            if(article != undefined) {
                woa.volumen_linea = (woa.allocated_qty != undefined ? woa.allocated_qty : 0) * (article.Volumen_Unidad != undefined ? article.Volumen_Unidad : 0);
            }
            
            await this.woaService.updateWOA(woa);
        
            //this.logger.logError(`woa.allocated_qty = ${woa.allocated_qty}`);
            //this.logger.logError(`dto.qty = ${dto.qty}`);
        
            const qty = +woa.allocated_qty - +dto.qty;
            //this.logger.logError(`qty dif resultado = ${qty}`);            
        }
        else {
        
            const woaList = await this.woaService.findByOblpnAlternativeCode(dto.to_container_nbr, dto.item_alternate_code);
        
            const woaTmp = (woaList != undefined && woaList.length > 0) ? woaList[0] : undefined;
        
            if(woaTmp != undefined) {
                const article = await this.articleService.findByCodBarraUbicacion(woaTmp.allocated_location);
        
                let dtoReturn: ReturnDto = {
                facility_id__code: woaTmp.facility_code,
                company_id__code: process.env.COMPANY_CODE,
                wave_nbr: woaTmp.wave_number,
                order_nbr: woaTmp.order_number,
                item_alternate_code: dto.item_alternate_code,
                batch_nbr: dto.batch_nbr,
                load_unit_code: dto.load_unit_code,
                qty: dto.qty,
                orig_invn_attr_a: woaTmp.invn_attr_a,
                invn_attr_a: woaTmp.invn_attr_a,
                from_container_nbr: woaTmp.oblpn,
                to_container_nbr: dto.to_container_nbr,
                mhe_system_code: 'KISOFT',//woaTmp.mhe_system_code,
                pick_location: article != undefined ? article.Cod_Barra_2 : ' ',
                short_flg: 'false',
                orig_batch_nbr: '',//woaTmp.batch_nbr,
                orig_iblpn_nbr: '',
                send_driver: false,
                qty_dif: false,
                lot_exists: false
                };
        
                list.push(dtoReturn);
            }
            else {
                detail = detail + `[No se encontró WOA con oblpn=${dto.to_container_nbr}, item_alternate_code=${dto.item_alternate_code} el lote = ${dto.batch_nbr}],`;
                await this.traceService.updateDetail(id, JSON.stringify(detail, null, 2));
            }        
        }
    
        return list;
    }

    async procesaCasosTipo2(woaList: Woa[], data: CreateWoaResponseDto[]) {
        const woaListOrdered = [...woaList].sort((a, b) => a.id - b.id);
        const list: ReturnDto[] = [];
        const woaUpdated: WoaResumen[] = [];
        const oblpnArticleProcessed: OblpnArticle[] = [];

        this.logger.logError(`procesaCasosTipo2 - PARTE 1 - ******************************************************************************************************************************`);
        //Buscar los que coninciden hasta con la cantidad
        for (const woa of woaListOrdered) {
            const returnDto = data.find(x => x.to_container_nbr == woa.oblpn && 
                                    x.item_alternate_code == woa.item_alternate_code &&
                                    Number(x.qty) == woa.allocated_qty && 
                                    !x.Processed);

            this.logger.logError(`procesaCasosTipo2 - PARTE 1 - returnDto`, JSON.stringify(returnDto, null, 2));

            if(returnDto != null) {
            const articleProcessed = oblpnArticleProcessed.some(
                item =>
                item.to_container_nbr === returnDto.to_container_nbr &&
                item.item_alternate_code === returnDto.item_alternate_code,
            );

            if(!articleProcessed) {
                oblpnArticleProcessed.push({
                to_container_nbr: returnDto.to_container_nbr,
                item_alternate_code: returnDto.item_alternate_code,
                returnId: returnDto.id
                });

                const article = await this.articleService.findByCodBarraUbicacion(woa.allocated_location);
    
                let dtoReturn: ReturnDto = {
                facility_id__code: woa.facility_code,
                company_id__code: process.env.COMPANY_CODE,
                wave_nbr: woa.wave_number,
                order_nbr: woa.order_number,
                item_alternate_code: returnDto.item_alternate_code,
                batch_nbr: woa.batch_nbr,
                load_unit_code: returnDto.load_unit_code,
                qty: returnDto.qty,
                orig_invn_attr_a: woa.invn_attr_a,
                invn_attr_a: woa.invn_attr_a,
                from_container_nbr: woa.oblpn,
                to_container_nbr: returnDto.to_container_nbr,
                mhe_system_code: 'KISOFT',//woa.mhe_system_code,
                pick_location: article != undefined ? article.Cod_Barra_2 : ' ',
                short_flg: 'false',
                orig_batch_nbr: '',//returnDto.batch_nbr,
                orig_iblpn_nbr: '',
                send_driver: false,
                qty_dif: false,
                lot_exists: true
                };
    
                list.push(dtoReturn);
    
                woaUpdated.push({
                woaId: woa.id,
                returnId: returnDto.id
                });
    
                woa.cant_return = woa.allocated_qty;
                await this.woaService.updateWOA(woa);
            }          
            }

            this.logger.logError(`procesaCasosTipo2 - woaUpdated`, JSON.stringify(woaUpdated, null, 2));
        };

        this.logger.logError(`getDataToSend - ReturnDto - procesaCasosTipo2 AFTER PASO 1`, JSON.stringify(list, null, 2));

        this.logger.logError(`procesaCasosTipo2 - PARTE 2 - ******************************************************************************************************************************`);
        //Se valida si llegaron dos arctículos con el mismo código para completar a dos registros de woa

        const woaListOrderedUpdated = [...woaList].sort((a, b) => a.id - b.id);
        const woaUpdatedId = new Set(woaUpdated.map(x => x.woaId));
        const woaListUpdate = woaListOrderedUpdated.filter(y => !woaUpdatedId.has(y.id));
        const returnUpdated1 = new Set(woaUpdated.map(x => x.returnId));

        for (const woa of woaListUpdate) {
        const returnDto = data.find(x => !returnUpdated1.has(x.id) &&
                                        x.to_container_nbr == woa.oblpn && 
                                        x.item_alternate_code == woa.item_alternate_code &&
                                        Number(x.qty) == woa.allocated_qty && 
                                        !x.Processed);

        if(returnDto != null) {
            this.logger.logError(`procesaCasosTipo2 - PARTE 2 - returnDto`, JSON.stringify(returnDto, null, 2));

            const article = await this.articleService.findByCodBarraUbicacion(woa.allocated_location);
    
            let dtoReturn: ReturnDto = {
            facility_id__code: woa.facility_code,
            company_id__code: process.env.COMPANY_CODE,
            wave_nbr: woa.wave_number,
            order_nbr: woa.order_number,
            item_alternate_code: returnDto.item_alternate_code,
            batch_nbr: woa.batch_nbr,
            load_unit_code: returnDto.load_unit_code,
            qty: returnDto.qty,
            orig_invn_attr_a: woa.invn_attr_a,
            invn_attr_a: woa.invn_attr_a,
            from_container_nbr: woa.oblpn,
            to_container_nbr: returnDto.to_container_nbr,
            mhe_system_code: 'KISOFT',//woa.mhe_system_code,
            pick_location: article != undefined ? article.Cod_Barra_2 : ' ',
            short_flg: 'false',
            orig_batch_nbr: '',//returnDto.batch_nbr,
            orig_iblpn_nbr: '',
            send_driver: false,
            qty_dif: false,
            lot_exists: true
            };
    
            list.push(dtoReturn);
    
            woaUpdated.push({
            woaId: woa.id,
            returnId: returnDto.id
            });
    
            woa.cant_return = woa.allocated_qty;
            await this.woaService.updateWOA(woa);
        }
        }

        this.logger.logError(`getDataToSend - ReturnDto - procesaCasosTipo2 AFTER PASO 2`, JSON.stringify(list, null, 2));

        this.logger.logError(`procesaCasosTipo2 - PARTE 3 - ******************************************************************************************************************************`);

        //Se recorren los R32 que llegaron pero no coinciden en cantidad de artículos con los woa registrados
        const returnUpdatedIds = new Set(woaUpdated.map(x => x.returnId));
        const returnPendientes = (woaUpdated && woaUpdated.length > 0) ? data.filter(r => !returnUpdatedIds.has(r.id) && !r.Processed) : data;
        const returnAgrupado = this.groupAndSum(returnPendientes);
        const returnFaltante = returnAgrupado.sort((a, b) => Number(b.qty) - Number(a.qty));

        const woaUpdatedIds = woaUpdated.length > 0 ? new Set(woaUpdated.map(x => x.woaId)) : null;

        if(returnFaltante) {
            this.logger.logError(`procesaCasosTipo2 - returnFaltante.length = ${returnFaltante.length}`);
        }
        
        //this.logger.logError(`procesaCasosTipo2 - returnFaltante`, JSON.stringify(returnFaltante, null, 2));    

        if(returnFaltante != null && returnFaltante.length > 0) {
        
            let woaIdCompletado: number[] = [];

            this.logger.logError(`procesaCasosTipo2 - woaUpdatedIds`, JSON.stringify(woaUpdatedIds, null, 2));

            for(const returnDto of returnFaltante) {
                let qtySobrante = 0;
                let woaActualizado: WoaActualizado[] = [];
                this.logger.logError(`procesaCasosTipo2 - RETURN A VALIDAR  - eturnDto.id = ${returnDto.id}`);
                //this.logger.logError(`procesaCasosTipo2 - qtySobrante = ${qtySobrante}`);

                const woaPendientes = woaListOrdered.filter(woa => {
                                        if (woa.oblpn !== returnDto.to_container_nbr) return false;
                                        if (woa.item_alternate_code !== returnDto.item_alternate_code) return false;
                                        if (woaUpdatedIds && woaUpdatedIds.has(woa.id)) return false;
                                        if(woaIdCompletado.includes(woa.id)) return false;
                                        return true;
                                    });
            
                if(woaPendientes && woaPendientes.length > 0) {
                    const woaPendienteIds = woaPendientes.map(x => x.id);
                    this.logger.logError(`procesaCasosTipo2 - woaPendienteIds`, JSON.stringify(woaPendienteIds, null, 2));
                    //this.logger.logError(`procesaCasosTipo2 - woaActualizado`, JSON.stringify(woaActualizado, null, 2));

                    
                    for (const woa of woaPendientes) { 
                        
                        const returnQty = (qtySobrante > 0 ? qtySobrante : Number(returnDto.qty));
                        //this.logger.logError(`procesaCasosTipo2 - returnDto.qty = ${returnDto.qty}`);
                        this.logger.logError(`procesaCasosTipo2 - returnQty = ${returnQty}`);

                        
                        //this.logger.logError(`procesaCasosTipo2 - woa.id = ${woa.id}`);
                        //this.logger.logError(`procesaCasosTipo2 - woa.allocated_qty = ${woa.allocated_qty}`);
                        //this.logger.logError(`procesaCasosTipo2 - woa.cant_return = ${woa.cant_return}`);
                
                        //Para los R32 que llegaron con cantidades menores a los del woa          
                        
                        //this.logger.logError(`procesaCasosTipo2 - woa.cant_return = ${woa.cant_return}`);
                        //this.logger.logError(`procesaCasosTipo2 - returnDto.id = ${returnDto.id}`);
                        //this.logger.logError(`procesaCasosTipo2 - returnDto.item_alternate_code = ${returnDto.item_alternate_code}`);
                        //this.logger.logError(`procesaCasosTipo2 - returnQty = ${returnQty}`);
                        let returnFaltante = Number(woa.allocated_qty) - Number(woa.cant_return);
                        //this.logger.logError(`procesaCasosTipo2 - returnFaltante = ${returnFaltante}`);
                        let woaCantReturn = Number(woa.cant_return) + returnQty;            

                        if(woaActualizado.length > 0) {
                            //this.logger.logError(`procesaCasosTipo2 - woa.id buscado en woaActualizado = ${woa.id}`);
                            const woaBuscado = woaActualizado.find(x => x.woaId == woa.id);
                            //this.logger.logError(`procesaCasosTipo2 - woaBuscado`, JSON.stringify(woaBuscado, null, 2));

                            if(woaBuscado != null) {
                                woaCantReturn = Number(woaBuscado.qty) + returnQty; 
                            }            
                        }
                        
                        //this.logger.logError(`procesaCasosTipo2 - woaCantReturn = ${woaCantReturn}`);

                        qtySobrante =  Number(woaCantReturn) > Number(woa.allocated_qty) ? Number(woaCantReturn) - Number(woa.allocated_qty) : 0;

                        //this.logger.logError(`procesaCasosTipo2 - qtySobrante = ${qtySobrante}`);

                        woaCantReturn = Number(woaCantReturn) >= Number(woa.allocated_qty) ? Number(woa.allocated_qty) : Number(woaCantReturn);

                        const qtyUtilizado = returnQty - qtySobrante;

                        //this.logger.logError(`procesaCasosTipo2 - qtyUtilizado = ${qtyUtilizado}`);

                        if(Number(woa.allocated_qty) >= Number(woaCantReturn)) {
                            //this.logger.logError(`procesaCasosTipo2 - AÑADIR A LISTA********************************************`);
                            //this.logger.logError(`procesaCasosTipo2 - woaCantReturn = ${woaCantReturn}`);
                            //this.logger.logError(`procesaCasosTipo2 - qtyUtilizado = ${qtyUtilizado}`);
                            //this.logger.logError(`procesaCasosTipo2 - ********************************************`);
                            
                            const article = await this.articleService.findByCodBarraUbicacion(woa.allocated_location);
                    
                            let dtoReturn: ReturnDto = {
                                facility_id__code: woa.facility_code,
                                company_id__code: process.env.COMPANY_CODE,
                                wave_nbr: woa.wave_number,
                                order_nbr: woa.order_number,
                                item_alternate_code: returnDto.item_alternate_code,
                                batch_nbr: woa.batch_nbr,
                                load_unit_code: returnDto.load_unit_code,
                                qty: qtyUtilizado.toString(),
                                orig_invn_attr_a: woa.invn_attr_a,
                                invn_attr_a: woa.invn_attr_a,
                                from_container_nbr: woa.oblpn,
                                to_container_nbr: returnDto.to_container_nbr,
                                mhe_system_code: 'KISOFT',//woa.mhe_system_code,
                                pick_location: article != undefined ? article.Cod_Barra_2 : ' ',
                                short_flg: 'false',
                                orig_batch_nbr: '',//returnDto.batch_nbr,
                                orig_iblpn_nbr: '',
                                send_driver: false,
                                qty_dif: false,
                                lot_exists: true
                            };
                    
                            list.push(dtoReturn);

                            this.logger.logError(`procesaCasosTipo2 - SE ACTUALIZAR WOA ID = ${woa.id} con cant_return = ${woaCantReturn}`);
                            woa.cant_return = woaCantReturn;
                            await this.woaService.updateWOA(woa);

                            const index = woaActualizado.findIndex(x => x.woaId == woa.id);
                                
                            if(index > 0) {
                                woaActualizado[index].qty = woaCantReturn;
                            }
                            else {
                                woaActualizado.push({
                                woaId: woa.id,
                                qty: woaCantReturn
                                });
                            }

                            if(woa.allocated_qty == woaCantReturn) {
                                woaIdCompletado.push(woa.id);
                            }

                            woaUpdated.push({
                                woaId: woa.id,
                                returnId: returnDto.id
                            });
                        }
                        else {
                             this.logger.logError(`procesaCasosTipo2 - La cantidad encontrata en woa es menor que la enviada para to_container_nbr:${returnDto.to_container_nbr} y  item_alternate_code:${returnDto.item_alternate_code}`);
                        }

                        if(qtySobrante == 0)
                        break;
                    }
                }
                else {
                    this.logger.logError(`procesaCasosTipo2 - no cumple con la lógica de faltantes, to_container_nbr:${returnDto.to_container_nbr} y item_alternate_code:${returnDto.item_alternate_code}`);
                }
            }
        }

        return list;
    }

    copyUniqueObjects(sourceArray: Woa[], targetArray: Woa[]): any[] {
        const targetIds = new Set(targetArray.map(item => item.id));
        
        sourceArray.forEach(item => {
            if (!targetIds.has(item.id)) {
            targetArray.push(item);
            targetIds.add(item.id);
            }
        });
        
        return targetArray;
    }

    
  getReturnStructureToComplete(lote: string, woaDto: Woa, returnDto: ReturnDto, dataSobrante: LoteCantidad[], dataFaltante: LoteCantidad[], listReturn: ReturnDto[], qtyFaltante: number): ReturnDto[] {this.logger.logError(`getReturnStructureToComplete - lote = ${lote} `);
        this.logger.logError(`getReturnStructureToComplete - woaDto `, JSON.stringify(woaDto, null, 2));
        this.logger.logError(`getReturnStructureToComplete - dataSobrante `, JSON.stringify(dataSobrante, null, 2));
        this.logger.logError(`getReturnStructureToComplete - dataFaltante `, JSON.stringify(dataFaltante, null, 2));
        this.logger.logError(`getReturnStructureToComplete - listReturn `, JSON.stringify(listReturn, null, 2));
        this.logger.logError(`getReturnStructureToComplete - qtyFaltante = ${qtyFaltante}`);

        if(qtyFaltante > 0) {

            //Se busca si un lote tiene la cantidad de sobrantes que hace falta
            const loteParaCompletar = dataSobrante.find(l => Number(l.qty) == Number(qtyFaltante));
                
            this.logger.logError(`loteParaCompletar`, JSON.stringify(loteParaCompletar, null, 2));

            if(loteParaCompletar != undefined) {                
                listReturn.push({
                    facility_id__code: returnDto.facility_id__code,
                    company_id__code: returnDto.company_id__code,
                    wave_nbr: returnDto.wave_nbr,
                    order_nbr: returnDto.order_nbr,
                    item_alternate_code: returnDto.item_alternate_code,
                    batch_nbr: loteParaCompletar.lote,
                    load_unit_code: returnDto.load_unit_code,
                    qty: woaDto.qty_missing.toString(),
                    orig_invn_attr_a: returnDto.orig_invn_attr_a,
                    invn_attr_a: returnDto.invn_attr_a,
                    from_container_nbr: returnDto.from_container_nbr,
                    to_container_nbr: returnDto.to_container_nbr,
                    mhe_system_code: 'KISOFT',//returnDto.mhe_system_code,
                    pick_location: returnDto.pick_location,
                    short_flg: 'false',
                    orig_batch_nbr: '',//woaDto.batch_nbr,
                    orig_iblpn_nbr: '',
                    send_driver: false,
                    qty_dif: false
                });

                this.logger.logError(`OP1: Lista con elemento agregado`, JSON.stringify(listReturn, null, 2));

                //Actualizar la cantidad usada
                const loteParaCompletarIndex = dataSobrante.findIndex(l => l.lote == loteParaCompletar.lote);
                dataSobrante.splice(loteParaCompletarIndex);

                const loteFaltanteIndex = dataFaltante.findIndex(l => l.lote == lote);
                dataFaltante.splice(loteFaltanteIndex);
            }
            else {
                const loteParte = dataSobrante.find(l => l.qty > 0);
                //this.logger.logError(`loteParte`, JSON.stringify(loteParte, null, 2));

                listReturn.push({
                    facility_id__code: returnDto.facility_id__code,
                    company_id__code: returnDto.company_id__code,
                    wave_nbr: returnDto.wave_nbr,
                    order_nbr: returnDto.order_nbr,
                    item_alternate_code: returnDto.item_alternate_code,
                    batch_nbr: loteParte.lote,
                    load_unit_code: returnDto.load_unit_code,
                    qty: loteParte.qty.toString(),
                    orig_invn_attr_a: returnDto.orig_invn_attr_a,
                    invn_attr_a: returnDto.invn_attr_a,
                    from_container_nbr: returnDto.from_container_nbr,
                    to_container_nbr: returnDto.to_container_nbr,
                    mhe_system_code: 'KISOFT',//returnDto.mhe_system_code,
                    pick_location: returnDto.pick_location,
                    short_flg: 'false',
                    orig_batch_nbr: '',//woaDto.batch_nbr,
                    orig_iblpn_nbr: '',
                    send_driver: false,
                    qty_dif: false
                });
                
                this.logger.logError(`OP2: Lista con elemento agregado`, JSON.stringify(listReturn, null, 2));

                const qtyPendiente = Number(woaDto.qty_missing) - Number(loteParte.qty);

                //Actualizar la cantidad usada
                const loteParteIndex = dataSobrante.findIndex(l => l.lote == loteParte.lote);
                dataSobrante.splice(loteParteIndex, 1);

                const loteFaltanteIndex = dataFaltante.findIndex(l => l.lote == lote);

                //Si aún hay cantidad pendiente para enviar
                if(qtyPendiente > 0) {
                    const loteFaltante = dataFaltante[loteFaltanteIndex];
                    loteFaltante.qty = qtyPendiente;
                    dataFaltante[loteFaltanteIndex] = { ...dataFaltante[loteFaltanteIndex], ...loteFaltante };

                    return this.getReturnStructureToComplete(lote, woaDto, returnDto, dataSobrante, dataFaltante, listReturn, qtyPendiente);
                }
                else {
                    dataFaltante.splice(loteFaltanteIndex, 1);
                }
            }
        }

        return listReturn;
    }

    private groupAndSum(items: CreateWoaResponseDto[]): CreateWoaResponseDto[] {
        const grouped = new Map<string, CreateWoaResponseDto>();
    
        for (const item of items) {
        // Creamos una clave única para cada combinación de campos, excepto 'qty' y 'id' (ya que 'id' es único por registro)
        const key = JSON.stringify({
            to_container_nbr: item.to_container_nbr,
            load_unit_code: item.load_unit_code,
            item_alternate_code: item.item_alternate_code,
            batch_nbr: item.batch_nbr,
            wworker: item.wworker,
            pick_location: item.pick_location,
            CreatedDate: item.CreatedDate,
            CreatedUser: item.CreatedUser,
        });
    
        if (!grouped.has(key)) {
            // Clonamos el objeto base y lo inicializamos
            grouped.set(key, { ...item, qty: Number(item.qty).toString() });
        } else {
            const existing = grouped.get(key)!;
            const newQty = Number(existing.qty) + Number(item.qty);
            grouped.set(key, { ...existing, qty: newQty.toString() });
        }
        }
    
        return Array.from(grouped.values());
    }

    private async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
      
}
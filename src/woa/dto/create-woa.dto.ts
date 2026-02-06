import { IsOptional } from "class-validator";

export class CreateWoaDto {
    @IsOptional()
    id?: number;

    @IsOptional()
    facility_code?: string;

    @IsOptional()
    wave_number?: string;

    @IsOptional()
    action_code?: string;

    @IsOptional()
    order_number?: string;

    @IsOptional()
    oblpn?: string;

    @IsOptional()
    carton_weight?: number;

    @IsOptional()
    carton_length?: number;

    @IsOptional()
    carton_width?: number;

    @IsOptional()
    carton_height?: number;

    @IsOptional()
    tracking_number?: string;

    @IsOptional()
    ship_via?: string;

    @IsOptional()
    route_nbr?: string;

    @IsOptional()
    order_seq_nbr1?: number;

    @IsOptional()
    part_a?: string;

    @IsOptional()
    part_b?: string;

    @IsOptional()
    part_c?: string;

    @IsOptional()
    part_d?: string;

    @IsOptional()
    part_e?: string;

    @IsOptional()
    part_f?: string;

    @IsOptional()
    order_qty?: number;

    @IsOptional()
    allocated_qty?: number;

    @IsOptional()
    allocated_location?: string;

    @IsOptional()
    allocated_area?: string;

    @IsOptional()
    allocated_zone?: string;

    @IsOptional()
    create_ts?: string;

    @IsOptional()
    order_status?: string;

    @IsOptional()
    item_alternate_code?: string;

    @IsOptional()
    iblpn?: string;

    @IsOptional()
    order_priority?: number;

    @IsOptional()
    item_barcode?: string;

    @IsOptional()
    dest_facility_code?: string;

    @IsOptional()
    item_short_descr?: string;

    @IsOptional()
    ob_lpn_type?: string;

    @IsOptional()
    mhe_system_code?: string;

    @IsOptional()
    dummy_sku_flg?: boolean;

    @IsOptional()
    hazmat?: boolean;

    @IsOptional()
    external_style?: string;

    @IsOptional()
    un_class?: string;

    @IsOptional()
    un_number?: string;

    @IsOptional()
    conveyable?: boolean;

    @IsOptional()
    sortable?: boolean;

    @IsOptional()
    group_code?: string;

    @IsOptional()
    hierarchy_code_1?: string;

    @IsOptional()
    hierarchy_code_2?: string;

    @IsOptional()
    hierarchy_code_3?: string;

    @IsOptional()
    hierarchy_code_4?: string;

    @IsOptional()
    hierarchy_code_5?: string;

    @IsOptional()
    vas_activity_code?: string;

    @IsOptional()
    order_hdr_cust_field_1?: string;

    @IsOptional()
    order_hdr_cust_field_2?: string;

    @IsOptional()
    order_hdr_cust_field_3?: string;

    @IsOptional()
    order_hdr_cust_field_4?: string;

    @IsOptional()
    order_hdr_cust_field_5?: string;

    @IsOptional()
    order_hdr_cust_date_1?: Date;

    @IsOptional()
    order_hdr_cust_date_2?: Date;

    @IsOptional()
    order_hdr_cust_date_3?: Date;

    @IsOptional()
    order_hdr_cust_date_4?: Date;

    @IsOptional()
    order_hdr_cust_date_5?: Date;

    @IsOptional()
    order_hdr_cust_number_1?: number;

    @IsOptional()
    order_hdr_cust_number_2?: number;

    @IsOptional()
    order_hdr_cust_number_3?: number;

    @IsOptional()
    order_hdr_cust_number_4?: number;

    @IsOptional()
    order_hdr_cust_number_5?: number;

    @IsOptional()
    order_hdr_cust_decimal_1?: number;

    @IsOptional()
    order_hdr_cust_decimal_2?: number;

    @IsOptional()
    order_hdr_cust_decimal_3?: number;

    @IsOptional()
    order_hdr_cust_decimal_4?: number;

    @IsOptional()
    order_hdr_cust_decimal_5?: number;

    @IsOptional()
    order_hdr_cust_short_text_1?: string;

    @IsOptional()
    order_hdr_cust_short_text_2?: string;

    @IsOptional()
    order_hdr_cust_short_text_3?: string;

    @IsOptional()
    order_hdr_cust_short_text_4?: string;

    @IsOptional()
    order_hdr_cust_short_text_5?: string;

    @IsOptional()
    order_hdr_cust_short_text_6?: string;

    @IsOptional()
    order_hdr_cust_short_text_7?: string;

    @IsOptional()
    order_hdr_cust_short_text_8?: string;

    @IsOptional()
    order_hdr_cust_short_text_9?: string;

    @IsOptional()
    order_hdr_cust_short_text_10?: string;

    @IsOptional()
    order_hdr_cust_short_text_11?: string;

    @IsOptional()
    order_hdr_cust_short_text_12?: string;

    @IsOptional()
    order_hdr_cust_long_text_1?: string;

    @IsOptional()
    order_hdr_cust_long_text_2?: string;

    @IsOptional()
    order_hdr_cust_long_text_3?: string;

    @IsOptional()
    order_dtl_cust_field_1?: string;

    @IsOptional()
    order_dtl_cust_field_2?: string;

    @IsOptional()
    order_dtl_cust_field_3?: string;

    @IsOptional()
    order_dtl_cust_field_4?: string;

    @IsOptional()
    order_dtl_cust_field_5?: string;

    @IsOptional()
    order_dtl_cust_date_1?: Date;

    @IsOptional()
    order_dtl_cust_date_2?: Date;

    @IsOptional()
    order_dtl_cust_date_3?: Date;

    @IsOptional()
    order_dtl_cust_date_4?: Date;

    @IsOptional()
    order_dtl_cust_date_5?: Date;

    @IsOptional()
    order_dtl_cust_number_1?: number;

    @IsOptional()
    order_dtl_cust_number_2?: number;

    @IsOptional()
    order_dtl_cust_number_3?: number;

    @IsOptional()
    order_dtl_cust_number_4?: number;

    @IsOptional()
    order_dtl_cust_number_5?: number;

    @IsOptional()
    order_dtl_cust_decimal_1?: number;

    @IsOptional()
    order_dtl_cust_decimal_2?: number;

    @IsOptional()
    order_dtl_cust_decimal_3?: number;

    @IsOptional()
    order_dtl_cust_decimal_4?: number;

    @IsOptional()
    order_dtl_cust_decimal_5?: number;

    @IsOptional()
    order_dtl_cust_short_text_1?: string;

    @IsOptional()
    order_dtl_cust_short_text_2?: string;

    @IsOptional()
    order_dtl_cust_short_text_3?: string;

    @IsOptional()
    order_dtl_cust_short_text_4?: string;

    @IsOptional()
    order_dtl_cust_short_text_5?: string;

    @IsOptional()
    order_dtl_cust_short_text_6?: string;

    @IsOptional()
    order_dtl_cust_short_text_7?: string;

    @IsOptional()
    order_dtl_cust_short_text_8?: string;

    @IsOptional()
    order_dtl_cust_short_text_9?: string;

    @IsOptional()
    order_dtl_cust_short_text_10?: string;

    @IsOptional()
    order_dtl_cust_short_text_11?: string;

    @IsOptional()
    order_dtl_cust_short_text_12?: string;

    @IsOptional()
    order_dtl_cust_long_text_1?: string;

    @IsOptional()
    order_dtl_cust_long_text_2?: string;

    @IsOptional()
    order_dtl_cust_long_text_3?: string;

    @IsOptional()
    batch_nbr?: string;

    @IsOptional()
    allocation_uom?: string;

    @IsOptional()
    uom_qty?: number;

    @IsOptional()
    shipto_facility_code?: string;

    @IsOptional()
    shipto_name?: string;

    @IsOptional()
    shipto_addr?: string;

    @IsOptional()
    shipto_addr2?: string;

    @IsOptional()
    shipto_addr3?: string;

    @IsOptional()
    shipto_city?: string;

    @IsOptional()
    shipto_state?: string;

    @IsOptional()
    shipto_zip?: string;

    @IsOptional()
    shipto_country?: string;

    @IsOptional()
    shipto_phone_nbr?: string;

    @IsOptional()
    shipto_email?: string;

    @IsOptional()
    shipto_contact?: string;

    @IsOptional()
    dest_company_code?: string;

    @IsOptional()
    cust_name?: string;

    @IsOptional()
    cust_addr?: string;

    @IsOptional()
    cust_addr2?: string;

    @IsOptional()
    cust_addr3?: string;

    @IsOptional()
    cust_city?: string;

    @IsOptional()
    cust_state?: string;

    @IsOptional()
    cust_zip?: string;

    @IsOptional()
    cust_country?: string;

    @IsOptional()
    cust_phone_nbr?: string;

    @IsOptional()
    cust_email?: string;

    @IsOptional()
    cust_contact?: string;

    @IsOptional()
    cust_nbr?: string;

    @IsOptional()
    task_number?: string;

    @IsOptional()
    wave_group_run_number?: string;

    @IsOptional()
    invn_attr_a?: string;

    @IsOptional()
    invn_attr_b?: string;

    @IsOptional()
    invn_attr_c?: string;

    @IsOptional()
    invn_attr_d?: string;

    @IsOptional()
    invn_attr_e?: string;

    @IsOptional()
    invn_attr_f?: string;

    @IsOptional()
    invn_attr_g?: string;

    @IsOptional()
    invn_attr_h?: string;

    @IsOptional()
    invn_attr_i?: string;

    @IsOptional()
    invn_attr_j?: string;

    @IsOptional()
    invn_attr_k?: string;

    @IsOptional()
    invn_attr_l?: string;

    @IsOptional()
    invn_attr_m?: string;

    @IsOptional()
    invn_attr_n?: string;

    @IsOptional()
    invn_attr_o?: string;

    @IsOptional()
    expiry_date?: Date;

    @IsOptional()
    qty_uom_code?: string;

    @IsOptional()
    weight_uom_code?: string;

    @IsOptional()
    dimension_uom_code?: string;

    @IsOptional()
    order_dtl_original_seq_nbr?: string;

    @IsOptional()
    asset_nbr?: string;
    
    @IsOptional()
    cant_return?: number;

    @IsOptional()
    wworker?: string;

    @IsOptional()
    volumen_linea?: number;

    @IsOptional()
    qty_dif?: boolean;

    @IsOptional()
    qty_surplus?: number;

    @IsOptional()
    qty_missing?: number;

    @IsOptional()
    CreatedDate: Date;

    @IsOptional()
    CreatedUser: number;

    @IsOptional()
    ModifiedDate?: Date;

    @IsOptional()
    ModifiedUser?: number;

    @IsOptional()
    flg_print?: boolean;
}

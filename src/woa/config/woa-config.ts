/**
 * Configuración de WOA
 * Estos valores pueden ser sobrescritos mediante variables de entorno
 */
export const WoaConfig = {
  /**
   * Umbral de volumen de línea para determinar el flujo de procesamiento
   * Si la suma de volumen_linea > VOLUMEN_LINEA_THRESHOLD, se aplican reglas especiales
   * Valor por defecto: 18000
   * Variable de entorno: WOA_VOLUMEN_LINEA_THRESHOLD
   */
  VOLUMEN_LINEA_THRESHOLD: parseInt(
    process.env.WOA_VOLUMEN_LINEA_THRESHOLD || '18000',
    10
  ),
} as const;

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemParameter } from '../entities/system-parameter.entity';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class SystemParameterService {
  constructor(
    @InjectRepository(SystemParameter)
    private readonly systemParameterRepository: Repository<SystemParameter>,
    private readonly logger: LoggerService
  ) {}

  /**
   * Obtiene un parámetro del sistema por interface y nombre
   * @param interfaceName Nombre de la interfaz (ej: 'WOA')
   * @param parameterName Nombre del parámetro (ej: 'VOLUMEN_LINEA_THRESHOLD')
   * @returns Valor del parámetro o null si no existe
   */
  async getParameter(interfaceName: string, parameterName: string): Promise<string | null> {
    try {
      const parameter = await this.systemParameterRepository.findOne({
        where: {
          interface_name: interfaceName,
          parameter_name: parameterName,
        },
      });

      return parameter?.parameter_value ?? null;
    } catch (error) {
      this.logger.logError(`Error al obtener parámetro ${interfaceName}.${parameterName}: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Obtiene todos los parámetros de una interfaz
   * @param interfaceName Nombre de la interfaz (ej: 'WOA')
   * @returns Map con nombre del parámetro como clave y valor como valor
   */
  async getParametersByInterface(interfaceName: string): Promise<Map<string, string>> {
    try {
      const parameters = await this.systemParameterRepository.find({
        where: {
          interface_name: interfaceName,
        },
      });

      const parametersMap = new Map<string, string>();
      for (const param of parameters) {
        if (param.parameter_value) {
          parametersMap.set(param.parameter_name, param.parameter_value);
        }
      }

      return parametersMap;
    } catch (error) {
      this.logger.logError(`Error al obtener parámetros de interfaz ${interfaceName}: ${error.message}`, error.stack);
      return new Map<string, string>();
    }
  }

  /**
   * Crea o actualiza un parámetro del sistema
   * @param interfaceName Nombre de la interfaz
   * @param parameterName Nombre del parámetro
   * @param parameterValue Valor del parámetro
   * @param description Descripción opcional
   * @returns El parámetro creado o actualizado
   */
  async setParameter(
    interfaceName: string,
    parameterName: string,
    parameterValue: string,
    description?: string
  ): Promise<SystemParameter> {
    try {
      let parameter = await this.systemParameterRepository.findOne({
        where: {
          interface_name: interfaceName,
          parameter_name: parameterName,
        },
      });

      if (parameter) {
        // Actualizar existente
        parameter.parameter_value = parameterValue;
        if (description) {
          parameter.description = description;
        }
        parameter.ModifiedDate = new Date();
        parameter.ModifiedUser = 3;
      } else {
        // Crear nuevo
        parameter = this.systemParameterRepository.create({
          interface_name: interfaceName,
          parameter_name: parameterName,
          parameter_value: parameterValue,
          description: description,
          CreatedDate: new Date(),
          CreatedUser: 3,
        });
      }

      return await this.systemParameterRepository.save(parameter);
    } catch (error) {
      this.logger.logError(`Error al guardar parámetro ${interfaceName}.${parameterName}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Obtiene la fecha de última modificación de los parámetros de una interfaz
   * Útil para cache invalidation
   * @param interfaceName Nombre de la interfaz
   * @returns Timestamp de la última modificación o null
   */
  async getLastModifiedDate(interfaceName: string): Promise<number | null> {
    try {
      const result = await this.systemParameterRepository
        .createQueryBuilder('param')
        .select('MAX(param.ModifiedDate)', 'maxModifiedDate')
        .where('param.interface_name = :interfaceName', { interfaceName })
        .getRawOne();

      if (result?.maxModifiedDate) {
        return new Date(result.maxModifiedDate).getTime();
      }

      return null;
    } catch (error) {
      this.logger.logError(`Error al obtener fecha de modificación de ${interfaceName}: ${error.message}`, error.stack);
      return null;
    }
  }
}

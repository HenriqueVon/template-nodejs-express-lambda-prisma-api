import { Example } from '@prisma/client';
import { CreateExampleDto, UpdateExampleDto } from '../dtos';
import { ListParamsDto } from '@shared/dtos/list-params.dto';
import { PaginatedResponseDto } from '@shared/dtos/paginated-response.dto';

export interface IExampleRepository {
  create(data: CreateExampleDto): Promise<Example>;
  findById(id: string): Promise<Example | null>;
  findByName(name: string): Promise<Example | null>;
  findMany(filters?: Partial<Example>, params?: ListParamsDto): Promise<PaginatedResponseDto<Example>>;
  update(id: string, data: UpdateExampleDto): Promise<Example>;
  delete(id: string): Promise<void>;
}

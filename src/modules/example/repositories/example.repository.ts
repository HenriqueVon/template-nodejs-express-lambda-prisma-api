import { injectable } from 'tsyringe';
import { prisma } from '@services/database/prisma/prisma.client';
import { Example } from '@prisma/client';
import { IExampleRepository } from './iexample.repository';
import { CreateExampleDto, UpdateExampleDto } from '../dtos';
import { prismaCall } from '@shared/database/prisma/prisma-call';
import { ListParamsDto } from '@shared/dtos/list-params.dto';
import { PaginatedResponseDto } from '@shared/dtos/paginated-response.dto';

@injectable()
export class ExampleRepository implements IExampleRepository {
  async create(data: CreateExampleDto): Promise<Example> {
    return prismaCall(() => prisma.example.create({ data }));
  }

  async findById(id: string): Promise<Example | null> {
    return prisma.example.findUnique({
      where: { id },
    });
  }

  async findByName(name: string): Promise<Example | null> {
    return prisma.example.findUnique({
      where: { name },
    });
  }

  async findMany(
    filters: Partial<Example> = {},
    params: ListParamsDto = {}
  ): Promise<PaginatedResponseDto<Example>> {
    const limit = Math.min(params.limit ?? 20, 100);
    const offset = params.offset ?? 0;

    const { name } = filters;

    // A total order is required for stable pages: the requested field, then the id as tie-breaker.
    // Without orderBy, the most recent records come first.
    const direction = params.orderDirection ?? 'asc';
    const orderBy = params.orderBy
      ? [{ [params.orderBy]: direction }, { id: direction }]
      : [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

    const [items, total] = await Promise.all([
      prisma.example.findMany({
        where : { name },
        skip  : offset,
        take  : limit,
        orderBy,
      }),
      prisma.example.count({
        where: { name },
      }),
    ]);

    return {
      items,
      total,
    };
  }

  async update(id: string, data: UpdateExampleDto): Promise<Example> {
    return prismaCall(() =>
      prisma.example.update({
        where: { id },
        data,
      })
    );
  }

  async delete(id: string): Promise<void> {
    await prismaCall(() => prisma.example.delete({ where: { id } }));
  }
}

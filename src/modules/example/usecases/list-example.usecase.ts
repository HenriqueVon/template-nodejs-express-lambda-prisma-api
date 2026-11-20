import { inject, injectable } from 'tsyringe';
import { Example } from '@prisma/client';
import { IExampleRepository } from '../repositories/iexample.repository';
import { EXAMPLE_REPOSITORY } from '../repositories/example.tokens';
import { ListParamsDto } from '@shared/dtos/list-params.dto';
import { PaginatedResponseDto } from '@shared/dtos/paginated-response.dto';

@injectable()
export class ListExampleUseCase {
  constructor(
    @inject(EXAMPLE_REPOSITORY)
    private readonly exampleRepository: IExampleRepository
  ) {}

  async execute(params: ListParamsDto): Promise<PaginatedResponseDto<Example>> {
    return this.exampleRepository.findMany({}, params);
  }
}

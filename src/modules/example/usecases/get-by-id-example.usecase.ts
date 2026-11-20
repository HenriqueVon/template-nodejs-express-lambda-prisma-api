import { inject, injectable } from 'tsyringe';
import { Example } from '@prisma/client';
import { IExampleRepository } from '../repositories/iexample.repository';
import { EXAMPLE_REPOSITORY } from '../repositories/example.tokens';
import { NotFoundError } from '@shared/errors/app-error';

@injectable()
export class GetByIdExampleUseCase {
  constructor(
    @inject(EXAMPLE_REPOSITORY)
    private readonly exampleRepository: IExampleRepository
  ) {}

  async execute(id: string): Promise<Example> {
    const example = await this.exampleRepository.findById(id);

    if (!example) {
      throw new NotFoundError();
    }

    return example;
  }
}

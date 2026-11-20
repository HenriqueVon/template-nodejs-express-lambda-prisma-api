import { inject, injectable } from 'tsyringe';
import { Example } from '@prisma/client';
import { IExampleRepository } from '../repositories/iexample.repository';
import { EXAMPLE_REPOSITORY } from '../repositories/example.tokens';
import { CreateExampleDto } from '../dtos';
import { ConflictError } from '@shared/errors/app-error';

@injectable()
export class CreateExampleUseCase {
  constructor(
    @inject(EXAMPLE_REPOSITORY)
    private readonly exampleRepository: IExampleRepository
  ) {}

  async execute(input: CreateExampleDto): Promise<Example> {
    const name = input.name.trim();

    const existing = await this.exampleRepository.findByName(name);
    if (existing) {
      throw new ConflictError('Example name already exists!');
    }

    return this.exampleRepository.create({
      ...input,
      name
    });
  }
}

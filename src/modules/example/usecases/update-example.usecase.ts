import { inject, injectable } from 'tsyringe';
import { Example } from '@prisma/client';
import { UpdateExampleDto } from '../dtos';
import { IExampleRepository } from '../repositories/iexample.repository';
import { EXAMPLE_REPOSITORY } from '../repositories/example.tokens';
import { ConflictError } from '@shared/errors/app-error';

@injectable()
export class UpdateExampleUseCase {
  constructor(
    @inject(EXAMPLE_REPOSITORY)
    private readonly exampleRepository: IExampleRepository
  ) {}

  async execute(id: string, input: UpdateExampleDto): Promise<Example> {
    const data: UpdateExampleDto = { ...input };

    if (input.name !== undefined) {
      const name = input.name.trim();
      const existing = await this.exampleRepository.findByName(name);

      // The record being updated may keep its own name
      if (existing && existing.id !== id) {
        throw new ConflictError('Example name already exists!');
      }

      data.name = name;
    }

    // A missing record is answered with 404 by prismaCall (Prisma P2025)
    return this.exampleRepository.update(id, data);
  }
}

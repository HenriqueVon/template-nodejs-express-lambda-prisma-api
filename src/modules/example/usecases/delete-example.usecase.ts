import { inject, injectable } from 'tsyringe';
import { IExampleRepository } from '../repositories/iexample.repository';
import { EXAMPLE_REPOSITORY } from '../repositories/example.tokens';

@injectable()
export class DeleteExampleUseCase {
  constructor(
    @inject(EXAMPLE_REPOSITORY)
    private readonly exampleRepository: IExampleRepository
  ) {}

  async execute(id: string): Promise<void> {
    // A missing record is answered with 404 by prismaCall (Prisma P2025)
    await this.exampleRepository.delete(id);
  }
}

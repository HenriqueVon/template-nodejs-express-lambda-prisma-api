import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';
import {
  CreateExampleUseCase,
  UpdateExampleUseCase,
  ListExampleUseCase,
  GetByIdExampleUseCase,
  DeleteExampleUseCase
} from './usecases';

@injectable()
export class ExampleController {
  constructor(
    @inject(CreateExampleUseCase)
    private readonly createExampleUseCase: CreateExampleUseCase,
    @inject(ListExampleUseCase)
    private readonly listExampleUseCase: ListExampleUseCase,
    @inject(UpdateExampleUseCase)
    private readonly updateExampleUseCase: UpdateExampleUseCase,
    @inject(GetByIdExampleUseCase)
    private readonly getByIdExampleUseCase: GetByIdExampleUseCase,
    @inject(DeleteExampleUseCase)
    private readonly deleteExampleUseCase: DeleteExampleUseCase
  ) {}

  async create(req: Request, res: Response) {
    const example = await this.createExampleUseCase.execute(req.body);
    return res.status(201).json(example);
  }

  async list(req: Request, res: Response) {
    const examples = await this.listExampleUseCase.execute({
      limit          : req.query.limit ? Number(req.query.limit) : undefined,
      offset         : req.query.offset ? Number(req.query.offset) : undefined,
      orderBy        : req.query.orderBy as string | undefined,
      orderDirection : req.query.orderDirection as 'asc' | 'desc' | undefined,
    });

    return res.status(200).json(examples);
  }

  async getById(req: Request, res: Response) {
    const example = await this.getByIdExampleUseCase.execute(req.params.id);
    return res.status(200).json(example);
  }

  async update(req: Request, res: Response) {
    const example = await this.updateExampleUseCase.execute(req.params.id, req.body);
    return res.status(200).json(example);
  }

  async delete(req: Request, res: Response) {
    await this.deleteExampleUseCase.execute(req.params.id);
    return res.status(204).send();
  }
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetByIdExampleUseCase } from '../../usecases/get-by-id-example.usecase';
import type { IExampleRepository } from '../../repositories/iexample.repository';

describe('GetByIdExampleUseCase', () => {
  let repo: IExampleRepository;
  let sut: GetByIdExampleUseCase;

  beforeEach(() => {
    repo = {
      findById: vi.fn(),
    } as unknown as IExampleRepository;

    sut = new GetByIdExampleUseCase(repo);
  });

  it('should return the record', async () => {
    const example = { id: '1', name: 'First', description: null };
    (repo.findById as any).mockResolvedValue(example);

    const result = await sut.execute('1');

    expect(repo.findById).toHaveBeenCalledWith('1');
    expect(result).toBe(example);
  });

  it('should throw NotFoundError when the record does not exist', async () => {
    (repo.findById as any).mockResolvedValue(null);

    await expect(sut.execute('missing')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

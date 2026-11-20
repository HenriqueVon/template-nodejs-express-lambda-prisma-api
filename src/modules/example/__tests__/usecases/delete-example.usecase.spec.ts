import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteExampleUseCase } from '../../usecases/delete-example.usecase';
import type { IExampleRepository } from '../../repositories/iexample.repository';

describe('DeleteExampleUseCase', () => {
  let repo: IExampleRepository;
  let sut: DeleteExampleUseCase;

  beforeEach(() => {
    repo = {
      delete: vi.fn(),
    } as unknown as IExampleRepository;

    sut = new DeleteExampleUseCase(repo);
  });

  it('should delete the record through the repository', async () => {
    (repo.delete as any).mockResolvedValue(undefined);

    await sut.execute('1');

    expect(repo.delete).toHaveBeenCalledTimes(1);
    expect(repo.delete).toHaveBeenCalledWith('1');
  });
});

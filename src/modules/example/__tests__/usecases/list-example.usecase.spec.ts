import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListExampleUseCase } from '../../usecases/list-example.usecase';
import type { IExampleRepository } from '../../repositories/iexample.repository';

describe('ListExampleUseCase', () => {
  let repo: IExampleRepository;
  let sut: ListExampleUseCase;

  beforeEach(() => {
    repo = {
      findMany: vi.fn(),
    } as unknown as IExampleRepository;

    sut = new ListExampleUseCase(repo);
  });

  it('should pass the list params to the repository without filters', async () => {
    const page = { items: [{ id: '1', name: 'First' }], total: 1 };
    (repo.findMany as any).mockResolvedValue(page);

    const params = { limit: 10, offset: 20, orderBy: 'name', orderDirection: 'desc' as const };

    const result = await sut.execute(params);

    expect(repo.findMany).toHaveBeenCalledWith({}, params);
    expect(result).toBe(page);
  });
});

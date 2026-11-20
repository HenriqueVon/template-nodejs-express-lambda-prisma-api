import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateExampleUseCase } from '../../usecases/create-example.usecase';
import type { IExampleRepository } from '../../repositories/iexample.repository';

describe('CreateExampleUseCase', () => {
  let repo: IExampleRepository;
  let sut: CreateExampleUseCase;

  beforeEach(() => {
    repo = {
      findByName : vi.fn(),
      create     : vi.fn(),
    } as unknown as IExampleRepository;

    sut = new CreateExampleUseCase(repo);
  });

  it('should trim the name, check uniqueness, then create', async () => {
    (repo.findByName as any).mockResolvedValue(null);

    const createdExample = { id: '1', name: 'First', description: null };
    (repo.create as any).mockResolvedValue(createdExample);

    const input = { name: '  First  ', description: 'Text' };

    const result = await sut.execute(input);

    expect(repo.findByName).toHaveBeenCalledTimes(1);
    expect(repo.findByName).toHaveBeenCalledWith('First');

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith({ ...input, name: 'First' });

    expect(result).toBe(createdExample);
  });

  it('should throw ConflictError if the name already exists', async () => {
    (repo.findByName as any).mockResolvedValue({ id: 'existing', name: 'First' });

    await expect(
      sut.execute({ name: ' First ' })
    ).rejects.toMatchObject({
      statusCode : 409,
      message    : 'Example name already exists!',
    });

    expect(repo.findByName).toHaveBeenCalledWith('First');
    expect(repo.create).not.toHaveBeenCalled();
  });
});

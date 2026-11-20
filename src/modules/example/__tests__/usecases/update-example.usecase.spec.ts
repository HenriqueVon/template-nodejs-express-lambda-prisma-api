import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UpdateExampleUseCase } from '../../usecases/update-example.usecase';
import type { IExampleRepository } from '../../repositories/iexample.repository';

describe('UpdateExampleUseCase', () => {
  let repo: IExampleRepository;
  let sut: UpdateExampleUseCase;

  beforeEach(() => {
    repo = {
      findByName : vi.fn(),
      update     : vi.fn(),
    } as unknown as IExampleRepository;

    sut = new UpdateExampleUseCase(repo);
  });

  it('should update directly when the name is not sent', async () => {
    const updatedExample = { id: '1', name: 'First', description: 'New text' };
    (repo.update as any).mockResolvedValue(updatedExample);

    const input = { description: 'New text' };

    const result = await sut.execute('1', input);

    expect(repo.findByName).not.toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(repo.update).toHaveBeenCalledWith('1', input);
    expect(result).toBe(updatedExample);
  });

  it('should trim the name, check uniqueness, then update', async () => {
    (repo.findByName as any).mockResolvedValue(null);

    const updatedExample = { id: '1', name: 'Second', description: null };
    (repo.update as any).mockResolvedValue(updatedExample);

    const result = await sut.execute('1', { name: '  Second  ' });

    expect(repo.findByName).toHaveBeenCalledWith('Second');
    expect(repo.update).toHaveBeenCalledWith('1', { name: 'Second' });
    expect(result).toBe(updatedExample);
  });

  it('should allow the update when the existing record is the one being updated', async () => {
    (repo.findByName as any).mockResolvedValue({ id: '1', name: 'First' });

    const updatedExample = { id: '1', name: 'First', description: 'New text' };
    (repo.update as any).mockResolvedValue(updatedExample);

    const result = await sut.execute('1', { name: ' First ', description: 'New text' });

    expect(repo.update).toHaveBeenCalledWith('1', { name: 'First', description: 'New text' });
    expect(result).toBe(updatedExample);
  });

  it('should throw ConflictError if the name belongs to another record', async () => {
    (repo.findByName as any).mockResolvedValue({ id: 'other', name: 'First' });

    await expect(
      sut.execute('1', { name: ' First ' })
    ).rejects.toMatchObject({
      statusCode : 409,
      message    : 'Example name already exists!',
    });

    expect(repo.update).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, type MockInstance } from 'vitest';
import { errorFields, logger } from '../logger';
import { getRequestId, requestContext } from '../request-context';

function lastLine(spy: MockInstance<typeof console.info>) {
  return JSON.parse(spy.mock.calls.at(-1)![0] as string);
}

describe('logger', () => {
  let info: MockInstance<typeof console.info>;
  let warn: MockInstance<typeof console.warn>;
  let error: MockInstance<typeof console.error>;

  beforeEach(() => {
    info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('should write one JSON object per call, on the console method of its level', () => {
    logger.info('started', { port: 3000 });
    logger.warn('slow', { ms: 900 });
    logger.error('failed', { code: 'X' });

    expect(lastLine(info)).toMatchObject({ level: 'info', event: 'started', port: 3000 });
    expect(lastLine(warn)).toMatchObject({ level: 'warn', event: 'slow', ms: 900 });
    expect(lastLine(error)).toMatchObject({ level: 'error', event: 'failed', code: 'X' });
    expect(Number.isNaN(Date.parse(lastLine(info).time))).toBe(false);
  });

  it('should add the request id of the current request context', () => {
    requestContext.run({ requestId: 'req-1' }, () => logger.info('inside'));

    expect(lastLine(info).requestId).toBe('req-1');
  });

  it('should not write a request id outside a request', () => {
    logger.info('outside');

    expect(lastLine(info)).not.toHaveProperty('requestId');
  });

  it('should let an explicit request id win over the context', () => {
    requestContext.run({ requestId: 'from-context' }, () => logger.info('explicit', { requestId: 'explicit-id' }));

    expect(lastLine(info).requestId).toBe('explicit-id');
  });

  it('should keep the request id across awaits', async () => {
    await requestContext.run({ requestId: 'req-2' }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(getRequestId()).toBe('req-2');
    });
  });

  it('should keep concurrent requests apart', async () => {
    const seen: string[] = [];

    await Promise.all(['a', 'b', 'c'].map((id, index) =>
      requestContext.run({ requestId: id }, async () => {
        await new Promise((resolve) => setTimeout(resolve, (3 - index) * 5));
        seen.push(`${id}:${getRequestId()}`);
      })
    ));

    expect(seen.sort()).toEqual(['a:a', 'b:b', 'c:c']);
  });
});

describe('errorFields', () => {
  it('should expose the name, the message and the stack of an Error', () => {
    const fields = errorFields(new TypeError('boom'));

    expect(fields).toMatchObject({ errorName: 'TypeError', errorMessage: 'boom' });
    expect(typeof fields.stack).toBe('string');
  });

  it('should describe a value that is not an Error', () => {
    expect(errorFields('plain text')).toEqual({ errorMessage: 'plain text' });
  });
});

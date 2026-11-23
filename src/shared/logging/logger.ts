import { getRequestId } from './request-context';

type Fields = Record<string, unknown>;
type Level = 'info' | 'warn' | 'error';

// One JSON object per line: CloudWatch Logs Insights and most log tools can filter and group by field.
// The request id comes from the request context; pass `requestId` in the fields where there is no context.
// Never log headers, bodies, tokens, keys or connection strings.
function write(level: Level, event: string, fields: Fields): void {
  const line = JSON.stringify({
    time      : new Date().toISOString(),
    level,
    event,
    requestId : getRequestId(),
    ...fields,
  });

  // The console is read at call time, not captured, so a test can replace it
  switch (level) {
    case 'info':
      console.info(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'error':
      console.error(line);
      break;
  }
}

export const logger = {
  info  : (event: string, fields: Fields = {}) => write('info', event, fields),
  warn  : (event: string, fields: Fields = {}) => write('warn', event, fields),
  error : (event: string, fields: Fields = {}) => write('error', event, fields),
};

// An Error does not serialize to JSON by itself (its fields are not enumerable)
export function errorFields(error: unknown): Fields {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message, stack: error.stack };
  }

  return { errorMessage: String(error) };
}

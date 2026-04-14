export type AppErrorCode = 'validation' | 'auth' | 'forbidden' | 'not_found' | 'network' | 'unknown';

export class AppError extends Error {
  code: AppErrorCode;
  details?: unknown;

  constructor(message: string, code: AppErrorCode = 'unknown', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

export function toAppError(error: unknown, fallback = 'Something went wrong. Please try again.'): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    const msg = error.message || fallback;
    if (/not authorized|forbidden|not allowed/i.test(msg)) return new AppError(msg, 'forbidden');
    if (/not found/i.test(msg)) return new AppError(msg, 'not_found');
    if (/network|fetch|timeout|connection/i.test(msg)) return new AppError(msg, 'network');
    if (/invalid|required|validation/i.test(msg)) return new AppError(msg, 'validation');
    return new AppError(msg, 'unknown');
  }
  return new AppError(fallback, 'unknown', error);
}


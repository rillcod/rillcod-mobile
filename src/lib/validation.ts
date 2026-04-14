import { AppError } from './appError';

export function assertRequired(value: string, label: string) {
  if (!value || !value.trim()) {
    throw new AppError(`${label} is required.`, 'validation');
  }
}

export function assertNumberRange(value: number, label: string, min: number, max: number) {
  if (Number.isNaN(value) || value < min || value > max) {
    throw new AppError(`${label} must be between ${min} and ${max}.`, 'validation');
  }
}


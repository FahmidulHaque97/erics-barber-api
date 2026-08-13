import { ConflictException } from '@nestjs/common';

export class ApiConflictException extends ConflictException {
  constructor(code: string, message: string) {
    super({ statusCode: 409, error: 'Conflict', code, message });
  }
}

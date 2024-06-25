import type { z, ZodIssue } from 'zod';

export type ResponseValidationErrorDetails = {
  error: ZodIssue[];
  method: string;
  url: string;
};

export class ResponseValidationError extends Error {
  public details: ResponseValidationErrorDetails;

  constructor(
    validationResult: z.SafeParseReturnType<unknown, unknown>,
    method: string,
    url: string,
  ) {
    super("Response doesn't match the schema");
    this.name = 'ResponseValidationError';
    this.details = {
      error: validationResult.error?.issues ?? [],
      method,
      url,
    };
  }
}

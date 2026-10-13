export class HttpError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.details = details;
  }
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export class ValidationError extends HttpError {
  declare readonly details: ValidationIssue[];

  constructor(message: string, details: ValidationIssue[]) {
    super(400, message, details);
  }
}

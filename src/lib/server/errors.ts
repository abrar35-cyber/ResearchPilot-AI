export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
  }
}

export class NotFoundError extends AppError {
  constructor(what: string) {
    super("not_found", `${what} was not found.`, 404);
  }
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  isValidation() { return this.status === 400 && !!this.fieldErrors; }
  isAuthError()  { return this.status === 401; }
  isForbidden()  { return this.status === 403; }
  isNotFound()   { return this.status === 404; }
  isServer()     { return !this.status || this.status >= 500; }
}

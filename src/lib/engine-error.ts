/** Shared engine error so engine.ts and engine-api.ts avoid a circular import. */
export class EngineError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = 'EngineError';
  }
}

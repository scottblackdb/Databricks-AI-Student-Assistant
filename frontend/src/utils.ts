export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function newMessageId(): string {
  return crypto.randomUUID();
}

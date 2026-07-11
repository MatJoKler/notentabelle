/** IDs entstehen außerhalb des Reducers, damit dieser eine reine Funktion bleibt. */
export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

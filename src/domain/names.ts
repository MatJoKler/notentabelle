/** Mehrzeilige Eingabe (auch Excel/Word-Paste) in eine Namensliste zerlegen. */
export function parseNameList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

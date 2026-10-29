/** Non-persistent command recall. This changes the input draft, not lab state. */
export const HISTORY_LIMIT = 30;

export function rememberCommand(history: string[], raw: string): string[] {
  const command = raw.trim();
  if (!command) return history;
  return [...history.filter(item => item !== command), command].slice(-HISTORY_LIMIT);
}

/** null represents a new unsent draft, otherwise a zero-based history index. */
export function moveHistoryCursor(
  historyLength: number,
  cursor: number | null,
  direction: 'older' | 'newer'
): number | null {
  if (historyLength === 0) return null;
  if (direction === 'older') return cursor === null
    ? historyLength - 1 : Math.max(0, cursor - 1);
  if (cursor === null || cursor >= historyLength - 1) return null;
  return cursor + 1;
}

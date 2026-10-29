import type { LinuxState } from './linux';

export function modeOf(state: LinuxState, path: string): number {
  const value = state.permissions?.[path];
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0o777) return value;
  return state.dirs.includes(path) ? 0o755 : 0o644;
}

export function modeString(state: LinuxState, path: string): string {
  const mode = modeOf(state, path);
  const bits = [0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001];
  return (state.dirs.includes(path) ? 'd' : '-') +
    bits.map((bit, i) => mode & bit ? 'rwx'[i % 3] : '-').join('');
}

export function modeOctal(state: LinuxState, path: string): string {
  return modeOf(state, path).toString(8).padStart(3, '0');
}

/** Deliberate subset: chmod 600 file, chmod u+r file, chmod go-rwx file. */
export function nextMode(current: number, spec: string): number | null {
  if (/^0?[0-7]{3}$/.test(spec)) return parseInt(spec, 8);
  const match = /^([ugoa]+)([+-])([rwx]+)$/.exec(spec);
  if (!match) return null;
  const [, classes, action, letters] = match;
  let mask = 0;
  const who = classes.includes('a') ? 'ugo' : [...new Set(classes)].join('');
  for (const cls of who) {
    const offset = cls === 'u' ? 6 : cls === 'g' ? 3 : 0;
    for (const letter of letters) mask |= (letter === 'r' ? 4 : letter === 'w' ? 2 : 1) << offset;
  }
  return action === '+' ? (current | mask) : (current & ~mask);
}

/** Deterministic in-browser simulator: NEVER executes input on the host OS. */
export interface LinuxState {
  cwd: string;
  dirs: string[];
  files: Record<string, string>;
}

export interface CommandResult {
  state: LinuxState;
  output: string;
  ok: boolean;
  command: string;
  target?: string;
  clear?: boolean;
}

const HOME = '/home/player';
const FLAG = 'CTF{look_beyond_the_obvious}';

export const initialLinux = (): LinuxState => ({
  cwd: HOME,
  dirs: ['/', '/home', HOME, `${HOME}/documents`, `${HOME}/downloads`, `${HOME}/documents/cases`, `${HOME}/.vault`, '/var', '/var/log'],
  files: {
    [`${HOME}/notes.txt`]: 'Notatka: czasem warto zajrzec tam, gdzie zwykle nie patrzysz.',
    [`${HOME}/documents/readme.txt`]: 'Laboratorium treningowe CTF Master.',
    [`${HOME}/.vault/flag.txt`]: FLAG,
    '/var/log/system.log': '2026-10-29 INFO lab: simulated system started',
    '/var/log/auth.log': '2026-10-29 08:00 INFO sshd accepted session\n2026-10-29 08:04 DENIED sshd failed login for root\n2026-10-29 08:05 INFO sshd session closed',
    [`${HOME}/documents/cases/evidence-47.txt`]: 'Case 47: unexpected connection discovered in auth.log',
    [`${HOME}/downloads/incident.tmp`]: 'incident-47: save this evidence before cleanup',
    [`${HOME}/downloads/stale.tmp`]: 'old cache - no evidence'
  }
});

export function resolvePath(cwd: string, requested: string): string {
  const expanded = requested === '~' ? HOME : requested.startsWith('~/') ? HOME + requested.slice(1) : requested;
  const parts = (expanded.startsWith('/') ? expanded : `${cwd}/${expanded}`).split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return '/' + stack.join('/');
}

function tokenize(raw: string): string[] | null {
  const tokens: string[] = [];
  const matcher = /(?:"([^"]*)"|'([^']*)'|([^\s'" ]+))/g;
  let last = 0;
  for (const match of raw.matchAll(matcher)) {
    if (match.index !== undefined && raw.slice(last, match.index).trim()) return null;
    tokens.push(match[1] ?? match[2] ?? match[3]);
    last = (match.index ?? 0) + match[0].length;
  }
  if (raw.slice(last).trim()) return null;
  return tokens;
}

const parent = (p: string) => p === '/' ? '/' : p.slice(0, p.lastIndexOf('/')) || '/';
const base = (p: string) => p === '/' ? '/' : p.slice(p.lastIndexOf('/') + 1);

export function executeLinux(state: LinuxState, raw: string): CommandResult {
  const command = raw.trim();
  const parts = tokenize(command);
  const done = (output: string, ok = true, nextState = state, target?: string, clear = false): CommandResult => ({
    output, ok, state: nextState, command: parts?.[0] ?? '', target, clear
  });
  if (!parts || parts.length === 0) return done('Wpisz polecenie.', false);
  const [cmd, ...args] = parts;
  const argPath = (v: string) => resolvePath(state.cwd, v);
  const exists = (path: string) => state.dirs.includes(path) || Object.hasOwn(state.files, path);

  switch (cmd) {
    case 'help':
      return done('Dostepne: pwd, ls [-a] [-l], cd, cat, mkdir, touch, cp, mv, rm, grep [-i], find [-name], whoami, clear, help. Brak potokow i przekierowan.');
    case 'whoami':
      return args.length ? done('whoami: nieoczekiwany argument', false) : done('player');
    case 'pwd':
      return args.length ? done('pwd: nieoczekiwany argument', false) : done(state.cwd);
    case 'clear':
      return args.length ? done('clear: nieoczekiwany argument', false) : done('', true, state, undefined, true);
    case 'ls': {
      let showAll = false;
      let long = false;
      let pathArg: string | null = null;
      for (const arg of args) {
        if (arg.startsWith('-') && arg !== '-') {
          for (const flag of arg.slice(1)) {
            if (flag === 'a') showAll = true;
            else if (flag === 'l') long = true;
            else return done(`ls: nieznana opcja -${flag}`, false);
          }
        } else if (pathArg === null) pathArg = arg;
        else return done('ls: w tym laboratorium podaj jedna sciezke', false);
      }
      const path = argPath(pathArg ?? '.');
      if (!exists(path)) return done(`ls: ${pathArg ?? '.'}: No such file or directory`, false);
      if (Object.hasOwn(state.files, path)) return done(base(path), true, state, path);
      const items = [
        ...state.dirs.filter(v => v !== path && parent(v) === path).map(v => ({path:v, type:'d'})),
        ...Object.keys(state.files).filter(v => parent(v) === path).map(v => ({path:v, type:'-'}))
      ].filter(v => showAll || !base(v.path).startsWith('.')).sort((a,b) => a.path.localeCompare(b.path));
      const lines = items.map(v => long ? `${v.type}rw-r--r-- player player  ${base(v.path)}` : base(v.path));
      return done(lines.join('\n') || '(pusty katalog)', true, state, path);
    }
    case 'cd': {
      if (args.length > 1) return done('cd: zbyt wiele argumentow', false);
      const path = argPath(args[0] ?? '~');
      if (!state.dirs.includes(path)) return done(`cd: ${args[0] ?? '~'}: No such directory`, false);
      return done('', true, {...state, cwd:path}, path);
    }
    case 'cat': {
      if (args.length !== 1) return done('Uzycie: cat PLIK', false);
      const path = argPath(args[0]);
      if (!Object.hasOwn(state.files, path)) return done(`cat: ${args[0]}: No such file`, false);
      return done(state.files[path], true, state, path);
    }
    case 'mkdir': {
      if (args.length !== 1) return done('Uzycie: mkdir KATALOG', false);
      const path = argPath(args[0]);
      if (exists(path)) return done(`mkdir: ${args[0]}: File exists`, false);
      if (!state.dirs.includes(parent(path))) return done(`mkdir: ${args[0]}: No such parent directory`, false);
      return done('', true, {...state, dirs:[...state.dirs, path]}, path);
    }
    case 'touch': {
      if (args.length !== 1) return done('Uzycie: touch PLIK', false);
      const path = argPath(args[0]);
      if (state.dirs.includes(path)) return done(`touch: ${args[0]}: Is a directory`, false);
      if (!state.dirs.includes(parent(path))) return done(`touch: ${args[0]}: No such parent directory`, false);
      return done('', true, {...state, files:{...state.files, [path]:state.files[path] ?? ''}}, path);
    }
    case 'cp':
    case 'mv': {
      if (args.length !== 2 || args.some(a => a.startsWith('-'))) return done(`Uzycie: ${cmd} PLIK CEL (bez opcji)`, false);
      const src = argPath(args[0]);
      if (!Object.hasOwn(state.files, src)) return done(`${cmd}: zrodlo nie jest plikiem lub nie istnieje`, false);
      const requestedDst = argPath(args[1]);
      const dst = state.dirs.includes(requestedDst) ? resolvePath(requestedDst, base(src)) : requestedDst;
      if (!state.dirs.includes(parent(dst))) return done(`${cmd}: katalog docelowy nie istnieje`, false);
      if (state.dirs.includes(dst)) return done(`${cmd}: cel jest katalogiem`, false);
      if (src === dst) return done(`${cmd}: zrodlo i cel sa identyczne`, false);
      const files = {...state.files, [dst]: state.files[src]};
      if (cmd === 'mv') delete files[src];
      return done('', true, {...state, files}, dst);
    }
    case 'rm': {
      if (args.length !== 1 || args[0].startsWith('-')) return done('Uzycie: rm PLIK (bez opcji, bez katalogow)', false);
      const path = argPath(args[0]);
      if (!Object.hasOwn(state.files, path)) return done('rm: plik nie istnieje (katalogi nie sa obslugiwane)', false);
      const files = {...state.files};
      delete files[path];
      return done('', true, {...state, files}, path);
    }
    case 'grep': {
      const rest = [...args];
      let insensitive = false;
      if (rest[0] === '-i') { insensitive = true; rest.shift(); }
      if (rest.length !== 2 || rest.some(a => !a || a.startsWith('-'))) return done('Uzycie: grep [-i] TEKST PLIK (szuka doslownego tekstu)', false);
      const path = argPath(rest[1]);
      if (!Object.hasOwn(state.files, path)) return done('grep: plik nie istnieje', false);
      const needle = insensitive ? rest[0].toLowerCase() : rest[0];
      const matches = state.files[path].split('\n').filter(line => (insensitive ? line.toLowerCase() : line).includes(needle));
      if (!matches.length) return done('(brak dopasowan)', false, state, path);
      return done(matches.join('\n'), true, state, path);
    }
    case 'find': {
      let from = '.';
      let pattern: string | null = null;
      if (args.length && args[0] !== '-name') from = args[0];
      const rest = args.slice(from === '.' ? 0 : 1);
      if (rest.length === 2 && rest[0] === '-name') pattern = rest[1];
      else if (rest.length !== 0) return done('Uzycie: find [KATALOG] [-name WZORZEC]', false);
      if (pattern !== null && pattern.length > 128) return done('find: wzorzec jest za dlugi', false);
      const root = argPath(from);
      if (!exists(root)) return done('find: sciezka nie istnieje', false);
      const glob = pattern === null ? null : new RegExp('^' + pattern.split('').map(ch => ch === '*' ? '.*' : ch === '?' ? '.' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\    default:
      return done(`${cmd}: command not found (symulator obsluguje ograniczony zestaw polecen)`, false);')).join('') + '
  }
}

export const simulatedFlag = FLAG;
);
      const paths = [...state.dirs, ...Object.keys(state.files)]
        .filter(path => path === root || path.startsWith(root === '/' ? '/' : root + '/'))
        .filter(path => !glob || glob.test(base(path))).sort();
      return done(paths.join('\n') || '(brak wynikow)', true, state, root);
    }
    default:
      return done(`${cmd}: command not found (symulator obsluguje ograniczony zestaw polecen)`, false);
  }
}

export const simulatedFlag = FLAG;

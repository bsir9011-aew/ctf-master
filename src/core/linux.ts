import { modeOf, modeString, modeOctal, nextMode, hasAccess, canReadFile, canListDir, canTraverse, canWriteDir, ownerOf, ownerNames, type SimOwner } from './permissions.ts';
import { executeProcessCommand, initialProcesses, initialServices, type SimProcess, type SimService } from './processes.ts';
import { initialNetwork, executeNetworkCommand, type NetworkState } from './network.ts';
import { executeDiagnosticCommand } from './diagnostics.ts';
import { executeTextCommand, isTextCommand } from './textCommands.ts';
import { executePipeline, splitPipeline } from './pipelines.ts';
import { executeManual } from './manual.ts';
import { executeNamei } from './namei.ts';
import { executeChgrp } from './chgrp.ts';
import {parseRedirection,executeRedirection} from './redirection.ts';
import {tokenizeShellWords} from './shellSyntax.ts';
import {finishCommand,previousExitCode} from './exitStatus.ts';
import { executeUmask, newFileMode, newDirectoryMode, DEFAULT_UMASK } from './umask.ts';
import { defaultIdentity, executeIdentityCommand, identityOf, type SimIdentity } from './identity.ts';

/** Deterministic in-browser simulator: NEVER executes input on the host OS. */
export interface LinuxState {
  cwd: string;
  dirs: string[];
  files: Record<string, string>;
  permissions?: Record<string, number>;
  ownership?: Record<string, SimOwner>;
  processes?: SimProcess[];
  services?: Record<string, SimService>;
  network?: NetworkState;
  identity?: SimIdentity;
  umask?: number;
  lastExitCode?: number;
}

export interface CommandResult {
  state: LinuxState;
  output: string;
  ok: boolean;
  command: string;
  stages?: string[];
  filterPattern?: string;
  grepCaseInsensitive?: boolean;
  blockedAt?: string;
  target?: string;
  clear?: boolean;
  redirectMode?: 'overwrite'|'append';
  sourceCommand?: string;
  exitCode?: number;
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
    '/var/log/app.log': '2026-10-29 09:00 INFO service ready\n2026-10-29 09:12 ALERT anomalous access detected\n2026-10-29 09:13 INFO investigation queued',
    [`${HOME}/documents/cases/evidence-47.txt`]: 'Case 47: unexpected connection discovered in auth.log',
    [`${HOME}/downloads/incident.tmp`]: 'incident-47: save this evidence before cleanup',
    [`${HOME}/downloads/stale.tmp`]: 'old cache - no evidence',
    [`${HOME}/documents/credentials.txt`]: 'SIMULATED_CREDENTIAL_DO_NOT_USE',
    [`${HOME}/documents/restricted.log`]: 'RECOVERY: log access restored'
  },
  ownership: {},
  permissions: {
    [`${HOME}/documents/credentials.txt`]: 0o644,
    [`${HOME}/documents/restricted.log`]: 0o000
  },
  processes: initialProcesses(),
  services: initialServices(),
  network: initialNetwork(),
  identity: defaultIdentity(),
  umask: DEFAULT_UMASK,
  lastExitCode:0
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

const tokenize=tokenizeShellWords;

const parent = (p: string) => p === '/' ? '/' : p.slice(0, p.lastIndexOf('/')) || '/';
const base = (p: string) => p === '/' ? '/' : p.slice(p.lastIndexOf('/') + 1);

export function executeLinux(state: LinuxState, raw: string): CommandResult {
  return finishCommand(state,runLinux(state,raw));
}

/** Internal execution does not update $? for stages within a pipeline/redirect. */
function runLinux(state: LinuxState, raw: string): CommandResult {
  const command = raw.trim();
  const redirect=parseRedirection(command);
  if(redirect===null)return {state,output:'przekierowanie: niepoprawna skladnia',ok:false,command:'redirect'};
  if(redirect)return executeRedirection(state,redirect,tokenize,
    path=>resolvePath(state.cwd,path),source=>runLinux(state,source));
  if(command.includes('|')) {
    const segments=splitPipeline(command);
    if(!segments) return {state,output:'potok: niepoprawna skladnia lub cytowanie',
      ok:false,command:'pipeline'};
    if(segments.length>1)
      return executePipeline(state,segments,tokenize,part=>runLinux(state,part));
  }
  const parts = tokenize(command);
  const done = (output: string, ok = true, nextState = state, target?: string, clear = false): CommandResult => ({
    output, ok, state: nextState, command: parts?.[0] ?? '', target, clear
  });
  if(!parts)return done('Niepoprawne cytowanie, escape lub nieobsługiwany operator powłoki.',false);
  if(parts.length===0)return done('Wpisz polecenie.',false);
  const [cmd, ...args] = parts;
  const argPath = (v: string) => resolvePath(state.cwd, v);
  const exists = (path: string) => state.dirs.includes(path) || Object.hasOwn(state.files, path);
  const current=identityOf(state);
  const newOwner=():SimOwner=>({uid:current.uid,gid:current.primary.gid});
  const longEntry=(path:string)=> {
    const names=ownerNames(state,path);
    return modeString(state,path)+' '+names.user+' '+names.group+'  '+base(path);
  };

  if (cmd === 'ps' || cmd === 'kill' || cmd === 'systemctl' || cmd === 'journalctl') {
    return executeProcessCommand(state, cmd, args);
  }

  if (cmd === 'resolvectl' || cmd === 'nslookup' || cmd === 'nc' || cmd === 'trace') {
    return executeDiagnosticCommand(state,cmd,args);
  }
  if (cmd === 'ip' || cmd === 'ping' || cmd === 'ss') {
    return executeNetworkCommand(state,cmd,args);
  }

  if (isTextCommand(cmd)) return executeTextCommand(state,cmd,args,argPath);
  if (cmd === 'man') return executeManual(state,args);
  if (cmd === 'namei') return executeNamei(state,args,argPath);
  if (cmd === 'chgrp') return executeChgrp(state,args,argPath);
  if (cmd === 'umask') return executeUmask(state,args);
  if (cmd === 'id' || cmd === 'groups') return executeIdentityCommand(state,cmd,args);

  switch (cmd) {
    case 'echo':
      if(/^echo\s+\$\?$/.test(command))return done(String(previousExitCode(state)),true,state,'previous-exit');
      return done('echo: w tej lekcji obslugiwane jest tylko echo $? bez cytowania',false);
    case 'help':
      return done('Dostepne: pwd, ls [-a] [-l], cd, cat, mkdir, touch, cp, mv, rm, grep [-i], find [-name], head [-n N], tail [-n N], wc [-l|-w|-c], sort PLIK, uniq PLIK, chmod MODE SCIEZKA, stat PLIK, namei -l SCIEZKA, umask [NNN], chgrp GRUPA PLIK, man POLECENIE, man -k HASLO, whoami, id [-u|-g|-G], groups, clear, help. chmod: 3 cyfry octal lub u/g/o/a +/- rwx. Procesy: ps [aux], kill PID, systemctl status|start|stop|restart UNIT, journalctl -u UNIT. Siec: ip addr/route/link/neigh, ping -c 1 IP, ss -lnt, resolvectl dns eth0 [IP], nslookup NAZWA, nc -z HOST PORT, trace HOST PORT. Potoki: komenda_czytajaca PLIK | grep|sort|uniq|head|tail|wc (max 5 etapow). Status ostatniej komendy: echo $? (man exit-status). Przekierowania odczytu: POLECENIE > PLIK lub POLECENIE >> PLIK. Sciezki ze spacjami: uzyj cudzyslowow lub backslasha (man quoting); brak podstawiania zmiennych i wykonywania host shell.');
    case 'whoami':
      return args.length ? done('whoami: nieoczekiwany argument', false) : done(identityOf(state).user);
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
      if (!canTraverse(state,path)) return done('ls: Permission denied (katalog nadrzedny)',false);
      if (Object.hasOwn(state.files, path)) return done(long ? longEntry(path) : base(path), true, state, path);
      if (!canListDir(state,path)) return done('ls: Permission denied (brak r/x katalogu)',false);
      const items = [
        ...state.dirs.filter(v => v !== path && parent(v) === path).map(v => ({path:v, type:'d'})),
        ...Object.keys(state.files).filter(v => parent(v) === path).map(v => ({path:v, type:'-'}))
      ].filter(v => showAll || !base(v.path).startsWith('.')).sort((a,b) => a.path.localeCompare(b.path));
      const lines = items.map(v => long ? longEntry(v.path) : base(v.path));
      return done(lines.join('\n') || '(pusty katalog)', true, state, path);
    }
    case 'cd': {
      if (args.length > 1) return done('cd: zbyt wiele argumentow', false);
      const path = argPath(args[0] ?? '~');
      if (Object.hasOwn(state.files, path)) return done(`cd: ${args[0] ?? '~'}: Not a directory`, false);
      if (!state.dirs.includes(path)) return done(`cd: ${args[0] ?? '~'}: No such directory`, false);
      if (!canTraverse(state,path)||!hasAccess(state,path,'x')) return done('cd: Permission denied (brak x katalogu)',false);
      return done('', true, {...state, cwd:path}, path);
    }
    case 'cat': {
      if (args.length !== 1) return done('Uzycie: cat PLIK', false);
      const path = argPath(args[0]);
      if (!Object.hasOwn(state.files, path)) return done(`cat: ${args[0]}: No such file`, false);
      if (!canReadFile(state,path)) return done(`cat: ${args[0]}: Permission denied`, false);
      return done(state.files[path], true, state, path);
    }
    case 'mkdir': {
      if (args.length !== 1) return done('Uzycie: mkdir KATALOG', false);
      const path = argPath(args[0]);
      if (exists(path)) return done(`mkdir: ${args[0]}: File exists`, false);
      if (!state.dirs.includes(parent(path))) return done(`mkdir: ${args[0]}: No such parent directory`, false);
      if (!canWriteDir(state,parent(path))) return done('mkdir: Permission denied',false);
      return done('', true, {...state, dirs:[...state.dirs, path],
        ownership:{...state.ownership,[path]:newOwner()},
        permissions:{...state.permissions,[path]:newDirectoryMode(state)}}, path);
    }
    case 'touch': {
      if (args.length !== 1) return done('Uzycie: touch PLIK', false);
      const path = argPath(args[0]);
      if (state.dirs.includes(path)) return done(`touch: ${args[0]}: Is a directory`, false);
      if (!state.dirs.includes(parent(path))) return done(`touch: ${args[0]}: No such parent directory`, false);
      if (!canWriteDir(state,parent(path))) return done('touch: Permission denied',false);
      return done('', true, {...state,
        files:{...state.files, [path]:state.files[path] ?? ''},
        ownership:Object.hasOwn(state.files,path)?state.ownership:
          {...state.ownership,[path]:newOwner()},
        permissions:Object.hasOwn(state.files,path)?state.permissions:
          {...state.permissions,[path]:newFileMode(state)}}, path);
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
      if (cmd==='cp' && !canReadFile(state,src))
        return done('cp: Permission denied (source unreadable)', false);
      if (!canWriteDir(state,parent(dst)) ||
          (cmd==='mv' && !canWriteDir(state,parent(src))))
        return done(cmd+': Permission denied (directory)',false);
      if (Object.hasOwn(state.files,dst) &&
          cmd==='cp' && !hasAccess(state,dst,'w'))
        return done('cp: Permission denied (destination unwritable)',false);
      if (cmd==='mv' && !canTraverse(state,src)) return done('mv: Permission denied',false);
      const files = {...state.files, [dst]: state.files[src]};
      const permissions = {...state.permissions};
      const ownership={...state.ownership};
      if (cmd === 'mv') {
        permissions[dst]=modeOf(state,src);
        ownership[dst]=ownerOf(state,src);
        delete files[src];delete permissions[src];delete ownership[src];
      } else if (!Object.hasOwn(state.files,dst)) {
        permissions[dst]=newFileMode(state);
        ownership[dst]=newOwner();
      }
      return done('', true, {...state, files, permissions,ownership}, dst);
    }
    case 'rm': {
      if (args.length !== 1 || args[0].startsWith('-')) return done('Uzycie: rm PLIK (bez opcji, bez katalogow)', false);
      const path = argPath(args[0]);
      if (!Object.hasOwn(state.files, path)) return done('rm: plik nie istnieje (katalogi nie sa obslugiwane)', false);
      if (!canWriteDir(state,parent(path))) return done('rm: Permission denied',false);
      const files = {...state.files};
      delete files[path];
      const permissions = {...state.permissions};
      const ownership={...state.ownership};
      delete permissions[path];delete ownership[path];
      return done('', true, {...state, files, permissions,ownership}, path);
    }
    case 'grep': {
      const rest = [...args];
      let insensitive = false;
      if (rest[0] === '-i') { insensitive = true; rest.shift(); }
      if (rest.length !== 2 || rest.some(a => !a || a.startsWith('-'))) return done('Uzycie: grep [-i] TEKST PLIK (szuka doslownego tekstu)', false);
      const path = argPath(rest[1]);
      if (!Object.hasOwn(state.files, path)) return done('grep: plik nie istnieje', false);
      if (!canReadFile(state,path)) return done('grep: Permission denied', false);
      const needle = insensitive ? rest[0].toLowerCase() : rest[0];
      const matches = state.files[path].split('\n').filter(line => (insensitive ? line.toLowerCase() : line).includes(needle));
      if (!matches.length)return {...done('(brak dopasowan)',false,state,path),filterPattern:rest[0],grepCaseInsensitive:insensitive};
      return {...done(matches.join('\n'),true,state,path),filterPattern:rest[0],grepCaseInsensitive:insensitive};
    }
    case 'stat': {
      if (args.length !== 1) return done('Uzycie: stat PLIK_LUB_KATALOG', false);
      const path = argPath(args[0]);
      if (!exists(path)) return done('stat: No such file or directory', false);
      if (!canTraverse(state,path)) return done('stat: Permission denied',false);
      const owner=ownerOf(state,path),names=ownerNames(state,path);
      return done(`${path}: mode ${modeOctal(state,path)} (${modeString(state,path)}), owner ${names.user} (uid=${owner.uid}), group ${names.group} (gid=${owner.gid})`,true,state,path);
    }
    case 'chmod': {
      if (args.length !== 2) return done('Uzycie: chmod MODE PLIK', false);
      const path = argPath(args[1]);
      if (!exists(path)) return done('chmod: No such file or directory',false);
      if (!canTraverse(state,path) || ownerOf(state,path).uid!==current.uid)
        return done('chmod: Permission denied (not file owner or inaccessible path)',false);
      const updated = nextMode(modeOf(state, path), args[0]);
      if (updated === null) return done('chmod: nieobslugiwany MODE, uzyj 600 lub u+r / go-rwx', false);
      return done('', true, {...state, permissions:{...state.permissions, [path]:updated}}, path);
    }
    case 'find': {
      let from = '.';
      let pattern: string | null = null;
      // Explicit "." consumes an argument just like any other search root.
      const explicitRoot = args.length > 0 && args[0] !== '-name';
      if (explicitRoot) from = args[0];
      const rest = args.slice(explicitRoot ? 1 : 0);
      if (rest.length === 2 && rest[0] === '-name') pattern = rest[1];
      else if (rest.length !== 0) return done('Uzycie: find [KATALOG] [-name WZORZEC]', false);
      if (pattern !== null && pattern.length > 128) return done('find: wzorzec jest za dlugi', false);
      const root = argPath(from);
      if (!exists(root)) return done('find: sciezka nie istnieje', false);
      if (!canTraverse(state,root) || (state.dirs.includes(root) && !canListDir(state,root))) return done('find: Permission denied',false);
      const glob = pattern === null ? null : new RegExp('^' + pattern.split('').map(ch => ch === '*' ? '.*' : ch === '?' ? '.' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('') + '$');
      const paths = [...state.dirs, ...Object.keys(state.files)]
        .filter(path => path === root || path.startsWith(root === '/' ? '/' : root + '/'))
        .filter(path=>canTraverse(state,path) &&
          (path===root || !state.dirs.includes(parent(path)) || canListDir(state,parent(path))))
        .filter(path => !glob || glob.test(base(path))).sort();
      return done(paths.join('\n') || '(brak wynikow)', true, state, root);
    }
    default:
      return done(`${cmd}: command not found (symulator obsluguje ograniczony zestaw polecen)`, false);
  }
}

export const simulatedFlag = FLAG;

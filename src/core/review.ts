import { executeLinux, initialLinux, type CommandResult, type LinuxState } from './linux.ts';
import type { LearningMap } from './learning';
import { modeOf } from './permissions.ts';
import type { SimProcess, SimService } from './processes.ts';

/** Isolated practice environments. Original mission files and progress stay untouched. */
export type ReviewSkill = 'log-search' | 'file-search' | 'backup' | 'permissions' | 'processes' | 'services';
export interface ReviewLine { input?: string; output: string; ok: boolean }
export interface ReviewAttempt {
  skill: ReviewSkill;
  variantId: string;
  state: LinuxState;
  events: CommandResult[];
  lines: ReviewLine[];
  commands: number;
  errors: number;
  hints: number;
  usedHelp: boolean;
  completed: boolean;
  independent: boolean;
}
export interface SkillRecord { attempts: number; streak: number }
export type ReviewHistory = Partial<Record<ReviewSkill, SkillRecord>>;

export interface ReviewScenario {
  id: string;
  skill: ReviewSkill;
  title: string;
  briefing: string;
  hints: [string, string, string];
  dirs: string[];
  files: Record<string, string>;
  permissions?: Record<string, number>;
  processes?: SimProcess[];
  services?: Record<string, SimService>;
  success: (state: LinuxState, events: CommandResult[]) => boolean;
}

const HOME = '/home/player';
const readExact = (events: CommandResult[], path: string, marker?: string): boolean =>
  events.some(e => e.ok && (e.command === 'cat' || e.command === 'grep') &&
    e.target === path && (!marker || e.output.includes(marker)));

function logCase(id: string, title: string, path: string, token: string, contents: string): ReviewScenario {
  return {
    id, skill:'log-search', title,
    briefing:'W dzienniku ' + path + ' znajduje sie wpis z oznaczeniem ' + token +
      '. Znajdz i odczytaj wiersz dotyczacy zdarzenia.',
    hints:['Jeden dziennik moze zawierac wiele wierszy.', 'Szukaj tekstu w pliku zamiast recznie przegladac wszystko.', 'Polecenie grep wyszukuje wzorzec w podanym pliku.'],
    dirs:[], files:{[path]:contents},
    success:(_state, events) => readExact(events, path, token)
  };
}

function findCase(id: string, title: string, folder: string, filename: string, body: string): ReviewScenario {
  const path = folder + '/' + filename;
  return {
    id, skill:'file-search', title,
    briefing:'W katalogu documents znajduje sie gdzies ' + filename +
      '. Znajdz jego sciezke, a nastepnie odczytaj zawartosc.',
    hints:['Plik moze byc ukryty w podkatalogu.', 'Do rekurencyjnego wyszukiwania plikow sluzy find.', 'Wyszukaj nazwe pliku w ~/documents, potem uzyj cat.'],
    dirs:[folder], files:{[path]:body},
    success:(_state, events) =>
      events.some(e => e.ok && e.command === 'find' && e.output.includes(path)) &&
      events.some(e => e.ok && e.command === 'cat' && e.target === path)
  };
}

function backupCase(id: string, title: string, source: string, target: string, contents: string): ReviewScenario {
  return {
    id, skill:'backup', title,
    briefing:'Zachowaj kompletna kopie dziennika ' + source + ' jako ' + target +
      '. Plik zrodlowy musi pozostac nienaruszony.',
    hints:['Kopia musi miec identyczna zawartosc.', 'Przenoszenie i kopiowanie to rozne operacje.', 'Uzyj cp, wskazujac dwa pelne adresy plikow.'],
    dirs:[], files:{[source]:contents},
    success:(state, _events) =>
      Object.hasOwn(state.files, target) &&
      Object.hasOwn(state.files, source) &&
      state.files[target] === contents &&
      state.files[source] === contents
  };
}

function hardeningCase(): ReviewScenario {
  const path = HOME + '/documents/team.key';
  return {
    id:'perm-a', skill:'permissions', title:'Dostep tylko dla wlasciciela',
    briefing:'Plik ~/documents/team.key ma domyslne uprawnienia. Ogranicz go do odczytu i zapisu wylacznie przez wlasciciela.',
    hints:['Sprawdz, kto moze odczytac plik.', 'stat pokazuje tryb, chmod pozwala go zmienic.', 'Ustaw 600 dla tego pliku.'],
    dirs:[], files:{[path]:'SIMULATED_TEAM_KEY'}, permissions:{[path]:0o644},
    success:(state) => modeOf(state,path) === 0o600 && Object.hasOwn(state.files,path)
  };
}
function recoveryCase(): ReviewScenario {
  const path = HOME + '/documents/audit-review.log';
  return {
    id:'perm-b', skill:'permissions', title:'Zablokowany dziennik',
    briefing:'Odczytaj wpis AUDIT w ~/documents/audit-review.log. Na poczatku konto player nie ma prawa odczytu. Nie przyznawaj praw grupie ani pozostalym.',
    hints:['Brak odczytu nie oznacza, ze plik nie istnieje.', 'stat i chmod pozwalaja zidentyfikowac i naprawic problem.', 'Nadaj tylko wlascicielowi prawo odczytu, potem otworz plik.'],
    dirs:[], files:{[path]:'AUDIT: training event'}, permissions:{[path]:0o000},
    success:(state,events) => (modeOf(state,path) & 0o477) === 0o400 && readExact(events,path,'AUDIT')
  };
}

function processCase(id:string, name:string, pid:number): ReviewScenario {
  return {
    id, skill:'processes',title:'Zatrzymaj proces: '+name,
    briefing:'W liscie procesow znajdz '+name+' i zakoncz go. Nie naruszaj innych procesow.',
    hints:['Zidentyfikuj proces po nazwie.', 'ps wyswietla PID, kill konczy proces.', 'Uzyj ps, a nastepnie kill z PID znalezionego procesu.'],
    dirs:[],files:{},
    processes:[{pid,name,running:true}],
    success:(state,events) =>
      state.processes?.some(p=>p.pid===pid && p.name===name && !p.running) === true &&
      events.some(e=>e.ok && e.command==='ps' && e.output.includes(name)) &&
      events.some(e=>e.ok && e.command==='kill' && e.target==='pid:'+pid)
  };
}

function serviceCase(id:string, unit:string, pid:number): ReviewScenario {
  return {
    id,skill:'services',title:'Przywroc '+unit+'.service',
    briefing:'Usluga '+unit+' ma awarie. Sprawdz stan, znajdz przyczyne w dzienniku i przywroc dzialanie.',
    hints:['Zacznij od stanu jednostki.', 'systemctl status i journalctl -u umozliwiaja diagnostyke.', 'Sprawdz status i dziennik, potem uruchom ponownie wskazana usluge.'],
    dirs:[],files:{},
    services:{[unit]:{status:'failed',pid,journal:['09:12 '+unit+': transient worker crash (exit 1)','09:13 systemd: '+unit+'.service failed']}},
    processes:[{pid,name:unit==='web'?'webd':'queue-worker',service:unit,running:false}],
    success:(state,events) =>
      state.services?.[unit]?.status==='active' &&
      state.processes?.some(p=>p.pid===pid && p.service===unit && p.running) === true &&
      events.some(e=>e.ok && e.command==='systemctl' && e.target===unit+'.service' && e.output.includes('failed')) &&
      events.some(e=>e.ok && e.command==='journalctl' && e.target===unit+'.service' && e.output.includes('crash'))
  };
}

export const reviewScenarios: ReviewScenario[] = [
  logCase('log-a', 'Tajemniczy firewall', '/var/log/firewall.log', 'BLOCK',
    '10:05 INFO started\n10:08 BLOCK outbound 10.0.0.13\n10:11 INFO idle'),
  logCase('log-b', 'Awaria kolejki', '/var/log/queue.log', 'ERROR',
    '11:22 INFO worker alive\n11:24 ERROR queue exceeded limit\n11:30 INFO worker ready'),
  findCase('find-a', 'Zapomniany raport', HOME + '/documents/reports', 'trace-21.txt',
    'Dowod: zmiana parametru 21'),
  findCase('find-b', 'Archiwum audytu', HOME + '/documents/audit', 'case-63.txt',
    'Dowod: audit 63'),
  backupCase('backup-a', 'Kopia sieciowa', '/var/log/network.log', HOME + '/documents/network-copy.log',
    '12:02 INFO route up\n12:04 WARN packet drop'),
  backupCase('backup-b', 'Kopia DNS', '/var/log/dns.log', HOME + '/documents/dns-copy.log',
    '13:10 INFO query resolved\n13:16 WARN dns timeout'),
  hardeningCase(),
  recoveryCase(),
  processCase('proc-a','cpu-burn',424),
  processCase('proc-b','log-spammer',425),
  serviceCase('svc-a','web',331),
  serviceCase('svc-b','queue',350)
];

export const reviewSkills: {id:ReviewSkill; title:string; missionIds:string[]}[] = [
  {id:'log-search', title:'Wyszukiwanie w logach', missionIds:['log-hunt','transfer-investigation']},
  {id:'file-search', title:'Odnajdywanie dowodow', missionIds:['evidence-search']},
  {id:'backup', title:'Zabezpieczanie kopii', missionIds:['backup-evidence']},
  {id:'permissions', title:'Uprawnienia plikow', missionIds:['file-hardening','permission-recovery']},
  {id:'processes', title:'Kontrola procesow', missionIds:['runaway-process']},
  {id:'services', title:'Diagnostyka uslug', missionIds:['web-service-recovery']}
];

const skills = new Set<ReviewSkill>(reviewSkills.map(s => s.id));
const isSkill = (value: unknown): value is ReviewSkill => typeof value === 'string' && skills.has(value as ReviewSkill);

export function restoreReviewHistory(raw: unknown): ReviewHistory {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const input = raw as Record<string, unknown>;
  const result: ReviewHistory = {};
  for (const skill of reviewSkills) {
    const value = input[skill.id];
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const record = value as Partial<SkillRecord>;
    if (!Number.isSafeInteger(record.attempts) || (record.attempts ?? -1) < 0) continue;
    const attempts = Math.min(record.attempts!, 99999);
    const streak = Number.isInteger(record.streak) ? Math.min(2, Math.max(0, record.streak!)) : 0;
    result[skill.id] = {attempts, streak};
  }
  return result;
}

export function availableReviews(completedIds: string[], learning: LearningMap, history: ReviewHistory) {
  return reviewSkills
    .filter(skill => skill.missionIds.some(id => completedIds.includes(id)))
    .map(skill => {
      const sources = skill.missionIds.map(id => learning[id]).filter(x => x !== undefined);
      const weakness = sources.reduce((sum, record) =>
        sum + record.errors * 2 + record.hints + Number(record.usedHelp) + Number(!record.independent), 0);
      const streak = history[skill.id]?.streak ?? 0;
      return {...skill, weakness, streak, recommended:weakness > 0 && streak < 2};
    })
    .sort((a,b) => Number(b.recommended) - Number(a.recommended) || b.weakness - a.weakness);
}

export function createReviewAttempt(skill: ReviewSkill, history: ReviewHistory): ReviewAttempt {
  if (!isSkill(skill)) throw Error('Unsupported review skill');
  const list = reviewScenarios.filter(item => item.skill === skill);
  const index = (history[skill]?.attempts ?? 0) % list.length;
  const variant = list[index];
  const base = initialLinux();
  const state: LinuxState = {
    cwd:base.cwd,
    dirs:[...new Set([...base.dirs, ...variant.dirs])],
    files:{...base.files, ...variant.files},
    permissions:{...base.permissions, ...variant.permissions},
    processes:[...(base.processes ?? []).filter(p=>!variant.processes?.some(v=>v.pid===p.pid)),
      ...(variant.processes ?? [])],
    services:{...base.services, ...variant.services}
  };
  return {
    skill, variantId:variant.id, state, events:[],
    lines:[{output:'Nowa sesja treningowa. Polecenia dzialaja tylko w symulatorze.', ok:true}],
    commands:0, errors:0, hints:0, usedHelp:false, completed:false, independent:false
  };
}

export function restoreReviewAttempt(raw: unknown): ReviewAttempt | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const x = raw as Partial<ReviewAttempt>;
  if (!isSkill(x.skill) || !reviewScenarios.some(c => c.id === x.variantId && c.skill === x.skill)) return null;
  if (!x.state || typeof x.state.cwd !== 'string' || !Array.isArray(x.state.dirs) || !x.state.files ||
      typeof x.state.files !== 'object' || Array.isArray(x.state.files) ||
      !Array.isArray(x.events) || !Array.isArray(x.lines)) return null;
  if (![x.commands, x.errors, x.hints].every(n => Number.isInteger(n) && n! >= 0)) return null;
  return {
    skill:x.skill, variantId:x.variantId!, state:x.state,
    events:x.events.slice(-100), lines:x.lines.slice(-45),
    commands:x.commands!, errors:x.errors!, hints:Math.min(x.hints!,3),
    usedHelp:x.usedHelp === true, completed:x.completed === true, independent:x.independent === true
  };
}

export const getReviewScenario = (attempt: ReviewAttempt) =>
  reviewScenarios.find(c => c.id === attempt.variantId && c.skill === attempt.skill)!;

export function addReviewHint(attempt: ReviewAttempt): ReviewAttempt {
  return attempt.completed ? attempt : {...attempt, hints:Math.min(3, attempt.hints + 1)};
}
export function markReviewHelp(attempt: ReviewAttempt): ReviewAttempt {
  return attempt.completed ? attempt : {...attempt, usedHelp:true};
}

export function runReviewCommand(attempt: ReviewAttempt, history: ReviewHistory, raw: string):
  {attempt:ReviewAttempt; history:ReviewHistory} {
  if (attempt.completed || !raw.trim()) return {attempt,history};
  const result = executeLinux(attempt.state,raw);
  const events = [...attempt.events, result].slice(-100);
  const commands = attempt.commands + Number(!['help','clear'].includes(result.command));
  const errors = attempt.errors + Number(!result.ok && !['help','clear'].includes(result.command));
  const usedHelp = attempt.usedHelp || result.command === 'help';
  const scenario = getReviewScenario(attempt);
  const completed = scenario.success(result.state, events);
  const independent = completed && errors === 0 && attempt.hints === 0 && !usedHelp;
  const lines = result.clear ? [] : [...attempt.lines, {
    input:attempt.state.cwd + ' $ ' + raw.trim(), output:result.output, ok:result.ok
  }].slice(-45);
  const next: ReviewAttempt = {...attempt, state:result.state, events, lines, commands, errors, usedHelp, completed, independent};
  if (!completed) return {attempt:next, history};
  const before = history[attempt.skill] ?? {attempts:0, streak:0};
  const newStreak = independent ? Math.min(2, before.streak + 1) : 0;
  return {
    attempt:next,
    history:{...history, [attempt.skill]:{attempts:before.attempts+1, streak:newStreak}}
  };
}

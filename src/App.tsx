import { useEffect, useRef, useState } from 'react';
import { executeLinux, initialLinux, type CommandResult, type LinuxState } from './core/linux';
import { missions } from './core/missions';
import { explainError, revealHint, restoreLearning, trackCommand, type LearningMap } from './core/learning';

interface Line { input?: string; output: string; ok: boolean }
interface SavedSession { missionIndex: number; state: LinuxState; events: CommandResult[]; completed: number[]; lines: Line[]; learning: LearningMap }
const STORAGE = 'ctf-master:mvp-03';
const PREVIOUS_STORAGE = 'ctf-master:mvp-02';
const LEGACY_STORAGE = 'ctf-master:mvp-01';

function blankSession(): SavedSession {
  return {missionIndex:0, state:initialLinux(), events:[], completed:[], learning:{}, lines:[{output:'CTF Master - symulowany terminal Linux. Wpisz help, aby poznac polecenia.', ok:true}]};
}

function restore(): SavedSession {
  try {
    const current = localStorage.getItem(STORAGE);
    const previous = localStorage.getItem(PREVIOUS_STORAGE);
    const parsed: unknown = JSON.parse(current ?? previous ?? localStorage.getItem(LEGACY_STORAGE) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return blankSession();
    const p = parsed as Partial<SavedSession>;
    if (!Number.isInteger(p.missionIndex) || !Array.isArray(p.events) || !Array.isArray(p.completed) || !Array.isArray(p.lines) ||
      !p.state || typeof p.state.cwd !== 'string' || !Array.isArray(p.state.dirs) || !p.state.files || typeof p.state.files !== 'object') return blankSession();
    const missionIndex = p.missionIndex!;
    if (missionIndex < 0 || missionIndex >= missions.length) return blankSession();
    if (current === null) {
      // One-time migration: preserve player files/progress; seed only new lab assets.
      const seed = initialLinux();
      const legacyPaths = previous === null
        ? ['/var/log/auth.log', '/home/player/documents/cases/evidence-47.txt', '/home/player/downloads/incident.tmp', '/home/player/downloads/stale.tmp']
        : [];
      const newPaths = [...legacyPaths, '/var/log/app.log'];
      p.state = {...p.state,
        dirs: previous === null ? [...new Set([...p.state.dirs, '/home/player/documents/cases'])] : p.state.dirs,
        files:{...Object.fromEntries(newPaths.filter(path => !Object.hasOwn(p.state!.files, path)).map(path => [path, seed.files[path]])), ...p.state.files}};

    }
    p.learning = restoreLearning(p.learning);
    return p as SavedSession;
  } catch { return blankSession(); }
}

export default function App() {
  const [session, setSession] = useState<SavedSession>(restore);
  const [command, setCommand] = useState('');
  const [feedback, setFeedback] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = missions[session.missionIndex];
  const isComplete = active.success(session.state, session.events);
  const unlocked = Math.max(0, ...session.completed.map(n => n + 1));
  const stats = session.learning[active.id] ?? {commands:0, errors:0, hints:0, usedHelp:false, independent:false};
  const shownHints = stats.hints;
  const lastResult = session.events.at(-1);
  const coach = lastResult ? explainError(lastResult) : null;

  useEffect(() => { try { localStorage.setItem(STORAGE, JSON.stringify(session)); } catch { /* private mode */ } }, [session]);
  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth', block:'nearest'}); }, [session.lines.length]);

  function run(raw: string) {
    if (!raw.trim()) return;
    setFeedback('');
    setSession(old => {
      const result = executeLinux(old.state, raw);
      const events = [...old.events, result].slice(-150);
      const done = missions[old.missionIndex].success(result.state, events);
      const firstCompletion = done && !old.completed.includes(old.missionIndex);
      const completed = firstCompletion ? [...old.completed, old.missionIndex] : old.completed;
      const learning = trackCommand(old.learning, missions[old.missionIndex].id, result, firstCompletion);
      const lines = result.clear ? [] : [...old.lines, {input:`${old.state.cwd} $ ${raw.trim()}`, output:result.output, ok:result.ok}].slice(-45);
      return {...old, state:result.state, events, completed, learning, lines};
    });
    setCommand('');
    inputRef.current?.focus();
  }

  function selectMission(index: number) {
    if (index > unlocked || index >= missions.length) return;
    setSession(old => ({...old, missionIndex:index, events:[], lines:[{output:`Misja: ${missions[index].title}. Wpisz help, jesli potrzebujesz listy komend.`, ok:true}]}));
    setFeedback('');
  }

  function reset() {
    if (!window.confirm('Zresetowac cale laboratorium i zapisany postep?')) return;
    setSession(blankSession()); setCommand(''); setFeedback('');
  }

  return <div className="app-shell">
    <header className="topbar"><div className="brand-mark" aria-hidden="true">&gt;_</div><div><strong>CTF MASTER</strong><span>Linux Explorer / MVP 0.3</span></div><span className="offline-tag">LOCAL SIM</span></header>
    <main>
      <section className="welcome"><p className="eyebrow">TWOJA DROGA DO CTF</p><h1>Ucz się. Eksperymentuj.<br/><em>Zdobywaj flagi.</em></h1><p>To nie quiz z odpowiedziami. Twoje polecenia zmieniają wirtualny system.</p></section>
      <section className="progress-panel" aria-label="Postęp"><div className="progress-heading"><strong>Linux Explorer → Investigator</strong><span>{session.completed.length} / {missions.length} misji</span></div><div className="progress-track"><div style={{width:`${session.completed.length / missions.length * 100}%`}} /></div><div className="missions">{missions.map((m,i) => <button key={m.id} className={`mission-tab ${i === session.missionIndex ? 'selected' : ''}`} onClick={()=>selectMission(i)} disabled={i > unlocked} title={i > unlocked ? 'Najpierw ukoncz poprzednia misje' : m.title}><span>{session.completed.includes(i) ? '✓' : i + 1}</span><small>{m.title}</small></button>)}</div></section>
      <section className="mission-card"><div className="mission-top"><span className="eyebrow">MISJA {String(session.missionIndex + 1).padStart(2,'0')} · {active.category.toUpperCase()}</span><span className="level">{active.category === 'CTF Rookie' ? 'CTF' : active.category === 'Linux Investigator' ? 'INVESTIGATOR' : 'BEGINNER'}</span></div><h2>{active.title}</h2><p>{active.briefing}</p>
        <div className="learning-stats" aria-label="Statystyki misji">
          <span>Polecenia: {stats.commands}</span><span>Nieudane: {stats.errors}</span><span>Podpowiedzi: {stats.hints}/3</span>
        </div>
        {isComplete && <div className="success" role="status">
          <span>✓ Cel misji osiągnięty! {stats.independent ? 'Samodzielnie, bez błędów i podpowiedzi.' : 'Przejdź do kolejnego zadania, aby sprawdzić transfer wiedzy.'}</span>
          {session.missionIndex < missions.length-1 ? <button onClick={()=>selectMission(session.missionIndex+1)}>Następna misja →</button> : <span> Pierwszy etap zakończony.</span>}
        </div>}</section>
      <section className="terminal" aria-label="Symulowany terminal"><div className="terminal-bar"><div className="dots"><i/><i/><i/></div><span>player@ctf-master: {session.state.cwd}</span><span className="terminal-label">SIMULATED</span></div><div className="terminal-output" aria-live="polite">{session.lines.map((line,i) => <div key={i} className="terminal-line">{line.input && <div className="prompt">{line.input}</div>}{line.output && <pre className={line.ok ? '' : 'error'}>{line.output}</pre>}</div>)}<div ref={bottomRef}/></div><form className="command-row" onSubmit={e=>{e.preventDefault();run(command)}}><label htmlFor="cmd">$</label><input ref={inputRef} id="cmd" value={command} onChange={e=>setCommand(e.target.value)} spellCheck={false} autoComplete="off" autoCapitalize="none" autoCorrect="off" placeholder="Wpisz polecenie..." aria-label="Polecenie Linux"/><button type="submit">Wykonaj ↵</button></form></section>
      {coach && <section className="coach-panel" role="status" aria-live="polite">
        <strong>{coach.title}</strong><p>{coach.guidance}</p>
      </section>}
      <section className="help-panel"><div className="help-top"><div><p className="eyebrow">GDY UTKNIESZ</p><h3>Podpowiedzi krok po kroku</h3></div><button className="secondary" onClick={()=>setSession(old=>({...old,learning:revealHint(old.learning,missions[old.missionIndex].id)}))} disabled={shownHints===3}>{shownHints===3?'Wszystkie odkryte':`Odkryj ${shownHints+1}/3`}</button></div>{shownHints===0 ? <p>Najpierw spróbuj sam. Podpowiedzi nie są obowiązkowe.</p> : <ol>{active.hints.slice(0,shownHints).map((h,i)=><li key={i}>{h}</li>)}</ol>}<div className="help-actions"><button className="text-button" onClick={()=>{setFeedback('Wpisz help w terminalu, aby zobaczyć obsługiwane polecenia.')}}>Jakie komendy są dostępne?</button><button className="text-button danger" onClick={reset}>Reset postępu</button></div>{feedback && <p className="hint-feedback">{feedback}</p>}</section>
      <p className="safety-note">To bezpieczny symulator w przeglądarce. Polecenia nie wykonują się w prawdziwym systemie ani na serwerze.</p>
    </main>
  </div>;
}

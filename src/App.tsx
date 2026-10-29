import { useEffect, useRef, useState } from 'react';
import { executeLinux, initialLinux, type CommandResult, type LinuxState } from './core/linux';
import { missions } from './core/missions';
import PacketPath from './components/PacketPath';
import { explainError, markHelp, revealHint, restoreLearning, trackCommand, type LearningMap } from './core/learning';
import {
  addReviewHint, availableReviews, createReviewAttempt, getReviewScenario, markReviewHelp,
  restoreReviewAttempt, restoreReviewHistory, runReviewCommand,
  type ReviewAttempt, type ReviewHistory, type ReviewSkill
} from './core/review';

interface Line { input?: string; output: string; ok: boolean }
interface SavedSession {
  missionIndex:number; state:LinuxState; events:CommandResult[]; completed:number[];
  lines:Line[]; learning:LearningMap;
  reviewAttempt:ReviewAttempt | null; reviewHistory:ReviewHistory;
}
const STORAGE = 'ctf-master:mvp-08';
const V7 = 'ctf-master:mvp-07';
const V6 = 'ctf-master:mvp-06';
const V5 = 'ctf-master:mvp-05';
const V4 = 'ctf-master:mvp-04';
const V3 = 'ctf-master:mvp-03';
const V2 = 'ctf-master:mvp-02';
const V1 = 'ctf-master:mvp-01';

function blankSession(): SavedSession {
  return {
    missionIndex:0, state:initialLinux(), events:[], completed:[], learning:{},
    reviewAttempt:null, reviewHistory:{},
    lines:[{output:'CTF Master - symulowany terminal Linux. Wpisz help, aby poznac polecenia.',ok:true}]
  };
}

function restore(): SavedSession {
  try {
    const v8 = localStorage.getItem(STORAGE);
    const v7 = localStorage.getItem(V7);
    const v6 = localStorage.getItem(V6);
    const v5 = localStorage.getItem(V5);
    const v4 = localStorage.getItem(V4);
    const v3 = localStorage.getItem(V3);
    const v2 = localStorage.getItem(V2);
    const parsed: unknown = JSON.parse(v8 ?? v7 ?? v6 ?? v5 ?? v4 ?? v3 ?? v2 ?? localStorage.getItem(V1) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return blankSession();
    const p = parsed as Partial<SavedSession>;
    if (!Number.isInteger(p.missionIndex) || !Array.isArray(p.events) ||
        !Array.isArray(p.completed) || !Array.isArray(p.lines) ||
        !p.state || typeof p.state.cwd !== 'string' || !Array.isArray(p.state.dirs) ||
        !p.state.files || typeof p.state.files !== 'object' || Array.isArray(p.state.files)) return blankSession();
    const missionIndex = p.missionIndex!;
    if (missionIndex < 0 || missionIndex >= missions.length) return blankSession();
    if (v5 === null) {
      const seed = initialLinux();
      // Historical upgrades still work for users who skipped version 0.3/0.4.
      const needOld = v4 === null && v3 === null;
      const oldPaths = needOld && v2 === null
        ? ['/var/log/auth.log', '/home/player/documents/cases/evidence-47.txt',
           '/home/player/downloads/incident.tmp', '/home/player/downloads/stale.tmp']
        : [];
      const appPaths = needOld ? ['/var/log/app.log'] : [];
      const newPermissionsPaths = [
        '/home/player/documents/credentials.txt',
        '/home/player/documents/restricted.log'
      ];
      const candidates = [...oldPaths, ...appPaths, ...newPermissionsPaths];
      const missing = candidates.filter(path => !Object.hasOwn(p.state!.files, path));
      p.state = {...p.state,
        dirs:needOld && v2 === null
          ? [...new Set([...p.state.dirs, '/home/player/documents/cases'])] : p.state.dirs,
        files:{
          ...Object.fromEntries(missing.map(path => [path, seed.files[path]])),
          ...p.state.files
        },
        permissions:{
          ...Object.fromEntries(newPermissionsPaths.filter(path => missing.includes(path))
            .map(path => [path, seed.permissions?.[path] ?? 0o644])),
          ...p.state.permissions
        }
      };
    }
    if (v6 === null) {
      const seed = initialLinux();
      p.state = {...p.state,
        processes:p.state.processes ?? seed.processes,
        services:p.state.services ?? seed.services
      };
    }
    if (v7 === null) {
      // New virtual networking state; do not mutate user files, hints or completed missions.
      const seed = initialLinux();
      p.state = {...p.state,network:p.state.network ?? seed.network};
    }
    if (v8 === null) {
      const seeded = initialLinux().network!;
      const existing = p.state.network;
      // Add new diagnostics fields without overwriting previously fixed routes.
      p.state = {...p.state,network:{
        ...seeded,...existing,
        arpCache:{...existing?.arpCache},
        remotePorts:[...(existing?.remotePorts ?? seeded.remotePorts ?? [443])]
      }};
    }
    p.learning = restoreLearning(p.learning);
    p.reviewHistory = restoreReviewHistory(p.reviewHistory);
    p.reviewAttempt = restoreReviewAttempt(p.reviewAttempt);
    // Review worlds are independent: they never replace the original saved mission world.
    return p as SavedSession;
  } catch { return blankSession(); }
}

export default function App() {
  const [session,setSession] = useState<SavedSession>(restore);
  const [mode,setMode] = useState<'missions'|'review'>('missions');
  const [command,setCommand] = useState('');
  const [feedback,setFeedback] = useState('');
  const [packetExpanded,setPacketExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mission = missions[session.missionIndex];
  const missionComplete = mission.success(session.state,session.events);
  const unlocked = Math.max(0,...session.completed.map(n => n + 1));
  const stats = session.learning[mission.id] ?? {commands:0,errors:0,hints:0,usedHelp:false,independent:false};
  const reviews = availableReviews(session.completed.map(n => missions[n]?.id).filter((id):id is string => !!id),
    session.learning,session.reviewHistory);
  const review = mode === 'review' ? session.reviewAttempt : null;
  const reviewCase = review ? getReviewScenario(review) : null;
  const lines = review ? review.lines : session.lines;
  const cwd = review ? review.state.cwd : session.state.cwd;
  const lastResult = (review ? review.events : session.events).at(-1);
  const coach = lastResult ? explainError(lastResult) : null;
  const shownHints = review ? review.hints : stats.hints;
  const hints = reviewCase ? reviewCase.hints : mission.hints;
  const networkingMission = ['gateway-repair','dns-repair','packet-layers'].includes(mission.id);
  const networkingReview = !!review && ['routes','dns','tcp-path'].includes(review.skill);
  const showPacket = mode === 'missions' ? networkingMission : networkingReview;
  const packetNetwork = review ? review.state.network : session.state.network;

  useEffect(() => {
    try { localStorage.setItem(STORAGE,JSON.stringify(session)); } catch { /* private storage or quota */ }
  },[session]);
  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'}); },[lines.length,mode]);

  function run(raw:string) {
    if (!raw.trim() || (mode === 'review' && (!review || review.completed))) return;
    setFeedback('');
    setSession(old => {
      if (mode === 'review') {
        if (!old.reviewAttempt) return old;
        const next = runReviewCommand(old.reviewAttempt,old.reviewHistory,raw);
        return {...old,reviewAttempt:next.attempt,reviewHistory:next.history};
      }
      const result = executeLinux(old.state,raw);
      const events = [...old.events,result].slice(-150);
      const done = missions[old.missionIndex].success(result.state,events);
      const firstCompletion = done && !old.completed.includes(old.missionIndex);
      const completed = firstCompletion ? [...old.completed,old.missionIndex] : old.completed;
      const learning = trackCommand(old.learning,missions[old.missionIndex].id,result,firstCompletion);
      const newLines = result.clear ? [] : [...old.lines,{
        input:old.state.cwd + ' $ ' + raw.trim(), output:result.output,ok:result.ok
      }].slice(-45);
      return {...old,state:result.state,events,completed,learning,lines:newLines};
    });
    setCommand('');
    inputRef.current?.focus();
  }

  function selectMission(index:number) {
    if (index > unlocked || index >= missions.length) return;
    setSession(old => ({...old,missionIndex:index,events:[],
      lines:[{output:'Misja: ' + missions[index].title + '. Wpisz help, jesli potrzebujesz listy komend.',ok:true}]}));
    setMode('missions'); setCommand(''); setFeedback(''); setPacketExpanded(false);
  }

  function startReview(skill:ReviewSkill) {
    if (!reviews.some(r => r.id === skill)) return;
    setSession(old => ({
      ...old,reviewAttempt:old.reviewAttempt?.skill === skill && !old.reviewAttempt.completed
        ? old.reviewAttempt : createReviewAttempt(skill,old.reviewHistory)
    }));
    setMode('review'); setCommand(''); setFeedback(''); setPacketExpanded(false);
  }

  function reveal() {
    setSession(old => mode === 'review'
      ? old.reviewAttempt ? {...old,reviewAttempt:addReviewHint(old.reviewAttempt)} : old
      : {...old,learning:revealHint(old.learning,missions[old.missionIndex].id)});
  }

  function showHelp() {
    setFeedback('Wpisz help w terminalu, aby zobaczyć dostępne polecenia.');
    setSession(old => mode === 'review'
      ? old.reviewAttempt ? {...old,reviewAttempt:markReviewHelp(old.reviewAttempt)} : old
      : {...old,learning:markHelp(old.learning,missions[old.missionIndex].id)});
  }

  function togglePacket() {
    if (!packetExpanded) {
      // Revealing detailed diagnosis is educational assistance, not a free first-solve shortcut.
      setSession(old => {
        if (mode === 'review') {
          return old.reviewAttempt && !old.reviewAttempt.completed
            ? {...old,reviewAttempt:markReviewHelp(old.reviewAttempt)} : old;
        }
        return old.completed.includes(old.missionIndex)
          ? old : {...old,learning:markHelp(old.learning,missions[old.missionIndex].id)};
      });
    }
    setPacketExpanded(!packetExpanded);
  }

  function reset() {
    if (!window.confirm('Zresetować wszystkie misje, powtórki i zapisany postęp?')) return;
    setSession(blankSession()); setMode('missions'); setCommand(''); setFeedback(''); setPacketExpanded(false);
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-mark" aria-hidden="true">&gt;_</div>
      <div><strong>CTF MASTER</strong><span>Linux Networking / MVP 0.9</span></div>
      <span className="offline-tag">LOCAL SIM</span>
    </header>
    <main>
      <section className="welcome">
        <p className="eyebrow">TWOJA DROGA DO CTF</p>
        <h1>Ucz się. Eksperymentuj.<br/><em>Zdobywaj flagi.</em></h1>
        <p>To nie quiz z odpowiedziami. Twoje polecenia zmieniają wirtualny system.</p>
      </section>
      <nav className="mode-switch" aria-label="Tryby nauki">
        <button className={mode === 'missions' ? 'active' : ''} aria-pressed={mode === 'missions'}
          onClick={() => {setMode('missions');setCommand('');setFeedback('');setPacketExpanded(false);}}>Misje</button>
        <button className={mode === 'review' ? 'active' : ''} aria-pressed={mode === 'review'}
          onClick={() => {setMode('review');setCommand('');setFeedback('');setPacketExpanded(false);}}>Powtórki</button>
      </nav>

      {mode === 'missions' ? <>
        <section className="progress-panel" aria-label="Postęp">
          <div className="progress-heading"><strong>Linux Explorer → Investigator</strong>
            <span>{session.completed.length} / {missions.length} misji</span></div>
          <div className="progress-track"><div style={{width:String(session.completed.length / missions.length * 100) + '%'}} /></div>
          <div className="missions">{missions.map((m,i) =>
            <button key={m.id} className={'mission-tab ' + (i === session.missionIndex ? 'selected' : '')}
              onClick={() => selectMission(i)} disabled={i > unlocked}
              title={i > unlocked ? 'Najpierw ukoncz poprzednia misje' : m.title}>
              <span>{session.completed.includes(i) ? '✓' : i + 1}</span><small>{m.title}</small>
            </button>)}</div>
        </section>
        <section className="mission-card">
          <div className="mission-top"><span className="eyebrow">MISJA {String(session.missionIndex+1).padStart(2,'0')} · {mission.category.toUpperCase()}</span>
            <span className="level">{mission.category === 'CTF Rookie' ? 'CTF' : mission.category === 'Linux Investigator' ? 'INVESTIGATOR' : mission.category === 'Linux Administrator' ? 'ADMIN' : mission.category === 'Linux Networking' ? 'NETWORK' : 'BEGINNER'}</span>
          </div>
          <h2>{mission.title}</h2><p>{mission.briefing}</p>
          <div className="learning-stats" aria-label="Statystyki misji">
            <span>Polecenia: {stats.commands}</span><span>Nieudane: {stats.errors}</span><span>Podpowiedzi: {stats.hints}/3</span>
          </div>
          {missionComplete && <div className="success" role="status">
            <span>✓ Cel misji osiągnięty! {stats.independent ? 'Samodzielnie, bez błędów i podpowiedzi.' : 'Powtórz umiejętność w nowym wariancie.'}</span>
            {session.missionIndex < missions.length-1
              ? <button onClick={() => selectMission(session.missionIndex+1)}>Następna misja →</button>
              : <span> Pierwszy etap zakończony.</span>}
          </div>}
        </section>
      </> : <>
        <section className="review-hub">
          <p className="eyebrow">POWTÓRKI W NOWYM ŚRODOWISKU</p>
          <h2>Ćwicz to, co sprawia trudność.</h2>
          <p>Nowe pliki i ścieżki, bez zmieniania zapisanej misji. Dwa poprawne warianty z rzędu bez błędów i pomocy dają zaliczenie umiejętności.</p>
          {reviews.length === 0
            ? <p className="review-empty">Najpierw ukończ misję z logami, wyszukiwaniem dowodów lub kopiowaniem plików.</p>
            : <div className="review-grid">{reviews.map(skill =>
                <button key={skill.id} className={'review-choice ' + (review?.skill === skill.id ? 'selected' : '')}
                  onClick={() => startReview(skill.id)}>
                  <strong>{skill.title}</strong>
                  <small>{skill.recommended ? 'Zalecana powtórka' : skill.streak === 2 ? 'Opanowano' : 'Trening opcjonalny'}</small>
                  <span>Samodzielne warianty: {skill.streak}/2</span>
                </button>)}</div>}
        </section>
        {review && reviewCase && <section className="mission-card">
          <div className="mission-top"><span className="eyebrow">TRENING · {review.skill.toUpperCase()}</span>
            <span className="level">{session.reviewHistory[review.skill]?.streak ?? 0}/2</span>
          </div>
          <h2>{reviewCase.title}</h2><p>{reviewCase.briefing}</p>
          <div className="learning-stats">
            <span>Komendy: {review.commands}</span><span>Błędy: {review.errors}</span><span>Podpowiedzi: {review.hints}/3</span>
          </div>
          {review.completed && <div className="success" role="status">
            <span>✓ Zadanie wykonane. {review.independent
              ? 'Samodzielny wariant zaliczony.' : 'Z pomocą lub błędami - seria samodzielnych prób zaczyna się od nowa.'}
              {' '}Wynik umiejętności: {session.reviewHistory[review.skill]?.streak ?? 0}/2.</span>
            <button onClick={() => startReview(review.skill)}>Następny wariant →</button>
          </div>}
          {!review.completed && <button className="text-button" onClick={() => {
            setPacketExpanded(false);
            setSession(old => ({
              ...old,reviewAttempt:old.reviewAttempt ? createReviewAttempt(old.reviewAttempt.skill,old.reviewHistory) : null
            }));
          }}>Zacznij bieżący wariant od nowa</button>}
        </section>}
      </>}

      {showPacket && <PacketPath network={packetNetwork} expanded={packetExpanded} onToggle={togglePacket}/>}
      {(mode === 'missions' || review) && <>
        <section className="terminal" aria-label="Symulowany terminal">
          <div className="terminal-bar"><div className="dots"><i/><i/><i/></div>
            <span>player@ctf-master: {cwd}</span><span className="terminal-label">SIMULATED</span>
          </div>
          <div className="terminal-output" aria-live="polite">
            {lines.map((line,i) => <div key={i} className="terminal-line">
              {line.input && <div className="prompt">{line.input}</div>}
              {line.output && <pre className={line.ok ? '' : 'error'}>{line.output}</pre>}
            </div>)}
            <div ref={bottomRef}/>
          </div>
          <form className="command-row" onSubmit={e => {e.preventDefault();run(command)}}>
            <label htmlFor="cmd">$</label>
            <input ref={inputRef} id="cmd" value={command} onChange={e => setCommand(e.target.value)}
              spellCheck={false} autoComplete="off" autoCapitalize="none" autoCorrect="off"
              disabled={mode === 'review' && !!review?.completed}
              placeholder="Wpisz polecenie..." aria-label="Polecenie Linux"/>
            <button type="submit" disabled={mode === 'review' && !!review?.completed}>Wykonaj ↵</button>
          </form>
        </section>
        {coach && <section className="coach-panel" role="status" aria-live="polite">
          <strong>{coach.title}</strong><p>{coach.guidance}</p>
        </section>}
        <section className="help-panel">
          <div className="help-top"><div><p className="eyebrow">GDY UTKNIESZ</p>
            <h3>Podpowiedzi krok po kroku</h3></div>
            <button className="secondary" onClick={reveal} disabled={shownHints===3 || !!review?.completed}>
              {shownHints===3 ? 'Wszystkie odkryte' : 'Odkryj ' + (shownHints+1) + '/3'}
            </button>
          </div>
          {shownHints===0 ? <p>Najpierw spróbuj sam. Podpowiedzi nie są obowiązkowe.</p>
            : <ol>{hints.slice(0,shownHints).map((hint,i) => <li key={i}>{hint}</li>)}</ol>}
          <div className="help-actions">
            <button className="text-button" onClick={showHelp}
              disabled={!!review?.completed}>Jakie komendy są dostępne?</button>
            <button className="text-button danger" onClick={reset}>Reset całego postępu</button>
          </div>
          {feedback && <p className="hint-feedback">{feedback}</p>}
        </section>
      </>}
      <p className="safety-note">To bezpieczny symulator w przeglądarce. Polecenia nie wykonują się w prawdziwym systemie ani na serwerze.</p>
    </main>
  </div>;
}

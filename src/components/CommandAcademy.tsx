import { useEffect, useRef, useState } from 'react';
import { explainAcademyAttempt } from '../core/academyFeedback';
import {
  academySubmit, commandLessons, createAcademyState,
  restoreAcademyProgress, type AcademyProgress, type CommandLessonGroup
} from '../core/commandAcademy';
import {createTransferState,submitTransfer,earnedMastery,transferChallenges} from '../core/academyTransfer';
import type { CommandResult, LinuxState } from '../core/linux';
import { academyTerminalHeight, needsRecommendation } from '../core/academyPresentation';
import { rememberCommand, moveHistoryCursor } from '../core/commandHistory';
import {
  recommendAcademy, recordCoachSignal, restoreCoachMetrics, type AcademyCoachMetrics
} from '../core/academyCoach';

const STORAGE='ctf-master:command-academy-v1';
const COACH_STORAGE='ctf-master:academy-coach-v1';
interface TerminalLine {input?:string;output:string;ok:boolean}
const groups:CommandLessonGroup[]=['Podstawy','Pliki i logi','Administracja','Sieć'];
const firstLine:TerminalLine={output:'Terminal treningowy. Polecenia nie zmieniają misji CTF.',ok:true};

function readMetrics():AcademyCoachMetrics {
  try {return restoreCoachMetrics(JSON.parse(localStorage.getItem(COACH_STORAGE) ?? 'null'));}
  catch {return {};}
}
function readProgress():AcademyProgress {
  try {return restoreAcademyProgress(JSON.parse(localStorage.getItem(STORAGE) ?? 'null'));}
  catch {return restoreAcademyProgress(null);}
}

/** A compact, responsive workbench: lesson and terminal share the same visual row. */
export default function CommandAcademy() {
  const [progress,setProgress]=useState<AcademyProgress>(readProgress);
  const [metrics,setMetrics]=useState<AcademyCoachMetrics>(readMetrics);
  const [system,setSystem]=useState<LinuxState>(createAcademyState);
  const [previousSystem,setPreviousSystem]=useState<LinuxState|null>(null);
  const [events,setEvents]=useState<CommandResult[]>([]);
  const [lines,setLines]=useState<TerminalLine[]>([firstLine]);
  const [draft,setDraft]=useState('');
  const [history,setHistory]=useState<string[]>([]);
  const [historyCursor,setHistoryCursor]=useState<number|null>(null);
  const draftBeforeRecall=useRef('');
  const [hintOpen,setHintOpen]=useState(false);
  const [doneNow,setDoneNow]=useState(false);
  const [phase,setPhase]=useState<'intro'|'transfer'>('intro');
  const [errors,setErrors]=useState(0);
  const [usedHint,setUsedHint]=useState(false);
  const [independentNow,setIndependentNow]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  const output=useRef<HTMLDivElement>(null);

  const index=Math.max(0,commandLessons.findIndex(item=>item.id===progress.selectedId));
  const lesson=commandLessons[index];
  const transfer=transferChallenges.find(item=>item.lessonId===lesson.id)!;
  const inTransfer=phase==='transfer';
  const complete=progress.completed.includes(lesson.id);
  const mastered=progress.mastered.includes(lesson.id);
  const suggestion=recommendAcademy(progress,metrics);
  const suggestedLesson=suggestion&&commandLessons.find(item=>item.id===suggestion.lessonId);
  const showRecommendation=!!suggestedLesson&&needsRecommendation(suggestion,lesson.id);
  const last=events.at(-1);
  const insight=last?explainAcademyAttempt(lesson.id,previousSystem??system,last,doneNow):null;

  const outputHeight=academyTerminalHeight(lines);

  useEffect(()=>{
    try {localStorage.setItem(STORAGE,JSON.stringify(progress));}
    catch {/* Browser storage can be disabled; the session still works. */}
  },[progress]);
  useEffect(()=>{
    try {localStorage.setItem(COACH_STORAGE,JSON.stringify(metrics));}
    catch {/* Browser storage can be disabled; the session still works. */}
  },[metrics]);
  useEffect(()=>{
    if(output.current) output.current.scrollTop=output.current.scrollHeight;
  },[lines.length,index,phase]);

  function openLesson(id:string,nextPhase:'intro'|'transfer'='intro') {
    if(!commandLessons.some(item=>item.id===id)) return;
    if(nextPhase==='transfer'&&!progress.completed.includes(id)) return;
    setProgress(old=>({...old,selectedId:id}));
    setSystem(nextPhase==='transfer'?createTransferState(id):createAcademyState());
    setPreviousSystem(null);
    setEvents([]);
    setLines(nextPhase==='transfer'
      ? [{output:'Nowy wariant: bez przykładu, z innymi danymi.',ok:true}]
      : [firstLine]);
    setDraft('');
    setHistory([]);
    setHistoryCursor(null);
    draftBeforeRecall.current='';
    setHintOpen(false);
    setDoneNow(false);
    setPhase(nextPhase);
    setErrors(0);
    setUsedHint(false);
    setIndependentNow(false);
  }

  function startTransfer(){openLesson(lesson.id,'transfer');}
  function restartCurrent(){openLesson(lesson.id,phase);}

  function changeDraft(value:string){
    setDraft(value);
    setHistoryCursor(null);
    draftBeforeRecall.current=value;
  }

  function recall(direction:'older'|'newer'){
    if(historyCursor===null&&direction==='older') draftBeforeRecall.current=draft;
    const next=moveHistoryCursor(history.length,historyCursor,direction);
    setHistoryCursor(next);
    setDraft(next===null?draftBeforeRecall.current:history[next]);
    input.current?.focus();
  }

  function submit(raw:string) {
    if(!raw.trim()||doneNow) return;
    setHistory(old=>rememberCommand(old,raw));
    setHistoryCursor(null);
    draftBeforeRecall.current='';
    const next=inTransfer
      ? submitTransfer(system,events,raw,lesson.id)
      : academySubmit(system,events,raw,lesson.id);
    const newErrors=errors+Number(!next.result.ok);
    setErrors(newErrors);
    if(!next.result.ok) setMetrics(old=>recordCoachSignal(old,lesson.id,'errors'));
    const askedHelp=next.result.command==='help';
    const assisted=usedHint||askedHelp;
    if(askedHelp&&!usedHint) {
      setUsedHint(true);
      setMetrics(old=>recordCoachSignal(old,lesson.id,'help'));
    }
    setPreviousSystem(system);
    setSystem(next.result.state);
    setEvents(next.events);
    setLines(old=>next.result.clear?[]:[...old,{
      input:system.cwd+' $ '+raw.trim(),output:next.result.output,ok:next.result.ok
    }].slice(-40));
    setDraft('');
    if(next.completed) {
      setDoneNow(true);
      if(inTransfer) {
        const independent=earnedMastery(true,newErrors,assisted);
        setIndependentNow(independent);
        if(independent) {
          setProgress(old=>old.mastered.includes(lesson.id)?old:{
            ...old,mastered:[...old.mastered,lesson.id]
          });
        }
      } else {
        setProgress(old=>old.completed.includes(lesson.id)?old:{
          ...old,completed:[...old.completed,lesson.id]
        });
      }
    }
    input.current?.focus();
  }

  const feedbackTitle=doneNow
    ? (inTransfer
        ? independentNow?'Sprawdzian zaliczony samodzielnie':'Cel osiągnięty — potrzebna czysta próba'
        : insight?.title ?? 'Zadanie wykonane poprawnie')
    : insight?.title ?? null;
  const feedbackDetail=doneNow
    ? (inTransfer
        ? (independentNow
          ? 'Samodzielnie rozwiązałeś nowy wariant bez błędów i podpowiedzi.'
          : 'W tej próbie pojawił się błąd lub pomoc. Zresetuj sprawdzian, aby potwierdzić samodzielność.') +
          (insight?.detail ? ' ' + insight.detail : '')
        : insight?.detail ?? lesson.purpose)
    : insight?.detail ?? '';

  return <section className="academy academy-workbench" aria-label="Trening komend Linux">
    <div className="academy-topline">
      <div className="academy-topline-title">
        <p className="eyebrow">PRAKTYCZNY LINUX</p>
        <h2>Akademia komend</h2>
        <p>Jedna komenda. Jedno zadanie. Wynik w terminalu.</p>
      </div>
      <div className="academy-progress" aria-label="Postęp akademii">
        <strong>{progress.completed.length}/{commandLessons.length} poznanych</strong>
        <span>·</span>
        <strong>{progress.mastered.length}/{commandLessons.length} opanowanych</strong>
        <div className="progress-track"><div style={{width:(progress.mastered.length/commandLessons.length*100)+'%'}}/></div>
      </div>
    </div>

    {showRecommendation&&<div className="academy-nudge">
      <div><strong>Warto teraz: {suggestedLesson!.title}</strong>
        <p>{suggestion!.reason}</p>
      </div>
      <button type="button" onClick={()=>openLesson(suggestion!.lessonId,suggestion!.phase)}>
        {suggestion!.phase==='transfer'?'Sprawdzian':'Ćwicz'} →
      </button>
    </div>}
    {!suggestion&&<p className="academy-all-mastered">✓ Wszystkie komendy opanowane. Możesz przejść do Misji CTF.</p>}

    <div className="academy-workspace" data-layout="learning-workspace">
      <div className="academy-study-column">
        <label className="academy-picker" htmlFor="academy-select">Wybierz ćwiczenie
          <select id="academy-select" value={lesson.id} onChange={e=>openLesson(e.target.value)}>
            {groups.map(group=><optgroup label={group} key={group}>
              {commandLessons.filter(item=>item.group===group).map(item=>
                <option value={item.id} key={item.id}>
                  {progress.mastered.includes(item.id)?'✓ ':progress.completed.includes(item.id)?'• ':''}
                  {commandLessons.indexOf(item)+1}. {item.title}
                </option>)}
            </optgroup>)}
          </select>
        </label>

        <section className="academy-lesson" aria-labelledby="academy-lesson-title">
          <div className="academy-step">
            <span>{index+1}/{commandLessons.length} · {inTransfer?'Sprawdzian':'Nauka'}</span>
            <span>{lesson.group}</span>
          </div>
          <h3 id="academy-lesson-title">{lesson.title}</h3>
          <p>{inTransfer
            ? 'Nowe dane, ta sama umiejętność. Rozwiąż zadanie bez gotowego przykładu.'
            : lesson.purpose}</p>
          {!inTransfer&&<div className="academy-syntax">
            <div><span>Składnia</span><code>{lesson.syntax}</code></div>
            <div><span>Przykład</span><code>{lesson.example}</code></div>
          </div>}
          <div className="academy-task">
            <strong>Twoje zadanie</strong>
            <p>{inTransfer?transfer.assignment:lesson.assignment}</p>
          </div>

          {!doneNow&&mastered&&<p className="academy-previous">✓ Ta komenda ma już status „opanowane”.</p>}
          {!doneNow&&!inTransfer&&complete&&!mastered&&
            <p className="academy-previous">• Poznane. Wykonaj sprawdzian, aby potwierdzić samodzielność.</p>}

          <div className="academy-actions">
            <button type="button" onClick={()=>{
              setHintOpen(open=>!open);
              if(!usedHint){
                setUsedHint(true);
                setMetrics(old=>recordCoachSignal(old,lesson.id,'help'));
              }
            }} aria-expanded={hintOpen} disabled={doneNow}>
              {hintOpen?'Ukryj podpowiedź':'Podpowiedź'}
            </button>
            <button type="button" onClick={restartCurrent}>
              Reset {inTransfer?'sprawdzianu':'ćwiczenia'}
            </button>
            {inTransfer&&<button type="button" onClick={()=>openLesson(lesson.id)}>
              Wróć do nauki
            </button>}
            {!inTransfer&&complete&&!doneNow&&
              <button type="button" onClick={startTransfer}>Sprawdź samodzielnie →</button>}
          </div>
          {hintOpen&&<p className="academy-hint">{inTransfer
            ? 'Przypomnij sobie działanie komendy i dostosuj argumenty do nowych danych.'
            : lesson.hint}</p>}
          {inTransfer&&<p className="academy-transfer-note">
            {errors} nieudanych poleceń · {usedHint?'pomoc wykorzystana':'bez podpowiedzi'}
          </p>}
        </section>
      </div>

      <div className="academy-terminal-column">
        <section className="terminal academy-terminal" aria-label="Terminal akademii komend">
          <div className="terminal-bar">
            <div className="dots"><i/><i/><i/></div>
            <span>player@academy:{system.cwd}</span>
            <span className="terminal-label">PRACTICE</span>
          </div>
          <div className="terminal-output" role="log" aria-label="Wyniki ćwiczenia"
            aria-live="off" ref={output} style={{height:outputHeight}}>
            {lines.map((line,i)=><div className="terminal-line" key={i}>
              {line.input&&<div className="prompt">{line.input}</div>}
              {line.output&&<pre className={line.ok?'':'error'}>{line.output}</pre>}
            </div>)}
          </div>
          <form className="command-row academy-command" onSubmit={e=>{e.preventDefault();submit(draft)}}>
            <label htmlFor="academy-command">$</label>
            <input id="academy-command" ref={input} value={draft}
              onChange={e=>changeDraft(e.target.value)}
              onKeyDown={e=>{
                if(e.key==='ArrowUp'){e.preventDefault();recall('older');}
                if(e.key==='ArrowDown'){e.preventDefault();recall('newer');}
              }}
              placeholder="Wpisz polecenie..." autoCapitalize="none" autoCorrect="off"
              autoComplete="off" spellCheck={false}
              disabled={doneNow} aria-label="Polecenie w akademii"/>
            <button type="button" className="academy-history-control" aria-label="Poprzednia komenda"
              title="Historia poleceń: w górę" disabled={doneNow||history.length===0}
              onClick={()=>recall('older')}>↑</button>
            <button type="button" className="academy-history-control" aria-label="Następna komenda"
              title="Historia poleceń: w dół" disabled={doneNow||historyCursor===null}
              onClick={()=>recall('newer')}>↓</button>
            <button type="submit" disabled={doneNow}>Wykonaj ↵</button>
          </form>
        </section>

        {feedbackTitle&&<div className={'academy-feedback '+
          (doneNow?'academy-feedback-success':last&&!last.ok?'academy-feedback-error':'academy-feedback-info')}
          role="status" aria-live="polite">
          <strong>{doneNow?'✓ ':last&&!last.ok?'! ':'• '}{feedbackTitle}</strong>
          <p>{feedbackDetail}</p>
          {doneNow&&<div className="academy-next-actions">
            {inTransfer
              ? !independentNow&&<button type="button" onClick={restartCurrent}>Spróbuj ponownie ↻</button>
              : <button type="button" onClick={startTransfer}>Sprawdź samodzielnie →</button>}
            {index<commandLessons.length-1&&<button type="button"
              className="academy-next-secondary"
              onClick={()=>openLesson(commandLessons[index+1].id)}>Następna komenda →</button>}
          </div>}
        </div>}
        <p className="academy-disclaimer">To bezpieczny symulator. Postęp treningu jest oddzielony od Misji CTF.</p>
      </div>
    </div>
  </section>;
}

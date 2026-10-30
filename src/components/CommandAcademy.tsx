import { useEffect, useRef, useState } from 'react';
import { explainError } from '../core/learning';
import {
  academySubmit, commandLessons, createAcademyState,
  restoreAcademyProgress, type AcademyProgress, type CommandLessonGroup
} from '../core/commandAcademy';
import {createTransferState,submitTransfer,earnedMastery,transferChallenges} from '../core/academyTransfer';
import type { CommandResult, LinuxState } from '../core/linux';

const STORAGE='ctf-master:command-academy-v1';
interface TerminalLine {input?:string;output:string;ok:boolean}
const groups:CommandLessonGroup[]=['Podstawy','Pliki i logi','Administracja','Sieć'];
const firstLine:TerminalLine={output:'Osobny terminal treningowy. Nic, co tutaj zrobisz, nie zmieni misji CTF.',ok:true};

function readProgress():AcademyProgress {
  try { return restoreAcademyProgress(JSON.parse(localStorage.getItem(STORAGE) ?? 'null')); }
  catch { return restoreAcademyProgress(null); }
}

export default function CommandAcademy() {
  const [progress,setProgress]=useState<AcademyProgress>(readProgress);
  const [system,setSystem]=useState<LinuxState>(createAcademyState);
  const [events,setEvents]=useState<CommandResult[]>([]);
  const [lines,setLines]=useState<TerminalLine[]>([firstLine]);
  const [draft,setDraft]=useState('');
  const [hintOpen,setHintOpen]=useState(false);
  const [doneNow,setDoneNow]=useState(false);
  const [phase,setPhase]=useState<'intro'|'transfer'>('intro');
  const [errors,setErrors]=useState(0);
  const [usedHint,setUsedHint]=useState(false);
  const [independentNow,setIndependentNow]=useState(false);
  const input=useRef<HTMLInputElement>(null);
  const output=useRef<HTMLDivElement>(null);

  const index=Math.max(0,commandLessons.findIndex(lesson=>lesson.id===progress.selectedId));
  const lesson=commandLessons[index];
  const transfer=transferChallenges.find(ch=>ch.lessonId===lesson.id)!;
  const inTransfer=phase==='transfer';
  const last=events.at(-1);
  const coach=last ? explainError(last) : null;

  useEffect(()=>{
    try {localStorage.setItem(STORAGE,JSON.stringify(progress));}
    catch {/* quota or private browsing */}
  },[progress]);
  useEffect(()=>{ if(output.current) output.current.scrollTop=output.current.scrollHeight; },[lines.length,index]);

  function chooseLesson(id:string) {
    if(!commandLessons.some(item=>item.id===id)) return;
    setProgress(old=>({...old,selectedId:id}));
    setSystem(createAcademyState());setEvents([]);setLines([firstLine]);
    setDraft('');setHintOpen(false);setDoneNow(false);
    setPhase('intro');setErrors(0);setUsedHint(false);setIndependentNow(false);
  }

  function startTransfer() {
    if(!progress.completed.includes(lesson.id)) return;
    setPhase('transfer');
    setSystem(createTransferState(lesson.id));
    setEvents([]);setLines([{output:'Nowy wariant. Pracujesz bez przykładu rozwiązania.',ok:true}]);
    setDraft('');setHintOpen(false);setDoneNow(false);
    setErrors(0);setUsedHint(false);setIndependentNow(false);
  }

  function restartCurrent() {
    if(inTransfer) {startTransfer();return;}
    chooseLesson(lesson.id);
  }

  function submit(raw:string) {
    if (!raw.trim()) return;
    if(inTransfer && doneNow) return;
    const next=inTransfer
      ? submitTransfer(system,events,raw,lesson.id)
      : academySubmit(system,events,raw,lesson.id);
    const newErrors=errors+Number(!next.result.ok);
    setErrors(newErrors);
    setSystem(next.result.state);
    setEvents(next.events);
    setLines(old=>next.result.clear?[]:[...old,{
      input:system.cwd+' $ '+raw.trim(),output:next.result.output,ok:next.result.ok
    }].slice(-40));
    setDraft('');
    if(next.completed) {
      setDoneNow(true);
      if(inTransfer) {
        const independent=earnedMastery(true,newErrors,usedHint);
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

  const complete=progress.completed.includes(lesson.id);
  const mastered=progress.mastered.includes(lesson.id);
  return <section className="academy" aria-label="Trening komend Linux">
    <header className="academy-header">
      <p className="eyebrow">UCZ SIĘ KOMEND, ZANIM UŻYJESZ ICH W MISJI</p>
      <h2>Akademia komend</h2>
      <p>Najpierw poznaj komendę i wykonaj ćwiczenie. Następnie rozwiąż nowy wariant bez błędów i podpowiedzi, aby potwierdzić samodzielność.</p>
      <div className="academy-progress" aria-label="Postęp akademii">
        <span>{progress.completed.length}/{commandLessons.length} poznanych · {progress.mastered.length}/{commandLessons.length} opanowanych</span>
        <div className="progress-track"><div style={{width:(progress.completed.length/commandLessons.length*100)+'%'}}/></div>
      </div>
    </header>
    <label className="academy-picker" htmlFor="academy-select">Ćwiczenie
      <select id="academy-select" value={lesson.id} onChange={e=>chooseLesson(e.target.value)}>
        {groups.map(group=><optgroup label={group} key={group}>
          {commandLessons.filter(item=>item.group===group).map(item=>
            <option value={item.id} key={item.id}>{progress.mastered.includes(item.id)?'✓ ':progress.completed.includes(item.id)?'• ':''}
              {commandLessons.indexOf(item)+1}. {item.title}</option>)}
        </optgroup>)}
      </select>
    </label>
    <div className="academy-lesson">
      <div className="academy-step"><span>{index+1} / {commandLessons.length} · {inTransfer?'Sprawdzian':'Nauka'}</span>
        <span>{lesson.group}</span>
      </div>
      <h3>{lesson.title}</h3>
      <p>{inTransfer?'Nowe dane, ta sama umiejętność. Sprawdź, czy potrafisz ją zastosować.':lesson.purpose}</p>
      {!inTransfer&&<div className="academy-syntax">
        <div><span>Składnia</span><code>{lesson.syntax}</code></div>
        <div><span>Przykład</span><code>{lesson.example}</code></div>
      </div>}
      <div className="academy-task">
        <strong>Twoje zadanie</strong>
        <p>{inTransfer?transfer.assignment:lesson.assignment}</p>
      </div>
      {doneNow?<p className="academy-success" role="status">✓ {inTransfer
          ? independentNow?'Sprawdzian zaliczony samodzielnie — umiejętność opanowana.':'Cel osiągnięty, ale z błędem lub podpowiedzią. Powtórz sprawdzian bez pomocy, aby uzyskać zaliczenie samodzielne.'
          :'Ćwiczenie zaliczone. Możesz teraz przystąpić do sprawdzianu.'}</p>
        :mastered?<p className="academy-previous">✓ Umiejętność opanowana wcześniej. Możesz ją powtórzyć.</p>
        :complete&&!inTransfer?<p className="academy-previous">• Poznane. Przejdź do sprawdzianu, aby potwierdzić samodzielność.</p>:null}
      <div className="academy-actions">
        <button type="button" onClick={()=>{setHintOpen(open=>!open);setUsedHint(true);}}
          aria-expanded={hintOpen} disabled={doneNow}>{hintOpen?'Ukryj podpowiedź':'Podpowiedź (liczy pomoc)'}</button>
        <button type="button" onClick={restartCurrent}>Reset {inTransfer?'sprawdzianu':'ćwiczenia'}</button>
        {inTransfer
          ? <button type="button" onClick={()=>chooseLesson(lesson.id)}>Wróć do nauki</button>
          : <button type="button" disabled={!complete} onClick={startTransfer}>Sprawdź samodzielnie →</button>}
        {doneNow&&<button type="button" onClick={()=>chooseLesson(commandLessons[index+1].id)}
          disabled={index===commandLessons.length-1}>Następna komenda →</button>
      </div>
      {hintOpen&&<p className="academy-hint">{inTransfer?'Pomyśl, które polecenie umożliwiło podobną operację w pierwszym ćwiczeniu. Zwróć uwagę na nowe ścieżki i argumenty.':lesson.hint}</p>}
      {inTransfer&&<p className="academy-transfer-note">Sprawdzian: {errors} nieudanych poleceń · {usedHint?'pomoc wykorzystana':'bez podpowiedzi'}. Reset daje nową próbę od początku.</p>
    </div>
    <section className="terminal" aria-label="Terminal akademii komend">
      <div className="terminal-bar"><div className="dots"><i/><i/><i/></div>
        <span>player@academy: {system.cwd}</span><span className="terminal-label">PRACTICE</span>
      </div>
      <div className="terminal-output" role="log" aria-label="Wyniki ćwiczenia"
        aria-live="off" ref={output}>
        {lines.map((line,i)=><div className="terminal-line" key={i}>
          {line.input&&<div className="prompt">{line.input}</div>}
          {line.output&&<pre className={line.ok?'':'error'}>{line.output}</pre>}
        </div>)}
      </div>
      <form className="command-row academy-command" onSubmit={e=>{e.preventDefault();submit(draft)}}>
        <label htmlFor="academy-command">$</label>
        <input id="academy-command" ref={input} value={draft} onChange={e=>setDraft(e.target.value)}
          placeholder="Wpisz polecenie..." autoCapitalize="none" autoCorrect="off"
          autoComplete="off" spellCheck={false} aria-label="Polecenie w akademii"/>
        <button type="submit">Wykonaj ↵</button>
      </form>
    </section>
    {last&&<p className="academy-result" role="status" aria-live="polite">
      {last.ok?'✓ Polecenie wykonane. '+(!doneNow?'Sprawdź, czy osiągnąłeś cel zadania.':''):
        'Polecenie nieudane. '+(coach?.guidance ?? 'Sprawdź argumenty i ścieżki.')}
    </p>
    <p className="academy-disclaimer">Postęp ćwiczeń zapisuje się osobno. Nie odblokowuje misji CTF ani nie zmienia ich wirtualnych plików.</p>
  </section>;
}

import {useLayoutEffect,useRef,useState} from 'react';
import {insertAtSelection} from '../core/editorInsertion';
import {fitWorkshopEditor} from '../core/workshopEditorSize';
import {emptyUndoHistory,recordEditorEdit,undoEditorEdit,
  type EditKind} from '../core/editorUndo';
import {sourceLineRange} from '../core/workshopSourceLines';
import {compareExitPrediction,compareCausePrediction,type CausePrediction,type ExitPrediction} from '../core/workshopPrediction';
import {gradeRemediation,type RemediationChoice} from '../core/workshopRemediation';
import {verifyRecoveryPreview,type RecoveryVerification} from '../core/workshopRecoveryVerify';
import {blindTicket,blindTicketIds,type BlindTicketId} from '../core/blindTickets';
import {concreteRecoveryEvidence,gradeConcreteEvidence,type EvidenceInterpretation} from '../core/workshopConcreteEvidence';
import {workshopScenarios,workshopInitialScript,workshopDraftKey,
  repairWorkshopDraftKey,repairWorkshopStarter,
  pathblockWorkshopDraftKey,pathblockWorkshopStarter,
  type WorkshopId,type RepairWorkshopVariant,type PathWorkshopVariant,type BlindCause} from '../core/workshopScenarios';
import {
  WORKSHOP_MAX_CHARS,runWorkshop,
  type WorkshopResult
} from '../core/bashWorkshop';

const SELECTION_KEY='ctf-master:bash-workshop-selected-v1';
const REPAIR_CASE_KEY='ctf-master:bash-workshop-repair-case-v1';
const PATH_CASE_KEY='ctf-master:bash-workshop-pathblock-case-v1';
const shortcuts=[
  {label:'$',value:'$',description:'Wstaw dolar - początek nazwy zmiennej'},
  {label:'"',value:'"',description:'Wstaw cudzysłów'},
  {label:"'",value:"'",description:'Wstaw apostrof'},
  {label:'~',value:'~',description:'Wstaw tyldę - katalog domowy'},
  {label:'&&',value:'&&',description:'Wstaw dwa ampersandy - wykonaj po sukcesie'},
  {label:'||',value:'||',description:'Wstaw dwie kreski pionowe - wykonaj po niepowodzeniu'},
  {label:';',value:';',description:'Wstaw średnik'},
  {label:'↵',value:'\n',description:'Wstaw nową linię'}
] as const;
function restoreScenario():WorkshopId{
  try{
    const saved=localStorage.getItem(SELECTION_KEY);
    return saved==='diagnosis'||saved==='permissions'||saved==='fallback'||saved==='transfer'||saved==='pathblock'||saved==='repair'?saved:'backup';
  }
  catch{return 'backup';}
}
function restoreRepairCase():RepairWorkshopVariant {
  try{
    const saved=localStorage.getItem(REPAIR_CASE_KEY);
    return saved==='file'||saved==='transfer'?saved:'intro';
  }
  catch{return 'intro';}
}
function restorePathCase():PathWorkshopVariant {
  try{
    const value=localStorage.getItem(PATH_CASE_KEY);
    return value==='transfer'||value==='blind'?value:'intro';
  }catch{return 'intro';}
}
function randomBlindCause():BlindCause {
  const choices:BlindCause[]=['directory','file','missing'];
  return choices[Math.floor(Math.random()*choices.length)];
}
function randomBlindTicket(except?:BlindTicketId):BlindTicketId{
  const choices=blindTicketIds.filter(id=>id!==except);
  return choices[Math.floor(Math.random()*choices.length)];
}
function initialDraft(id:WorkshopId,repairCase:RepairWorkshopVariant,pathCase:PathWorkshopVariant):string{
  return id==='repair'?repairWorkshopStarter(repairCase):
    id==='pathblock'?pathblockWorkshopStarter(pathCase):workshopInitialScript(id);
}
function draftKey(id:WorkshopId,repairCase:RepairWorkshopVariant,pathCase:PathWorkshopVariant):string{
  return id==='repair'?repairWorkshopDraftKey(repairCase):
    id==='pathblock'?pathblockWorkshopDraftKey(pathCase):workshopDraftKey(id);
}
function restoreDraft(id:WorkshopId,repairCase:RepairWorkshopVariant,pathCase:PathWorkshopVariant):string{
  const starter=initialDraft(id,repairCase,pathCase);
  try{
    const saved=localStorage.getItem(draftKey(id,repairCase,pathCase));
    return saved!==null&&saved.length<=WORKSHOP_MAX_CHARS?saved:starter;
  }catch{return starter;}
}

/** One compact mobile screen, one task, one run; no multi-panel wizard. */
export default function BashWorkshop(){
  const [scenario,setScenario]=useState<WorkshopId>(restoreScenario);
  const [repairCase,setRepairCase]=useState<RepairWorkshopVariant>(restoreRepairCase);
  const [pathCase,setPathCase]=useState<PathWorkshopVariant>(restorePathCase);
  const [blindCause,setBlindCause]=useState<BlindCause>(randomBlindCause);
  const [blindTicketId,setBlindTicketId]=useState<BlindTicketId>(randomBlindTicket);
  const [draft,setDraft]=useState(()=>restoreDraft(restoreScenario(),restoreRepairCase(),restorePathCase()));
  const [prediction,setPrediction]=useState<ExitPrediction>('');
  const [causePrediction,setCausePrediction]=useState<CausePrediction>('');
  const [submittedCause,setSubmittedCause]=useState<CausePrediction>('');
  const [remediation,setRemediation]=useState<RemediationChoice>('');
  const [submittedRemediation,setSubmittedRemediation]=useState<RemediationChoice>('');
  const [recoveryCheck,setRecoveryCheck]=useState<RecoveryVerification|null>(null);
  const [selectedConclusion,setSelectedConclusion]=useState<EvidenceInterpretation|''>('');
  const [submittedConclusion,setSubmittedConclusion]=useState<EvidenceInterpretation|''>('');
  const [submittedPrediction,setSubmittedPrediction]=useState<ExitPrediction>('');
  const [result,setResult]=useState<WorkshopResult|null>(null);
  const [editorNotice,setEditorNotice]=useState('');
  const [canUndo,setCanUndo]=useState(false);
  const undoHistory=useRef(emptyUndoHistory());
  const editor=useRef<HTMLTextAreaElement>(null);
  const cursor=useRef<{start:number;end:number}|null>(null);
  const pendingCursor=useRef<{start:number;end:number}|null>(null);
  // No inner vertical scroll: edits and viewport resizing expand the text area
  // so finger swipes may scroll the page even when starting over the editor.
  useLayoutEffect(()=>{
    const fit=()=>{if(editor.current)fitWorkshopEditor(editor.current);};
    fit();
    window.addEventListener('resize',fit);
    return ()=>window.removeEventListener('resize',fit);
  },[draft,scenario,repairCase,pathCase]);
  useLayoutEffect(()=>{
    if(pendingCursor.current===null)return;
    const selection=pendingCursor.current;
    pendingCursor.current=null;
    const element=editor.current;
    if(!element)return;
    element.focus({preventScroll:true});
    element.setSelectionRange(selection.start,selection.end);
    cursor.current=selection;
  },[draft]);
  const change=(next:string)=>{
    // An edited script needs a new prediction; never compare a stale guess.
    setPrediction('');
    setSubmittedPrediction('');
    setSubmittedCause('');
    setRemediation('');
    setSubmittedRemediation('');
    setRecoveryCheck(null);
    setSelectedConclusion('');
    setSubmittedConclusion('');
    setEditorNotice('');
    setDraft(next);
    setResult(null);
    try{localStorage.setItem(draftKey(scenario,repairCase,pathCase),next);}catch{/* private browsing */}
  };
  const selectScenario=(next:WorkshopId)=>{
    if(next===scenario)return;
    setScenario(next);
    setDraft(restoreDraft(next,repairCase,pathCase));
    setPrediction('');
    setSubmittedPrediction('');
    setCausePrediction('');
    setSubmittedCause('');
    setRemediation('');
    setSubmittedRemediation('');
    setRecoveryCheck(null);
    setSelectedConclusion('');
    setSubmittedConclusion('');
    setResult(null);
    setEditorNotice('');
    undoHistory.current=emptyUndoHistory();
    setCanUndo(false);
    cursor.current=null;
    pendingCursor.current=null;
    try{localStorage.setItem(SELECTION_KEY,next);}catch{/* private browsing */}
  };
  const selectRepairCase=(next:RepairWorkshopVariant)=>{
    if(next===repairCase)return;
    setRepairCase(next);
    setDraft(restoreDraft('repair',next,pathCase));
    setPrediction('');
    setSubmittedPrediction('');
    setCausePrediction('');
    setSubmittedCause('');
    setRemediation('');
    setSubmittedRemediation('');
    setRecoveryCheck(null);
    setSelectedConclusion('');
    setSubmittedConclusion('');
    setResult(null);
    setEditorNotice('');
    undoHistory.current=emptyUndoHistory();
    setCanUndo(false);
    cursor.current=null;
    pendingCursor.current=null;
    try{localStorage.setItem(REPAIR_CASE_KEY,next);}catch{/* private browsing */}
  };
  const selectPathCase=(next:PathWorkshopVariant)=>{
    if(next===pathCase)return;
    setPathCase(next);
    if(next==='blind'){
      setBlindCause(randomBlindCause());
      setBlindTicketId(randomBlindTicket());
    }
    setDraft(restoreDraft('pathblock',repairCase,next));
    setPrediction('');
    setSubmittedPrediction('');
    setCausePrediction('');
    setSubmittedCause('');
    setRemediation('');
    setSubmittedRemediation('');
    setRecoveryCheck(null);
    setSelectedConclusion('');
    setSubmittedConclusion('');
    setResult(null);
    setEditorNotice('');
    undoHistory.current=emptyUndoHistory();
    setCanUndo(false);
    cursor.current=null;
    pendingCursor.current=null;
    try{localStorage.setItem(PATH_CASE_KEY,next);}catch{/* private browsing */}
  };
  const nextBlindIncident=()=>{
    setBlindCause(randomBlindCause());
    setBlindTicketId(randomBlindTicket(blindTicketId));
    setCausePrediction('');
    setSubmittedCause('');
    setRemediation('');
    setSubmittedRemediation('');
    setRecoveryCheck(null);
    setSelectedConclusion('');
    setSubmittedConclusion('');
    setPrediction('');
    setSubmittedPrediction('');
    setResult(null);
    setEditorNotice('');
    // A fresh case requires a fresh recall attempt, not replaying old text.
    setDraft('');
    try{localStorage.setItem(pathblockWorkshopDraftKey('blind'),'');}catch{/* private browsing */}
    undoHistory.current=emptyUndoHistory();
    setCanUndo(false);
    cursor.current=null;
    pendingCursor.current=null;
  };
  const recordEdit=(next:string,kind:EditKind,
    before:{start:number;end:number},after:{start:number;end:number})=>{
    const updated=recordEditorEdit(undoHistory.current,
      {value:draft,...before},{value:next,...after},kind,Date.now());
    undoHistory.current=updated;
    setCanUndo(updated.past.length>0);
  };
  const undo=()=>{
    const restored=undoEditorEdit(undoHistory.current);
    if(!restored)return;
    undoHistory.current=restored.history;
    setCanUndo(restored.history.past.length>0);
    const selection={start:restored.snapshot.start,end:restored.snapshot.end};
    cursor.current=selection;
    pendingCursor.current=selection;
    change(restored.snapshot.value);
  };
  const trackSelection=()=>{
    const field=editor.current;
    if(field)cursor.current={start:field.selectionStart,end:field.selectionEnd};
  };
  const insertShortcut=(token:string)=>{
    const selected=cursor.current??{start:draft.length,end:draft.length};
    const next=insertAtSelection(draft,token,selected.start,selected.end,WORKSHOP_MAX_CHARS);
    if(!next){
      setEditorNotice('Limit '+WORKSHOP_MAX_CHARS+' znaków. Usuń część tekstu, aby wstawić znak.');
      return;
    }
    if(next.value===draft){
      editor.current?.focus({preventScroll:true});
      editor.current?.setSelectionRange(next.cursor,next.cursor);
      cursor.current={start:next.cursor,end:next.cursor};
      return;
    }
    const after={start:next.cursor,end:next.cursor};
    recordEdit(next.value,'shortcut',selected,after);
    cursor.current=after;
    pendingCursor.current=after;
    change(next.value);
  };
  const run=()=>{
    // Freeze the answer at run time; edits or post-result selections cannot backfill it.
    setSubmittedPrediction(prediction);
    setSubmittedCause(scenario==='pathblock'?causePrediction:'');
    setRemediation('');
    setSubmittedRemediation('');
    setRecoveryCheck(null);
    setSelectedConclusion('');
    setSubmittedConclusion('');
    setResult(runWorkshop(draft,scenario,
      scenario==='pathblock'?(pathCase==='blind'?'intro':pathCase):repairCase,
      scenario==='pathblock'&&pathCase==='blind'?blindCause:null,
      blindTicketId));
  };
  const focusErrorLine=()=>{
    const element=editor.current;
    if(!element||!result?.errorLine)return;
    const range=sourceLineRange(draft,result.errorLine);
    if(!range)return;
    // Select the problem line for editing, not the entire script. Explicit
    // tap allows scrolling the editor into view without keyboard surprises.
    element.focus({preventScroll:true});
    element.setSelectionRange(range.start,range.end);
    cursor.current=range;
    element.scrollIntoView({block:'nearest'});
  };
  const copies=result?.steps.flatMap(s=>s.changedFiles)
    .filter(path=>path.endsWith('.copy')).length??0;
  const exitComparison=result?compareExitPrediction(scenario,submittedPrediction,result):null;
  const causeComparison=result&&scenario==='pathblock'?compareCausePrediction(submittedCause,result):null;
  const blindDecision=scenario==='pathblock'&&pathCase==='blind';
  const currentTicket=blindTicket(blindTicketId);
  const decisionFeedback=blindDecision&&result&&submittedRemediation?
    gradeRemediation(submittedRemediation,result):null;
  const concreteEvidence=blindDecision&&result&&recoveryCheck?
    concreteRecoveryEvidence(result,recoveryCheck,blindTicketId):null;
  const evidenceFeedback=submittedConclusion?
    gradeConcreteEvidence(concreteEvidence,submittedConclusion):null;
  const verifiedBlind=!!recoveryCheck?.verified&&evidenceFeedback?.matched===true;
  return <section className="bash-workshop" aria-label="Mobilny warsztat Bash">
    <div className="workshop-heading">
      <span className="eyebrow">BASH WORKSHOP</span>
      <label className="workshop-scenario-picker" htmlFor="workshop-scenario">
        <span className="sr-only">Wybierz ćwiczenie Bash</span>
        <select id="workshop-scenario" value={scenario}
          onChange={e=>selectScenario(e.target.value as WorkshopId)}>
          {workshopScenarios.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
    </div>
    <h2>{workshopScenarios.find(item=>item.id===scenario)?.title}</h2>
    {scenario==='repair'&&<label className="workshop-repair-case-picker" htmlFor="workshop-repair-case">
      <span>Przypadek</span>
      <select id="workshop-repair-case" value={repairCase}
        onChange={e=>selectRepairCase(e.target.value as RepairWorkshopVariant)}>
        <option value="intro">Katalog · z pomocą</option>
        <option value="transfer">Katalog · samodzielnie</option>
        <option value="file">Plik · samodzielnie</option>
      </select>
    </label>}
    {scenario==='pathblock'&&<label className="workshop-repair-case-picker" htmlFor="workshop-path-case">
      <span>Przypadek</span>
      <select id="workshop-path-case" value={pathCase}
        onChange={e=>selectPathCase(e.target.value as PathWorkshopVariant)}>
        <option value="intro">Katalog · z pomocą</option>
        <option value="transfer">Plik · samodzielnie</option>
        <option value="blind">Ślepy incydent · bez podpowiedzi</option>
      </select>
    </label>}
    {scenario==='pathblock'&&pathCase==='blind'&&
      <button type="button" className="workshop-repair-variant" onClick={nextBlindIncident}>
        Nowy incydent
      </button>}
    {scenario==='repair'&&repairCase==='file'?<p className="workshop-task">
      Dyżur SOC: wirtualny <code>~/practice/checks/locked.log</code> istnieje,
      ale aplikacja nie może go odczytać. Rozpoznaj przyczynę, przywróć
      wyłącznie niezbędne prawo i zweryfikuj odczyt, nie modyfikując
      treści ani innych uprawnień.</p>
    :scenario==='pathblock'&&pathCase==='blind'?<p className="workshop-task">
      <strong>{currentTicket.title}.</strong> {currentTicket.symptom}
      <code> ~/practice/diagnostics/{currentTicket.name}</code>.
      Nie znasz przyczyny. Postaw hipotezę i zbierz dowody, nie zmieniając plików ani praw.</p>
    :scenario==='pathblock'&&pathCase==='transfer'?<p className="workshop-task">
      Incydent: plik <code>~/practice/checks/locked.log</code> istnieje,
      lecz odczyt kończy się odmową dostępu. Zbierz dowód nieudanego testu
      i ustal, czy przeszkoda leży w katalogu, czy w prawach pliku.
      Nie modyfikuj systemu plików.</p>
    :scenario==='repair'&&repairCase==='transfer'?<p className="workshop-task">
      Zgłoszenie z monitoringu: istniejący plik
      <code> ~/practice/logs/locked/health.log</code> nie daje się odczytać.
      Samodzielnie ustal przyczynę, przywróć dostęp najmniejszą niezbędną zmianą
      i potwierdź odczyt. Nie zmieniaj innych zasobów.</p>
    :scenario==='repair'?<p className="workshop-task">Diagnoza wskazała katalog
      <code> ~/practice/diagnostics</code> bez prawa <code>x</code>.
      W krótkim skrypcie samodzielnie potwierdź blokadę, napraw tylko brakujące prawo
      właściciela i sprawdź odczyt <code>service.log</code>. Nie używaj <code>chmod 777</code>
      i nie zmieniaj innych plików.</p>
    :scenario==='pathblock'?<p className="workshop-task">Wirtualny plik <code>~/practice/diagnostics/service.log</code>
      istnieje, ale aplikacja nie może go odczytać. Sprawdź dostęp przez <code>test -r</code>,
      odczytaj kod przez <code>echo $?</code> i znajdź blokujący element ścieżki poleceniem <code>namei -l</code>.
      Nie zmieniaj uprawnień ani danych.</p>
    :scenario==='transfer'?<p className="workshop-task">Zgłoszenie z dyżuru: w katalogu
      <code> ~/practice</code> nie pojawił się <code>audit-daily.log</code>.
      Dostępny jest <code>alerts.log</code>. Samodzielnie sprawdź działanie planu awaryjnego
      i odczytaj końcowy kod wyjścia. Nie zmieniaj plików.</p>
    :scenario==='backup'?<p className="workshop-task">Ustaw <code>BASE=~/practice</code>. Jedną pętlą <code>for</code> skopiuj
      <code> events.log</code> i <code> alerts.log</code> do plików z końcówką <code>.copy</code>.
      Na końcu sprawdź istnienie <strong>obu kopii</strong> przez <code>test -f</code> i <code>&amp;&amp;</code>.
      Nie zmieniaj oryginałów.</p>:scenario==='diagnosis'?<p className="workshop-task">
      Ustaw <code>BASE=~/practice</code>. Sprawdź po kolei <code>manual.log</code> i <code>missing.log</code> przez
      <code> test -f</code> połączone <code>&amp;&amp;</code>. Następnie użyj <code>echo $?</code>,
      żeby ustalić kod wyniku. Niczego nie kopiuj ani nie usuwaj.</p>
    :scenario==='permissions'?<p className="workshop-task">Plik <code>checks/locked.log</code> istnieje, ale odczyt jest zabroniony.
      Ustaw <code>BASE=~/practice</code> i sprawdź <strong>ten sam plik</strong> kolejno przez
      <code> test -f</code> oraz <code> test -r</code> połączone <code>&amp;&amp;</code>.
      Następnie odczytaj wynik przez <code>echo $?</code>. Nie zmieniaj uprawnień ani pliku.</p>
    :<p className="workshop-task">Nie ma <code>missing.log</code>, ale istnieje zapasowy <code>manual.log</code>.
      Ustaw <code>BASE=~/practice</code>. Sprawdź najpierw brakujący log przez <code>test -f</code>,
      a potem przez <code>||</code> przejdź do testu zapasowego pliku.
      Użyj <code>echo $?</code>, aby potwierdzić końcowy kod. Nie zmieniaj plików.</p>}
    <label htmlFor="bash-workshop-editor" className="workshop-editor-label">Twój skrypt (maks. 4 linie)</label>
    <textarea id="bash-workshop-editor" ref={editor} value={draft} rows={4}
      spellCheck={false} autoCapitalize="none" autoCorrect="off"
      maxLength={WORKSHOP_MAX_CHARS}
      onChange={e=>{
        const field=e.currentTarget;
        const next=field.value;
        const previous=cursor.current??{
          start:Math.min(field.selectionStart,draft.length),
          end:Math.min(field.selectionEnd,draft.length)
        };
        const after={start:field.selectionStart,end:field.selectionEnd};
        recordEdit(next,'typing',previous,after);
        cursor.current=after;
        change(next);
      }}
      onSelect={trackSelection} onKeyUp={trackSelection} onClick={trackSelection}
      aria-describedby="workshop-editor-help"
    />
    <div className="workshop-shortcuts" role="group" aria-label="Znaki Bash - wstaw do edytora">
      <button type="button" className="workshop-undo" disabled={!canUndo}
        aria-label="Cofnij ostatnią zmianę w edytorze" title="Cofnij" onClick={undo}>↶</button>
      {shortcuts.map(item=><button key={item.label} type="button"
        onPointerDown={e=>{if(e.pointerType==='mouse')e.preventDefault();}}
        onClick={()=>insertShortcut(item.value)} aria-label={item.description}
        title={item.description}>{item.label}</button>)}
    </div>
    {editorNotice&&<p role="status" className="workshop-editor-notice">{editorNotice}</p>}
    {scenario==='pathblock'&&<label className="workshop-editor-label" htmlFor="workshop-cause-prediction">
      Hipoteza przed uruchomieniem
      <select id="workshop-cause-prediction" value={causePrediction}
        onChange={e=>{
          setCausePrediction(e.target.value as CausePrediction);
          setSubmittedCause('');
          setRecoveryCheck(null);
          setSelectedConclusion('');
          setSubmittedConclusion('');
        }}>
        <option value="">Bez hipotezy</option>
        <option value="directory">Brak x w katalogu</option>
        <option value="file">Brak r w pliku</option>
        {pathCase==='blind'&&<option value="missing">Plik nie istnieje</option>}
      </select>
    </label>}
    <div className={'workshop-controls '+(scenario==='repair'?'repair':scenario!=='backup'?'diagnosis':'')}>
      {scenario!=='repair'&&<label htmlFor="workshop-prediction">{scenario==='backup'?'Przewidź kopie':'Przewidź kod'}
        <select id="workshop-prediction" value={prediction}
          onChange={e=>{
            setPrediction(e.target.value as ExitPrediction);
            setSubmittedPrediction('');
          }}>
          <option value="">{scenario==='backup'?'Ile kopii?':'Kod zakończenia?'}</option>
          <option value="0">{scenario==='backup'?'0 kopii':'0 - sukces'}</option>
          <option value="1">{scenario==='backup'?'1 kopia':'1 - brak sukcesu'}</option>
          {scenario==='backup'&&<option value="2">2 kopie</option>}
        </select>
      </label>}
      <button type="button" onClick={run}
        disabled={scenario==='pathblock'&&pathCase==='blind'&&causePrediction===''}
        title={scenario==='pathblock'&&pathCase==='blind'&&causePrediction===''?
          'Najpierw postaw hipotezę':'Uruchom wirtualny skrypt'}>
        Uruchom <span aria-hidden="true">▶</span>
      </button>
    </div>
    <p className="workshop-limit" id="workshop-editor-help">Tylko wirtualny Linux · bez poleceń hosta i sieci.</p>
    {result&&<div className={'workshop-result '+(result.completed?'completed':'incomplete')}
      role="status" aria-live="polite">
      <strong>{result.completed?
        blindDecision&&!verifiedBlind?'✓ Diagnoza wykonana':'✓ Zadanie wykonane'
        :'Sprawdź i popraw'}</strong>
      <p>{blindDecision&&result.completed&&!verifiedBlind?
        recoveryCheck?
          'Symulacja wykonana. Porównaj konkretne wyniki przed i po naprawie.':
          decisionFeedback?.matched?
            'Decyzja przyjęta. Zweryfikuj jej skutki w odizolowanym symulatorze.':
            'Sprawdź przebieg i zdecyduj, jaka minimalna interwencja wynika z dowodów.':
        result.feedback}</p>
      {!result.completed&&result.errorLine!==undefined&&<button type="button"
        className="workshop-fix-line" onClick={focusErrorLine}
        aria-label={'Przejdź do poprawienia linii '+result.errorLine}>
        Popraw linię {result.errorLine} ↑
      </button>}
      {scenario==='backup'&&submittedPrediction&&<p className="workshop-prediction">Przewidywanie: {submittedPrediction} · kopie utworzone: {copies}.
        {Number(submittedPrediction)===copies?' Zgadza się.':' Porównaj to z wykonanymi krokami.'}</p>}
      {causeComparison&&(!blindDecision||decisionFeedback?.matched===true)&&
        <p className="workshop-prediction">
        Hipoteza: {causeComparison.predicted==='directory'?'katalog bez x':
          causeComparison.predicted==='file'?'plik bez r':'brak pliku'}.
        {causeComparison.observed===null?' Brak wystarczających dowodów namei.'
          :<> Dowód: {causeComparison.observed==='directory'?'blokada katalogu':
            causeComparison.observed==='file'?'brak odczytu pliku':'plik nie istnieje'}.
            {causeComparison.matched?' Hipoteza potwierdzona.':' Hipoteza obalona - przeanalizuj namei.'}
          </>}
      </p>}
      {exitComparison&&<p className="workshop-prediction">
        Przewidziano kod {exitComparison.predicted}.
        {exitComparison.observed===null
          ?' Brak wykonanego echo $? - nie można jeszcze ocenić przewidywania.'
          :<> Faktyczny odczyt: {exitComparison.observed}.
            {exitComparison.matched?' Trafnie.':' Sprawdź wykonane i pominięte warunki w Przebiegu.'}
            {!result.completed&&' Sam kod nie oznacza zaliczenia zadania.'}
          </>}
      </p>}
      {blindDecision&&result.completed&&<div className="workshop-remediation">
        <label htmlFor="workshop-remediation">Decyzja po analizie dowodów</label>
        <div className="workshop-remediation-controls">
          <select id="workshop-remediation" value={remediation}
            onChange={e=>{
              setRemediation(e.target.value as RemediationChoice);
              setSubmittedRemediation('');
              setRecoveryCheck(null);
              setSelectedConclusion('');
              setSubmittedConclusion('');
            }}>
            <option value="">Wybierz minimalne działanie</option>
            <option value="directory-x">Przywróć właścicielowi x na katalogu</option>
            <option value="file-r">Przywróć właścicielowi r na pliku</option>
            <option value="restore-backup">Odzyskaj plik ze sprawdzonej kopii</option>
            <option value="chmod-777">Nadaj 777 wszystkim</option>
          </select>
          <button type="button" disabled={!remediation}
            onClick={()=>{
              setSubmittedRemediation(remediation);
              setRecoveryCheck(null);
              setSelectedConclusion('');
              setSubmittedConclusion('');
            }}>
            Sprawdź
          </button>
        </div>
        {decisionFeedback&&<p className="workshop-decision-feedback" role="status">
          {decisionFeedback.message}
        </p>}
        {decisionFeedback?.matched===true&&<div className="workshop-recovery-check">
          <button type="button" className="workshop-recovery-run"
            disabled={recoveryCheck!==null}
            onClick={()=>setRecoveryCheck(verifyRecoveryPreview(result,submittedRemediation,blindTicketId))}>
            {recoveryCheck?'Weryfikacja wykonana':'Zasymuluj i sprawdź skutki'}
          </button>
          {recoveryCheck&&<div className="workshop-recovery-report">
            <small>Wirtualna operacja: <code>{recoveryCheck.command}</code></small>
            {recoveryCheck.usedTrainingBackup&&<small>
              W symulacji wykorzystano zweryfikowaną kopię treningową.
              To nie dowodzi, że taka kopia istnieje w prawdziwym środowisku.
            </small>}
            {concreteEvidence&&<div className="workshop-concrete-evidence">
              <table aria-label="Wyniki przed i po naprawie">
                <thead><tr><th scope="col">Dowód</th><th scope="col">Przed</th>
                  <th scope="col">Po</th></tr></thead>
                <tbody>{concreteEvidence.rows.map(row=><tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.before}</td><td>{row.after}</td>
                </tr>)}</tbody>
              </table>
              <label htmlFor="workshop-evidence-conclusion">
                {concreteEvidence.question}
              </label>
              <select id="workshop-evidence-conclusion" value={selectedConclusion}
                onChange={e=>{
                  setSelectedConclusion(e.target.value as EvidenceInterpretation|'');
                  setSubmittedConclusion('');
                }}>
                <option value="">Wybierz wniosek z danych</option>
                {concreteEvidence.options.map(option=><option key={option.id}
                  value={option.id}>{option.label}</option>)}
              </select>
              <button type="button" className="workshop-evidence-submit"
                disabled={!selectedConclusion}
                onClick={()=>setSubmittedConclusion(selectedConclusion)}>
                Oceń wniosek
              </button>
            </div>}
            {evidenceFeedback&&<p role="status" className="workshop-evidence-feedback">
              {evidenceFeedback.message}
            </p>}
            {evidenceFeedback?.matched===true&&<div className="workshop-evidence-verified"
              role="status">
              <p>{recoveryCheck.message}</p>
              <ul>
                {recoveryCheck.checks.map(check=><li key={check.id}>
                  <span aria-hidden="true">{check.passed?'✓':'✗'}</span> {check.label}
                </li>)}
              </ul>
            </div>}
          </div>}
        </div>}
      </div>}
      {result.steps.length>0&&<details className="workshop-trace">
        <summary>Przebieg · {result.steps.length} {result.steps.length===1?'linia':'linie'}</summary>
        <ol>
          {result.steps.map(step=><li key={step.line}>
            <strong>Linia {step.line}: {step.command}</strong> · kod {step.exitCode}
            {step.iterations>0&&<span> · {step.iterations} iteracje</span>}
            {step.blockedAt&&<small>Katalog bez prawa przejścia (x): {step.blockedAt}</small>}
            {step.variables.length>0&&<small>Zmienne: {step.variables.join(', ')}</small>}
            {step.changedFiles.length>0&&<small>Pliki: {step.changedFiles.join(', ')}</small>}
            {step.checks.length>0&&<ul className="workshop-conditional-steps" aria-label="Warunki wykonania">
              {step.checks.map((check,i)=><li key={i}>
                <code>{i>0?check.operator+' ':''}{check.command}</code>
                <span> · {check.executed?'wykonano · kod '+check.exitCode:
                  check.operator==='&&'?'pominięto: poprzedni test nie powiódł się':
                  check.operator==='||'?'pominięto: poprzedni test się powiódł':
                  'pominięto'}</span>
              </li>)}
            </ul>}
            {step.output&&<small>{step.output}</small>}
          </li>)}
        </ol>
      </details>}
    </div>}
    <details className="workshop-help">
      <summary>Składnia i rozpoczęcie od nowa</summary>
      {scenario==='repair'&&repairCase==='file'?<p>Bez gotowego szablonu.
        Zidentyfikuj właściwy element ścieżki i przywróć jedynie to uprawnienie,
        którego brak powoduje incydent. Unikaj chmod 777 i nie zmieniaj danych.</p>
       :scenario==='repair'&&repairCase==='transfer'?<p>Bez gotowego szablonu.
        Rozwiąż incydent na podstawie zgłoszenia. Jeśli utkniesz,
        możesz wrócić do wariantu z pomocą i ponownie spróbować samodzielnie.</p>
       :scenario==='repair'?<p>W czterech liniach użyj <code>BASE=~/practice</code>,
        <code> namei -l</code>, minimalnego <code>chmod u+x</code> i końcowego
        <code> cat</code>. Możesz też ustawić dokładny tryb <code>700</code>.
        Nie stosuj praw dla grupy lub pozostałych.</p>
       :scenario==='pathblock'&&pathCase==='blind'?<p>Bez gotowego skryptu.
         Sprawdź test odczytu, kod zakończenia i poszczególne elementy ścieżki.
         Odróżnij brak pliku od odmowy odczytu istniejącego pliku.</p>
       :scenario==='pathblock'&&pathCase==='transfer'?<p>Bez gotowego skryptu.
        Porównaj zachowanie z wariantem katalogowym. Zwróć uwagę, co naprawdę
        pokazuje wynik polecenia badającego każdy składnik ścieżki.</p>
       :scenario==='pathblock'?<p>Zacznij od <code>BASE=~/practice</code>. Wykonaj
        <code> test -r</code> na ścieżce przez <code>$BASE</code>, natychmiast odczytaj
        <code> echo $?</code>, a następnie użyj <code>namei -l</code> do sprawdzenia katalogów.
        Prawa <code>r</code> samego pliku nie wystarczą, gdy katalog nadrzędny nie ma <code>x</code>.</p>
       :scenario==='transfer'?<p>Brak gotowego skryptu i instrukcji składni.
        Jeśli utkniesz, wróć do zadania 04, a potem spróbuj tu ponownie.</p>
       :scenario==='backup'?<p>W pierwszej linii przypisz katalog do zmiennej <code>BASE</code>.
        W drugiej użyj <code>for FILE in ...; do cp ...; done</code>.
        W trzeciej sprawdź dwie kopie, używając <code>test -f</code> i <code>&amp;&amp;</code>.</p>
       :scenario==='diagnosis'?<p>Wpisz <code>BASE=~/practice</code>, potem dwa testy
        <code> test -f "$BASE/manual.log" &amp;&amp; test -f "$BASE/missing.log"</code>.
        Kod zakończenia ostatniego testu sprawdzisz przez <code>echo $?</code>.
        Wynik 1 jest w tej diagnozie oczekiwanym sygnałem braku pliku.</p>
       :scenario==='permissions'?<p>Użyj <code>BASE=~/practice</code> i sprawdź dwukrotnie
        <code> "$BASE/checks/locked.log"</code>, najpierw przez <code>test -f</code>,
        potem przez <code>&amp;&amp; test -r</code>. Odczytaj <code>echo $?</code>.
        Istnienie pliku i prawo do jego odczytu to dwa różne pytania.</p>
       :<p>Operator <code>||</code> uruchamia drugi test tylko wtedy, gdy pierwszy zakończy się
        niepowodzeniem. Ustaw <code>BASE=~/practice</code>, sprawdź najpierw
        <code> missing.log</code>, potem <code>manual.log</code>. Odczytaj kod przez <code>echo $?</code>.
        Przewidź, czy wynik drugiego testu zmieni ostatni kod zakończenia.</p>}
      <button type="button" className="workshop-reset" onClick={()=>{
        const selected=cursor.current??{start:draft.length,end:draft.length};
        const template=initialDraft(scenario,repairCase,pathCase);
        recordEdit(template,'reset',selected,{start:template.length,end:template.length});
        cursor.current=null;
        pendingCursor.current=null;
        change(template);setPrediction('');
      }}>{scenario==='transfer'||(scenario==='repair'&&repairCase!=='intro')||
        (scenario==='pathblock'&&pathCase==='transfer')?
        'Wyczyść skrypt':'Wstaw pusty szablon'}</button>
    </details>
  </section>;
}

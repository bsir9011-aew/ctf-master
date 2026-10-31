import {useLayoutEffect,useRef,useState} from 'react';
import {insertAtSelection} from '../core/editorInsertion';
import {emptyUndoHistory,recordEditorEdit,undoEditorEdit,
  type EditKind} from '../core/editorUndo';
import {sourceLineRange} from '../core/workshopSourceLines';
import {
  WORKSHOP_DEFAULT,WORKSHOP_MAX_CHARS,runWorkshop,
  type WorkshopResult
} from '../core/bashWorkshop';

const DRAFT_KEY='ctf-master:bash-workshop-draft-v1';
const shortcuts=[
  {label:'$',value:'$',description:'Wstaw dolar - początek nazwy zmiennej'},
  {label:'"',value:'"',description:'Wstaw cudzysłów'},
  {label:"'",value:"'",description:'Wstaw apostrof'},
  {label:'~',value:'~',description:'Wstaw tyldę - katalog domowy'},
  {label:'&&',value:'&&',description:'Wstaw dwa ampersandy - wykonaj po sukcesie'},
  {label:';',value:';',description:'Wstaw średnik'},
  {label:'↵',value:'\n',description:'Wstaw nową linię'}
] as const;
function restoreDraft():string{
  try{
    const saved=localStorage.getItem(DRAFT_KEY);
    return saved&&saved.length<=WORKSHOP_MAX_CHARS?saved:WORKSHOP_DEFAULT;
  }catch{return WORKSHOP_DEFAULT;}
}

/** One compact mobile screen, one task, one run; no multi-panel wizard. */
export default function BashWorkshop(){
  const [draft,setDraft]=useState(restoreDraft);
  const [prediction,setPrediction]=useState('');
  const [result,setResult]=useState<WorkshopResult|null>(null);
  const [editorNotice,setEditorNotice]=useState('');
  const [canUndo,setCanUndo]=useState(false);
  const undoHistory=useRef(emptyUndoHistory());
  const editor=useRef<HTMLTextAreaElement>(null);
  const cursor=useRef<{start:number;end:number}|null>(null);
  const pendingCursor=useRef<{start:number;end:number}|null>(null);
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
    setEditorNotice('');
    setDraft(next);
    setResult(null);
    try{localStorage.setItem(DRAFT_KEY,next);}catch{/* private browsing */}
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
    setResult(runWorkshop(draft));
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
  return <section className="bash-workshop" aria-label="Mobilny warsztat Bash">
    <div className="workshop-heading">
      <span className="eyebrow">BASH WORKSHOP · 01</span>
      <span className="workshop-badge">1 zadanie</span>
    </div>
    <h2>Zabezpiecz dwa logi</h2>
    <p className="workshop-task">Ustaw <code>BASE=~/practice</code>. Jedną pętlą <code>for</code> skopiuj
      <code> events.log</code> i <code> alerts.log</code> do plików z końcówką <code>.copy</code>.
      Na końcu sprawdź istnienie <strong>obu kopii</strong> przez <code>test -f</code> i <code>&amp;&amp;</code>.
      Nie zmieniaj oryginałów.</p>
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
    <div className="workshop-controls">
      <label htmlFor="workshop-prediction">Przewidź
        <select id="workshop-prediction" value={prediction}
          onChange={e=>setPrediction(e.target.value)}>
          <option value="">Ile kopii?</option>
          <option value="0">0 kopii</option>
          <option value="1">1 kopia</option>
          <option value="2">2 kopie</option>
        </select>
      </label>
      <button type="button" onClick={run}>Uruchom <span aria-hidden="true">▶</span></button>
    </div>
    <p className="workshop-limit" id="workshop-editor-help">Tylko wirtualny Linux · bez poleceń hosta i sieci.</p>
    {result&&<div className={'workshop-result '+(result.completed?'completed':'incomplete')}
      role="status" aria-live="polite">
      <strong>{result.completed?'✓ Zadanie wykonane':'Sprawdź i popraw'}</strong>
      <p>{result.feedback}</p>
      {!result.completed&&result.errorLine!==undefined&&<button type="button"
        className="workshop-fix-line" onClick={focusErrorLine}
        aria-label={'Przejdź do poprawienia linii '+result.errorLine}>
        Popraw linię {result.errorLine} ↑
      </button>}
      {prediction&&<p className="workshop-prediction">Przewidywanie: {prediction} · kopie utworzone: {copies}.
        {Number(prediction)===copies?' Zgadza się.':' Porównaj to z wykonanymi krokami.'}</p>}
      {result.steps.length>0&&<details className="workshop-trace">
        <summary>Przebieg · {result.steps.length} {result.steps.length===1?'linia':'linie'}</summary>
        <ol>
          {result.steps.map(step=><li key={step.line}>
            <strong>Linia {step.line}: {step.command}</strong> · kod {step.exitCode}
            {step.iterations>0&&<span> · {step.iterations} iteracje</span>}
            {step.variables.length>0&&<small>Zmienne: {step.variables.join(', ')}</small>}
            {step.changedFiles.length>0&&<small>Pliki: {step.changedFiles.join(', ')}</small>}
            {step.skipped>0&&<small>Pominięte warunki: {step.skipped}</small>}
            {step.output&&<small>{step.output}</small>}
          </li>)}
        </ol>
      </details>}
    </div>}
    <details className="workshop-help">
      <summary>Składnia i rozpoczęcie od nowa</summary>
      <p>W pierwszej linii przypisz katalog do zmiennej <code>BASE</code>.
        W drugiej użyj <code>for FILE in ...; do cp ...; done</code>.
        W trzeciej sprawdź dwie kopie, używając <code>test -f</code> i <code>&amp;&amp;</code>.</p>
      <button type="button" className="workshop-reset" onClick={()=>{
        const selected=cursor.current??{start:draft.length,end:draft.length};
        recordEdit(WORKSHOP_DEFAULT,'reset',selected,{start:WORKSHOP_DEFAULT.length,end:WORKSHOP_DEFAULT.length});
        cursor.current=null;
        pendingCursor.current=null;
        change(WORKSHOP_DEFAULT);setPrediction('');
      }}>Wstaw pusty szablon</button>
    </details>
  </section>;
}

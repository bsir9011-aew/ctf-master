import {useState} from 'react';
import {
  WORKSHOP_DEFAULT,WORKSHOP_MAX_CHARS,runWorkshop,
  type WorkshopResult
} from '../core/bashWorkshop';

const DRAFT_KEY='ctf-master:bash-workshop-draft-v1';
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
  const change=(next:string)=>{
    setDraft(next);
    setResult(null);
    try{localStorage.setItem(DRAFT_KEY,next);}catch{/* private browsing */}
  };
  const run=()=>{
    setResult(runWorkshop(draft));
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
    <textarea id="bash-workshop-editor" value={draft} rows={4}
      spellCheck={false} autoCapitalize="none" autoCorrect="off"
      maxLength={WORKSHOP_MAX_CHARS}
      onChange={e=>change(e.target.value)}
      aria-describedby="workshop-editor-help"
    />
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
        change(WORKSHOP_DEFAULT);setPrediction('');
      }}>Wstaw pusty szablon</button>
    </details>
  </section>;
}

import {useRef,useState} from 'react';
import {
  makeProgressBackup,parseProgressBackup,type BackupMissionData,
  type ProgressBackup
} from '../core/progressBackup';

const ACADEMY='ctf-master:command-academy-v1';
const COACH='ctf-master:academy-coach-v1';
function readJson(key:string):unknown{
  try{return JSON.parse(localStorage.getItem(key)??'null');}catch{return null;}
}

interface Props{
  session:BackupMissionData;
  onImport:(backup:ProgressBackup)=>string;
}

export default function ProgressBackupPanel({session,onImport}:Props){
  const [exported,setExported]=useState('');
  const [importText,setImportText]=useState('');
  const [status,setStatus]=useState('');
  const exportRef=useRef<HTMLTextAreaElement>(null);
  const [preview,setPreview]=useState<ProgressBackup|null>(null);
  const [previewText,setPreviewText]=useState('');

  function exportProgress(){
    const json=makeProgressBackup(session,readJson(ACADEMY),readJson(COACH),new Date().toISOString());
    setExported(json);
    setStatus('Kopia wygenerowana. Skopiuj ją i zapisz poza aplikacją przed odinstalowaniem APK.');
  }
  async function copyProgress(){
    if(!exported)return;
    try{
      if(!navigator.clipboard?.writeText)throw Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(exported);
      setStatus('Skopiowano. Zapisz tekst w bezpiecznym miejscu poza CTF Master.');
    }catch{
      exportRef.current?.focus();
      exportRef.current?.select();
      setStatus('Zaznaczono kod. Skopiuj go ręcznie i zapisz poza aplikacją.');
    }
  }
  function checkImport(){
    try{
      const payload=parseProgressBackup(importText.trim());
      setPreview(payload);
      setPreviewText(importText.trim());
      setStatus('Kopia rozpoznana. Potwierdź połączenie postępów.');
    }catch(error){
      setPreview(null);
      setPreviewText('');
      setStatus(error instanceof Error?error.message:'Nie udało się odczytać kopii.');
    }
  }
  function applyImport(){
    if(!preview||previewText!==importText.trim()){
      setStatus('Kod zmienił się po sprawdzeniu. Zweryfikuj go ponownie.');
      setPreview(null);return;
    }
    const result=onImport(preview);
    setStatus(result);
    setPreview(null);
    setPreviewText('');
    setImportText('');
  }

  return <section className="progress-backup" aria-label="Kopia zapasowa postępów">
    <details>
      <summary>Postępy · Kopia zapasowa i przywracanie</summary>
      <p>Przydatne przed zmianą testowego APK. Kopia obejmuje zaliczenia Akademii, misje, powtórki, raporty i notatki. <strong>Nie obejmuje</strong> aktualnego stanu wirtualnych plików ani rozpoczętych prób.</p>
      <div className="backup-actions">
        <button type="button" onClick={exportProgress}>Wygeneruj kopię</button>
        {exported&&<button type="button" onClick={copyProgress}>Kopiuj kod</button>}
      </div>
      {exported&&<>
        <label htmlFor="backup-export">Kod kopii postępów</label>
        <textarea id="backup-export" ref={exportRef} readOnly value={exported} rows={3}
          onFocus={e=>e.currentTarget.select()} spellCheck={false}/>
        <small>Zapisz cały kod np. w prywatnej notatce poza aplikacją. Schowek telefonu nie jest trwałą kopią.</small>
      </>}
      <div className="backup-import">
        <label htmlFor="backup-import">Przywróć zapisane postępy</label>
        <textarea id="backup-import" value={importText} rows={3} maxLength={350000}
          placeholder="Wklej cały kod kopii JSON..." spellCheck={false}
          onChange={e=>{setImportText(e.target.value);setPreview(null);setStatus('');}}/>
        <div className="backup-actions">
          <button type="button" disabled={!importText.trim()} onClick={checkImport}>Sprawdź kopię</button>
          {preview&&<button type="button" onClick={applyImport}>Połącz postępy</button>}
        </div>
        {preview&&<p className="backup-preview">Rozpoznano: {preview.missions.length} ukończonych misji, {preview.academy.completed.length} poznanych i {preview.academy.mastered.length} opanowanych lekcji. Data kopii: {preview.createdAt}.</p>}
        <small>Import łączy zaliczenia i zachowuje obecne osiągnięcia. Dane pozostają na Twoim urządzeniu; nie są wysyłane do serwera.</small>
      </div>
      {status&&<p role="status" className="backup-status">{status}</p>}
    </details>
  </section>;
}

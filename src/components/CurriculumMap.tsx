import { missions } from '../core/missions';
import { getCurriculum } from '../core/curriculum';

interface Props {
  completed: number[];
  highestUnlocked: number;
  activeIndex: number;
  onSelectMission: (index: number) => void;
}

export default function CurriculumMap({completed,highestUnlocked,activeIndex,onSelectMission}:Props) {
  const completedIds=completed.map(index=>missions[index]?.id).filter((id):id is string=>Boolean(id));
  const chapters=getCurriculum(missions.map(m=>m.id),completedIds,highestUnlocked);
  const current=chapters.find(chapter=>chapter.missionIds.includes(missions[activeIndex]?.id));
  return <section className="curriculum-panel" aria-label="Mapa nauki CTF Master">
    <details>
      <summary className="curriculum-summary">
        <span className="curriculum-summary-main">
          <strong>Mapa nauki — 6 rozdziałów</strong>
          <small>Teraz: {current?.title ?? 'Terminal i pierwsza flaga'}</small>
        </span>
        <span className="curriculum-summary-action">Zobacz ścieżkę</span>
      </summary>
      <div className="curriculum-body">
        <p>Zaczynamy od komend Linux. Dopiero później używamy ich do szukania przyczyn awarii. Każdy rozdział odblokowuje się po ukończeniu wcześniejszych misji.</p>
        <div className="curriculum-chapters">
          {chapters.map((chapter,i)=><article key={chapter.id}
            className={'curriculum-chapter curriculum-'+chapter.status+
              (current?.id===chapter.id?' curriculum-current':'')}>
            <div className="curriculum-chapter-head">
              <strong>{i+1}. {chapter.title}</strong>
              <span>{chapter.status==='completed'?'Ukończony':
                chapter.status==='locked'?'Zablokowany':'Dostępny'}</span>
            </div>
            <p>{chapter.purpose}</p>
            <p className="curriculum-command-set"><strong>Polecenia:</strong> {chapter.commands}</p>
            <p className="curriculum-outcome"><strong>Cel:</strong> {chapter.outcome}</p>
            <div className="curriculum-chapter-bottom">
              <span>{chapter.completedCount}/{chapter.missionCount} misji</span>
              <button type="button" disabled={chapter.recommendedIndex===null}
                onClick={()=>chapter.recommendedIndex!==null&&onSelectMission(chapter.recommendedIndex)}>
                {chapter.status==='completed'?'Powtórz rozdział':
                  chapter.status==='locked'?'Najpierw poprzedni rozdział':'Przejdź do misji'}
              </button>
            </div>
          </article>)}
        </div>
      </div>
    </details>
  </section>;
}

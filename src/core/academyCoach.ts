import { commandLessons, type AcademyProgress } from './commandAcademy.ts';

export interface AcademyLessonMetrics { errors: number; help: number }
export type AcademyCoachMetrics = Record<string, AcademyLessonMetrics>;
export type CoachSignal = 'error' | 'help';
export type AcademyNextStep = {lessonId:string; phase:'intro'|'transfer'; reason:string; score:number};

const VALID = new Set(commandLessons.map(item=>item.id));
const MAX_COUNT=999;
const bounded=(raw:unknown):number =>
  typeof raw==='number' && Number.isSafeInteger(raw) && raw>=0
    ? Math.min(raw,MAX_COUNT):0;

/** Defensive load; previous academy completions stay in their existing storage key. */
export function restoreCoachMetrics(raw:unknown):AcademyCoachMetrics {
  if(!raw || typeof raw!=='object' || Array.isArray(raw)) return {};
  const result:AcademyCoachMetrics={};
  for(const [id,value] of Object.entries(raw)) {
    if(!VALID.has(id) || !value || typeof value!=='object' || Array.isArray(value)) continue;
    const v=value as Partial<AcademyLessonMetrics>;
    const errors=bounded(v.errors), help=bounded(v.help);
    if(errors || help) result[id]={errors,help};
  }
  return result;
}

export function recordCoachSignal(
  metrics:AcademyCoachMetrics,id:string,signal:CoachSignal
):AcademyCoachMetrics {
  if(!VALID.has(id)) return metrics;
  const current=metrics[id] ?? {errors:0,help:0};
  return {...metrics,[id]:{
    ...current,
    [signal]:Math.min(MAX_COUNT,current[signal]+1)
  }};
}

/** Prioritize known-but-unmastered lessons; then untouched ones. No random choices. */
export function recommendAcademy(
  progress:Pick<AcademyProgress,'completed'|'mastered'>,
  metrics:AcademyCoachMetrics
):AcademyNextStep|null {
  const known=new Set(progress.completed);
  const mastered=new Set(progress.mastered);
  let best:AcademyNextStep|null=null;
  for(const lesson of commandLessons) {
    if(mastered.has(lesson.id)) continue;
    const introduced=known.has(lesson.id);
    const errors=bounded(metrics[lesson.id]?.errors);
    const help=bounded(metrics[lesson.id]?.help);
    const weakness=Math.min(99,errors*3+help*5);
    const score=(introduced?100:50)+weakness;
    const reason=introduced
      ? weakness>0
        ? 'Wróć do sprawdzianu: ta komenda wymagała wcześniej dodatkowych prób lub pomocy.'
        : 'Pierwsze ćwiczenie zaliczone. Sprawdź, czy poradzisz sobie na innych danych.'
      : weakness>0
        ? 'Przećwicz podstawy ponownie — wcześniej pojawiły się trudności.'
        : 'Poznaj kolejne polecenie i sprawdź jego działanie.';
    if(best===null || score>best.score) {
      best={lessonId:lesson.id,phase:introduced?'transfer':'intro',reason,score};
    }
  }
  return best;
}

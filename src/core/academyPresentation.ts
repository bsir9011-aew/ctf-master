import type { AcademyNextStep } from './academyCoach.ts';

interface TerminalLine { input?: string; output: string }

/** Grow a compact terminal with its contents, capped before it dominates a lesson. */
export function academyTerminalHeight(lines:readonly TerminalLine[]):number {
  const rows=lines.reduce((count,line)=>count+
    (line.input?1:0)+(line.output?Math.min(5,line.output.split('\n').length):0),0);
  return Math.min(312,Math.max(154,72+rows*22));
}

/** Avoid telling the learner to open the exercise they are already viewing. */
export function needsRecommendation(
  next:AcademyNextStep|null,lessonId:string
):boolean {
  return next!==null&&next.lessonId!==lessonId;
}

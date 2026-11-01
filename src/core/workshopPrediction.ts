import type {WorkshopId} from './workshopScenarios.ts';
import type {WorkshopResult} from './bashWorkshop.ts';

export type ExitPrediction = ''|'0'|'1'|'2';
export interface ExitPredictionFeedback {
  predicted:'0'|'1';
  observed:'0'|'1'|null;
  matched:boolean|null;
}

/** Feedback uses the LAST actually executed echo line, never expected scenario values. */
export function compareExitPrediction(
  scenario:WorkshopId,prediction:ExitPrediction,result:Pick<WorkshopResult,'steps'>
):ExitPredictionFeedback|null {
  if(scenario==='backup'||scenario==='repair'||prediction===''||prediction==='2')return null;
  const last=result.steps.at(-1);
  const observed=last?.command==='echo'&&/^[01]$/.test(last.output)
    ?last.output as '0'|'1':null;
  return {
    predicted:prediction,
    observed,
    matched:observed===null?null:prediction===observed
  };
}

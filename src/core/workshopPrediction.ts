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
  // Path diagnosis runs namei after echo $?; use the last actual echo.
  const lastEcho=[...result.steps].reverse().find(step=>step.command==='echo');
  const observed=lastEcho&&/^[01]$/.test(lastEcho.output)
    ?lastEcho.output as '0'|'1':null;
  return {
    predicted:prediction,
    observed,
    matched:observed===null?null:prediction===observed
  };
}

export type CausePrediction=''|'directory'|'file'|'missing';
/** Only executed evidence can establish a cause. This helper is deliberately
 * unaware of scenario IDs, hidden seeds, expected answers and feedback text.
 */
export function observedAccessCause(result:Pick<WorkshopResult,'steps'>):
  Exclude<CausePrediction,''>|null {
  const steps=result.steps;
  const index=steps.findIndex(step=>
    step.command==='test'&&step.testFlag==='-r'&&step.exitCode===1&&!!step.target);
  const testStep=steps[index],echo=steps[index+1],inspect=steps[index+2];
  let observed:'directory'|'file'|'missing'|null=null;
  if(index>=0&&echo?.command==='echo'&&echo.output==='1'&&
     inspect?.command==='namei'&&inspect.target===testStep?.target&&
     inspect.output.startsWith('f: '+testStep.target+'\n')){
    const last=inspect.output.trimEnd().split('\n').at(-1);
    const basename=testStep.target?.split('/').at(-1);
    if(inspect.exitCode===0&&inspect.blockedAt)observed='directory';
    else if(inspect.exitCode===0&&last?.startsWith('---------- '))observed='file';
    else if(inspect.exitCode===1&&!inspect.blockedAt&&
      last==='??? '+basename+' (No such file or directory)'&&
      inspect.output.split('\n').length>2)observed='missing';
  }
  return observed;
}
export function compareCausePrediction(predicted:CausePrediction,result:Pick<WorkshopResult,'steps'>) {
  if(!predicted)return null;
  const observed=observedAccessCause(result);
  return {predicted,observed,matched:observed===null?null:predicted===observed};
}

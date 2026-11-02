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
/** Evidence must be three actual, distinct commands for the SAME resolved
 * target. In blind mode the user may inspect the path either before or after
 * the test/echo pair; echo must immediately follow the failing test.
 * This is trace evidence, not a scenario label or a forged output string.
 */
export interface AccessEvidencePlan {
  testIndex:1|2;
  inspectIndex:1|3;
  target:string;
}
export function accessEvidencePlan(
  result:Pick<WorkshopResult,'steps'>
):AccessEvidencePlan|null {
  const steps=result.steps;
  if(steps.length!==4||steps[0]?.command!=='variable')return null;
  const testIndex=steps.findIndex(step=>
    step.command==='test'&&step.testFlag==='-r'&&step.exitCode===1&&
    typeof step.target==='string'&&step.target.startsWith('/'));
  if(testIndex!==1&&testIndex!==2)return null;
  const inspectIndex=testIndex===1?3:1;
  const test=steps[testIndex],echo=steps[testIndex+1],inspect=steps[inspectIndex];
  if(echo?.command!=='echo'||echo.target!=='previous-exit'||
     echo.exitCode!==0||echo.output!=='1'||
     inspect?.command!=='namei'||inspect.target!==test.target||
     !inspect.output.startsWith('f: '+test.target+'\n'))return null;
  return {testIndex,inspectIndex:inspectIndex as 1|3,target:test.target!};
}
/** Reads the actual namei evidence. No cause or path guessed from task label. */
export function observedAccessCause(result:Pick<WorkshopResult,'steps'>):
  Exclude<CausePrediction,''>|null {
  const plan=accessEvidencePlan(result);
  if(!plan)return null;
  const inspect=result.steps[plan.inspectIndex];
  const last=inspect.output.trimEnd().split('\n').at(-1);
  const basename=plan.target.split('/').at(-1);
  if(inspect.exitCode===0&&inspect.blockedAt)return 'directory';
  if(inspect.exitCode===0&&last?.startsWith('---------- '))return 'file';
  if(inspect.exitCode===1&&!inspect.blockedAt&&
     last==='??? '+basename+' (No such file or directory)'&&
     inspect.output.split('\n').length>2)return 'missing';
  return null;
}
export function compareCausePrediction(predicted:CausePrediction,result:Pick<WorkshopResult,'steps'>) {
  if(!predicted)return null;
  const observed=observedAccessCause(result);
  return {predicted,observed,matched:observed===null?null:predicted===observed};
}

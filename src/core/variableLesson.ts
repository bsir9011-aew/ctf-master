import type {LinuxState,CommandResult} from './linux.ts';

const ROOT='/home/player/practice';
export const variableCase=(phase:'intro'|'transfer')=>phase==='intro'?{
  source:ROOT+'/source.txt',
  destination:ROOT+'/variable-copy.txt',
  expected:'COPY_ME',
  sourceValue:'~/practice/source.txt',
  destinationValue:'~/practice/variable-copy.txt'
}:{
  source:ROOT+'/logs/review.log',
  destination:ROOT+'/logs/variable-evidence.log',
  expected:'WARN spike\nINFO stable\nERROR temp\nINFO review\nWARN resolved\n',
  sourceValue:'~/practice/logs/review.log',
  destinationValue:'~/practice/logs/variable-evidence.log'
};

/** Actual use of assigned variables matters, not simply typing literal
 * source and target paths. The final readback verifies the copied data.
 */
export function variableCompleted(
  phase:'intro'|'transfer',state:LinuxState,events:readonly CommandResult[]
):boolean {
  const c=variableCase(phase);
  if(state.variables?.SOURCE!==c.sourceValue ||
     state.variables?.DEST!==c.destinationValue||
     state.files[c.source]!==c.expected||
     state.files[c.destination]!==c.expected)return false;
  const source=events.findIndex(e=>e.ok&&e.command==='variable'&&
    e.target==='SOURCE'&&e.state.variables?.SOURCE===c.sourceValue);
  const dest=events.findIndex((e,i)=>i>source&&source>=0&&
    e.ok&&e.command==='variable'&&e.target==='DEST'&&
    e.state.variables?.DEST===c.destinationValue);
  const copied=events.findIndex((e,i)=>i>dest&&dest>=0&&e.ok&&
    e.command==='cp'&&e.target===c.destination&&
    e.variableRefs?.includes('SOURCE')&&e.variableRefs?.includes('DEST')&&
    e.state.files[c.destination]===c.expected);
  return copied>=0&&events.some((e,i)=>i>copied&&e.ok&&
    e.command==='cat'&&e.target===c.destination&&
    e.variableRefs?.includes('DEST')&&e.output===c.expected);
}
export function variableMistake(
  phase:'intro'|'transfer',result:CommandResult
):boolean {
  if(!result.ok)return true;
  const c=variableCase(phase);
  if(result.command==='variable'){
    if(result.target==='SOURCE')return result.state.variables?.SOURCE!==c.sourceValue;
    if(result.target==='DEST')return result.state.variables?.DEST!==c.destinationValue;
  }
  if(result.command==='cp'&&result.variableRefs?.some(v=>['SOURCE','DEST'].includes(v)))
    return result.target!==c.destination;
  return false;
}

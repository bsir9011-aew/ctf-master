import type {LinuxState,CommandResult} from './linux.ts';

const LAB='/home/player/practice';
export const loopCase=(kind:'intro'|'transfer')=>kind==='intro'?{
  sources:[LAB+'/events.log',LAB+'/alerts.log'],
  contents:['INFO boot ready\nWARN backup delayed\nINFO sync complete',
    'WARN storage\nINFO ready\nWARN auth\nWARN storage\nINFO heartbeat\nWARN auth\n']
}:{
  sources:[LAB+'/logs/review.log',LAB+'/logs/incidents.log'],
  contents:['WARN spike\nINFO stable\nERROR temp\nINFO review\nWARN resolved\n',
    'ERROR disk\nINFO ready\nERROR network\nERROR disk\nERROR memory\nINFO sync\nERROR network\n']
};

export function loopCompleted(
  kind:'intro'|'transfer',state:LinuxState,events:readonly CommandResult[]
):boolean {
  const c=loopCase(kind);
  if(c.sources.some((p,i)=>state.files[p]!==c.contents[i]||
     state.files[p+'.copy']!==c.contents[i]))return false;
  const copied=events.findIndex(e=>{
    if(e.command!=='for'||!e.loopTrace||e.loopTrace.length!==c.sources.length)return false;
    return e.loopTrace.every((step,i)=>step.ok&&step.value===c.sources[i]&&
      step.command==='cp'&&step.target===c.sources[i]+'.copy'&&
      step.refs.filter(ref=>ref==='FILE').length>=2&&
      e.state.files[c.sources[i]+'.copy']===c.contents[i]);
  });
  if(copied<0)return false;
  return c.sources.every((path,i)=>events.some((e,index)=>index>copied&&
    e.command==='cat'&&e.ok&&e.target===path+'.copy'&&
    e.output===c.contents[i]));
}
export function loopMistake(
  kind:'intro'|'transfer',result:CommandResult
):boolean{
  if(result.command!=='for')return !result.ok;
  const c=loopCase(kind);
  return !result.loopTrace||result.loopTrace.length!==c.sources.length||
    result.loopTrace.some((step,i)=>!step.ok||step.value!==c.sources[i]||
      step.command!=='cp'||step.target!==c.sources[i]+'.copy'||
      step.refs.filter(ref=>ref==='FILE').length<2);
}

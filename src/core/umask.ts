import type { CommandResult, LinuxState } from './linux.ts';

/** A simulated session umask, not the process-wide or host OS mask. */
export const DEFAULT_UMASK=0o022;
export const sessionUmask=(state:LinuxState):number=>{
  const mask=state.umask;
  return typeof mask==='number' && Number.isInteger(mask) &&
    mask>=0 && mask<=0o777 ? mask : DEFAULT_UMASK;
};
export const umaskOctal=(mask:number):string=>mask.toString(8).padStart(3,'0');
export const newFileMode=(state:LinuxState):number=>0o666 & ~sessionUmask(state);
export const newDirectoryMode=(state:LinuxState):number=>0o777 & ~sessionUmask(state);

export function executeUmask(state:LinuxState,args:readonly string[]):CommandResult {
  const result=(output:string,ok:boolean,next:LinuxState=state,target?:string):CommandResult=>({
    state:next,command:'umask',output,ok,target
  });
  if(args.length===0)return result('0'+umaskOctal(sessionUmask(state)),true,'read');
  if(args.length!==1||!/^0?[0-7]{3}$/.test(args[0]))
    return result('Uzycie: umask [000-777] (trzy cyfry osemkowe)',false);
  const mask=parseInt(args[0],8);
  return result('',true,{...state,umask:mask},umaskOctal(mask));
}

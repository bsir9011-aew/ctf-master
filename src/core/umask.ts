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

/** Grade the *effect of the mask at creation time*, not merely a later chmod.
 * The test only accepts new objects created after setting the intended mask.
 */
export function umaskExerciseCompleted(
  state:LinuxState,events:readonly CommandResult[],
  mask:number,file:string,directory:string
):boolean {
  const expectedFile=0o666 & ~mask;
  const expectedDirectory=0o777 & ~mask;
  if(sessionUmask(state)!==mask ||
     !Object.hasOwn(state.files,file)||!state.dirs.includes(directory) ||
     state.permissions?.[file]!==expectedFile ||
     state.permissions?.[directory]!==expectedDirectory)return false;
  const configured=events.findIndex(r=>r.ok&&r.command==='umask'&&
    r.target===umaskOctal(mask));
  if(configured<0)return false;
  const forbidden=events.some(r=>r.ok&&
    ((r.command==='chmod'&&(r.target===file||r.target===directory)) ||
     (r.command==='touch'&&r.target===file&&
       events.indexOf(r)<configured) ||
     (r.command==='mkdir'&&r.target===directory&&
       events.indexOf(r)<configured)));
  if(forbidden)return false;
  const createdFile=events.slice(configured+1).some(r=>
    r.ok&&r.command==='touch'&&r.target===file&&r.state.permissions?.[file]===expectedFile);
  const createdDir=events.slice(configured+1).some(r=>
    r.ok&&r.command==='mkdir'&&r.target===directory&&r.state.permissions?.[directory]===expectedDirectory);
  return createdFile&&createdDir;
}

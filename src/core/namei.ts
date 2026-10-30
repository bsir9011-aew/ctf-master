import type { CommandResult, LinuxState } from './linux.ts';
import { hasAccess, modeString, ownerNames } from './permissions.ts';

/** A read-only training subset of namei -l.
 * Stops at the first directory without search (x) permission.
 * Does not reveal the names, owners or modes of unreachable descendants.
 */
export function executeNamei(
  state:LinuxState,
  args:readonly string[],
  resolve:(requested:string)=>string
):CommandResult {
  const done=(output:string,ok:boolean,target?:string,blockedAt?:string):CommandResult=>
    ({state,command:'namei',output,ok,target,blockedAt});
  if(args.length!==2||args[0]!=='-l'||!args[1]||args[1].startsWith('-'))
    return done('Uzycie: namei -l SCIEZKA',false);
  const target=resolve(args[1]);
  const components=target.split('/').filter(Boolean);
  const prefixes=['/',...components.map((_,i)=>'/'+components.slice(0,i+1).join('/'))];
  const output:string[]=['f: '+target];
  for(const path of prefixes){
    const exists=state.dirs.includes(path)||Object.hasOwn(state.files,path);
    if(!exists){
      output.push('??? '+(path==='/'?'/':components[prefixes.indexOf(path)-1])+' (No such file or directory)');
      return done(output.join('\n'),false,target);
    }
    const owner=ownerNames(state,path);
    const name=path==='/'?'/':components[prefixes.indexOf(path)-1];
    const isDir=state.dirs.includes(path);
    const blocked=isDir&&!hasAccess(state,path,'x');
    output.push(modeString(state,path)+' '+owner.user+' '+owner.group+' '+name+
      (blocked?'  [BRAK x - przejscie zablokowane]':''));
    if(blocked) return done(output.join('\n'),true,target,path);
  }
  return done(output.join('\n'),true,target);
}

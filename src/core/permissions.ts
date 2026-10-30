import type { LinuxState } from './linux.ts';
import {effectiveGroups, identityOf} from './identity.ts';

export function modeOf(state: LinuxState, path: string): number {
  const value = state.permissions?.[path];
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0o777) return value;
  return state.dirs.includes(path) ? 0o755 : 0o644;
}

export function modeString(state: LinuxState, path: string): string {
  const mode = modeOf(state, path);
  const bits = [0o400, 0o200, 0o100, 0o040, 0o020, 0o010, 0o004, 0o002, 0o001];
  return (state.dirs.includes(path) ? 'd' : '-') +
    bits.map((bit, i) => mode & bit ? 'rwx'[i % 3] : '-').join('');
}

export function modeOctal(state: LinuxState, path: string): string {
  return modeOf(state, path).toString(8).padStart(3, '0');
}

/** Deliberate subset: chmod 600 file, chmod u+r file, chmod go-rwx file. */
export function nextMode(current: number, spec: string): number | null {
  if (/^0?[0-7]{3}$/.test(spec)) return parseInt(spec, 8);
  const match = /^([ugoa]+)([+-])([rwx]+)$/.exec(spec);
  if (!match) return null;
  const [, classes, action, letters] = match;
  let mask = 0;
  const who = classes.includes('a') ? 'ugo' : [...new Set(classes)].join('');
  for (const cls of who) {
    const offset = cls === 'u' ? 6 : cls === 'g' ? 3 : 0;
    for (const letter of letters) mask |= (letter === 'r' ? 4 : letter === 'w' ? 2 : 1) << offset;
  }
  return action === '+' ? (current | mask) : (current & ~mask);
}


/** Numeric UNIX ownership. Historical worlds without metadata belong to player. */
export interface SimOwner { uid:number; gid:number }
export const ownerOf=(state:LinuxState,path:string):SimOwner=>{
  const owner=state.ownership?.[path];
  return owner && Number.isSafeInteger(owner.uid) && Number.isSafeInteger(owner.gid)
    ? owner : {uid:1000,gid:1000};
};

export const ownerNames=(state:LinuxState,path:string):{user:string;group:string}=>{
  const owner=ownerOf(state,path);
  const current=identityOf(state);
  const knownUsers:Record<number,string>={1000:'player',1001:'analyst',2000:'svc'};
  const knownGroups:Record<number,string>={1000:'player',1100:'operators',1200:'audit'};
  const groups=effectiveGroups(current);
  return {
    user:owner.uid===current.uid?current.user:(knownUsers[owner.uid]??String(owner.uid)),
    group:groups.find(g=>g.gid===owner.gid)?.name ??
      knownGroups[owner.gid]??String(owner.gid)
  };
};

/** Only one applicable rwx class controls access: owner, group, or other. */
export function hasAccess(state:LinuxState,path:string,action:'r'|'w'|'x'):boolean{
  const current=identityOf(state);
  const owner=ownerOf(state,path);
  const shift=owner.uid===current.uid?6
    :effectiveGroups(current).some(g=>g.gid===owner.gid)?3:0;
  const bit=action==='r'?4:action==='w'?2:1;
  return !!(modeOf(state,path)&(bit<<shift));
}

const parentOf=(path:string)=>path==='/'?'/':path.slice(0,path.lastIndexOf('/'))||'/';

/** Entering every ancestor requires x; an existing directory itself is not
 * required for stat, but cd and listing it enforce their own permissions. */
export function canTraverse(state:LinuxState,path:string):boolean{
  let ancestor=parentOf(path);
  while(true){
    if(!state.dirs.includes(ancestor)||!hasAccess(state,ancestor,'x'))return false;
    if(ancestor==='/')break;
    ancestor=parentOf(ancestor);
  }
  return true;
}
export const canReadFile=(state:LinuxState,path:string):boolean=>
  canTraverse(state,path)&&hasAccess(state,path,'r');
export const canListDir=(state:LinuxState,path:string):boolean=>
  canTraverse(state,path)&&hasAccess(state,path,'r')&&hasAccess(state,path,'x');
export const canWriteDir=(state:LinuxState,path:string):boolean=>
  canTraverse(state,path)&&hasAccess(state,path,'w')&&hasAccess(state,path,'x');

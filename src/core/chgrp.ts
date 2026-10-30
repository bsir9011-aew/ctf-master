import type {CommandResult, LinuxState} from './linux.ts';
import {effectiveGroups, identityOf} from './identity.ts';
import {canTraverse, ownerOf, modeOf} from './permissions.ts';

/** Linux teaching subset: a file owner may assign one of their own groups.
 * No root, sudo, external users, host filesystem or arbitrary group creation.
 */
export function executeChgrp(
  state:LinuxState,
  args:readonly string[],
  resolve:(value:string)=>string
):CommandResult {
  const done=(output:string,ok:boolean,next=state,target?:string):CommandResult=>({
    command:'chgrp',state:next,output,ok,target
  });
  if(args.length!==2||args.some(a=>!a||a.startsWith('-')))
    return done('Uzycie: chgrp GRUPA PLIK_LUB_KATALOG',false);
  const [requestedGroup,requestedPath]=args;
  const target=resolve(requestedPath);
  const exists=state.dirs.includes(target)||Object.hasOwn(state.files,target);
  if(!exists)return done('chgrp: No such file or directory',false);
  if(!canTraverse(state,target))return done('chgrp: Permission denied (path)',false);
  const current=identityOf(state);
  const originalOwner=ownerOf(state,target);
  if(originalOwner.uid!==current.uid)
    return done('chgrp: Operation not permitted (not file owner)',false);
  const group=effectiveGroups(current).find(g=>g.name===requestedGroup);
  if(!group)return done('chgrp: Operation not permitted (not a member of group)',false);
  const ownership={
    ...state.ownership,
    [target]:{uid:originalOwner.uid,gid:group.gid}
  };
  return done('',true,{...state,ownership},target);
}

interface ShareCase {path:string;user:number;oldGid:number;newGid:number;groupName:string;content:string}
const LAB='/home/player/practice';
const CASES={
  intro:{
    path:LAB+'/shared-report.log',user:1000,oldGid:1000,newGid:1100,
    groupName:'operators',content:'REPORT: daily systems check\n'
  },
  transfer:{
    path:LAB+'/logs/audit-report.log',user:1001,oldGid:1100,newGid:1200,
    groupName:'audit',content:'AUDIT: access review complete\n'
  }
} as const;
export type ShareVariant=keyof typeof CASES;
export const shareCase=(variant:ShareVariant):ShareCase=>CASES[variant];

/** Validate group transfer, not a chmod workaround: same owner, mode and data,
 * plus a later observation showing the effective group.
 */
export function shareCompleted(
  variant:ShareVariant,state:LinuxState,events:readonly CommandResult[]
):boolean {
  const c=CASES[variant];
  const owner=ownerOf(state,c.path);
  if(owner.uid!==c.user||owner.gid!==c.newGid||
     modeOf(state,c.path)!==0o640||state.files[c.path]!==c.content)return false;
  const modified=events.findIndex(r=>r.ok&&r.command==='chgrp'&&
    r.target===c.path&&ownerOf(r.state,c.path).gid===c.newGid);
  if(modified<0)return false;
  return events.slice(modified+1).some(r=>r.ok&&
    (r.command==='stat'||r.command==='ls')&&r.target===c.path&&
    r.output.includes(c.groupName));
}

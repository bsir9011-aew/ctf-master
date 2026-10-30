import type { CommandResult, LinuxState } from './linux.ts';

/** Read-only educational identity. No account switching or host access. */
export interface SimGroup {
  gid:number;
  name:string;
}
export interface SimIdentity {
  uid:number;
  user:string;
  primary:SimGroup;
  supplementary:SimGroup[];
}
const DEFAULT:SimIdentity={
  uid:1000,user:'player',
  primary:{gid:1000,name:'player'},
  supplementary:[{gid:1100,name:'operators'}]
};
export const defaultIdentity=():SimIdentity=>({
  ...DEFAULT,
  primary:{...DEFAULT.primary},
  supplementary:DEFAULT.supplementary.map(group=>({...group}))
});

/** Older localStorage sessions without identity remain valid. */
export function identityOf(state:LinuxState):SimIdentity {
  const value=state.identity;
  if(!value || typeof value.user!=='string' ||
     typeof value.uid!=='number' || !Number.isSafeInteger(value.uid) ||
     !value.primary || typeof value.primary.name!=='string' ||
     !Number.isSafeInteger(value.primary.gid) ||
     !Array.isArray(value.supplementary) ||
     value.supplementary.some(g=>!g || typeof g.name!=='string' ||
       !Number.isSafeInteger(g.gid)))
    return defaultIdentity();
  return value;
}

/** Primary group is always included and repeated groups are removed by GID. */
export function effectiveGroups(identity:SimIdentity):SimGroup[]{
  const groups=[identity.primary,...identity.supplementary];
  const seen=new Set<number>();
  return groups.filter(group=>{
    if(seen.has(group.gid))return false;
    seen.add(group.gid);
    return true;
  });
}

export function executeIdentityCommand(
  state:LinuxState,cmd:'id'|'groups',args:readonly string[]
):CommandResult {
  const done=(output:string,ok=true,target?:string):CommandResult=>({
    state,command:cmd,output,ok,target
  });
  const user=identityOf(state);
  const groups=effectiveGroups(user);
  if(cmd==='groups'){
    if(args.length) return done('Uzycie: groups (tylko biezacy uzytkownik)',false);
    return done(groups.map(g=>g.name).join(' '),true,'group-names');
  }
  if(args.length===0) return done(
    'uid='+user.uid+'('+user.user+') gid='+user.primary.gid+'('+user.primary.name+') '+
    'groups='+groups.map(g=>g.gid+'('+g.name+')').join(','),
    true,'identity'
  );
  if(args.length!==1) return done('Uzycie: id [-u|-un|-g|-gn|-G|-Gn]',false);
  switch(args[0]){
    case '-u':return done(String(user.uid),true,'uid');
    case '-un':
    case '-nu':return done(user.user,true,'username');
    case '-g':return done(String(user.primary.gid),true,'primary-gid');
    case '-gn':
    case '-ng':return done(user.primary.name,true,'primary-name');
    case '-G':return done(groups.map(g=>g.gid).join(' '),true,'group-ids');
    case '-Gn':
    case '-nG':return done(groups.map(g=>g.name).join(' '),true,'group-names');
    default:return done('id: nieobslugiwana opcja. Uzyj man id.',false);
  }
}

import type {CommandResult} from './linux.ts';
import type {LearningStats} from './learning.ts';
import {opsProgress} from './opsRecovery.ts';

export interface AfterActionReport {
  missionId:string;
  commands:number;
  nonzero:number;
  hints:number;
  usedHelp:boolean;
  independent:boolean;
  sources:string[];
  actions:string[];
  hypotheses:string[];
  consequences:string[];
  verification:string;
  transferQuestion:string;
}
export type AfterActionReports=Record<string,AfterActionReport>;
export type MissionReflections=Record<string,string>;

const questions:Record<string,string>={
  'incident-correlation':'Jak sprawdzisz, czy dwa zdarzenia w logach naprawdę mają wspólną przyczynę, a nie tylko zbliżony czas?',
  'incident-hypotheses':'Gdyby log wdrożenia nie zawierał zmiany limitu, jakich danych potrzebowałbyś do odróżnienia awarii bazy od ataku?',
  'incident-response':'Co sprawdzisz, jeśli plik konfiguracyjny jest poprawny, ale po restarcie API nadal zwraca HTTP 503?',
  'operational-recovery':'Co zrobisz, jeśli kolejka działa po naprawie, ale nadal nie można połączyć się przez SSH?',
  'blind-investigation':'Jak rozpoznasz podobną odmowę dostępu, gdy plik ma prawidłowe rwx, a zablokowany jest inny katalog po drodze?'
};
const unique=(items:string[],max=6)=>[...new Set(items)].slice(0,max);
const sourceCommands=new Set(['cat','grep','stat','namei','test','head','tail','journalctl','curl','ping','nslookup','trace','nc']);
const actionCommands=new Set(['chmod','chgrp','cp','mv','mkdir','touch','rm','kill','ip','resolvectl','redirect','systemctl']);

function actionLabel(e:CommandResult):string|null{
  if(!e.ok)return null;
  if(e.command==='systemctl'){
    // Read-only status is an observation, not an intervention.
    if(e.output.includes('Active: ')||e.output.startsWith('Journal'))return null;
    if(/\.service (active|inactive|failed)$/.test(e.output))
      return 'systemctl: '+(e.target??'usługa')+' → '+e.output.split(' ').at(-1);
    return null;
  }
  if(e.command==='conditional') {
    const steps=e.conditionalTrace?.filter(s=>s.executed&&actionCommands.has(s.command??''))??[];
    return steps.length?'warunkowe wykonanie: '+steps.map(s=>s.command+(s.target?' '+s.target:'')).join(', '):null;
  }
  if(!actionCommands.has(e.command))return null;
  return e.command+(e.target?' '+e.target:'');
}

/** Use only actual command results and the learning state at first completion.
 * Never retain full output, nested LinuxState, raw typed commands or fake evidence.
 */
export function buildAfterAction(
  missionId:string,events:readonly CommandResult[],stats:LearningStats,
  verified:boolean
):AfterActionReport|null{
  if(!verified||!events.length)return null;
  const evidence=events.filter(e=>sourceCommands.has(e.command)&&
    e.target&&e.output!=='').map(e=>{
    const status=e.exitCode===0?'ok':'status '+String(e.exitCode??'?');
    return e.command+' · '+e.target+' ('+status+')';
  });
  const actions=events.map(actionLabel).filter((x):x is string=>x!==null);
  const hypotheses=events.filter(e=>e.command==='hypothesis'&&e.ok&&e.target)
    .map(e=>e.target+' / pewność: '+(e.hypothesisConfidence??'nieznana'));
  const consequences=missionId==='operational-recovery'
    ?opsProgress(events.at(-1)!.state,events).sideEffectNotes
    :[];
  // Track a documented excessive grant only if it actually happened in the
  // blind case; an unsuccessful command is not a side effect.
  if(missionId==='blind-investigation'&&events.some(e=>
    e.ok&&e.command==='chmod'&&typeof e.target==='string'&&
    e.target.endsWith('/case21-audit')&&
    ((e.state.permissions?.[e.target]??0)&0o077)!==0))
    consequences.push('W historii wystąpiło poszerzenie uprawnień grupy/innych.');
  const nonzero=events.filter(e=>e.exitCode!==undefined&&e.exitCode!==0).length;
  return {
    missionId,commands:stats.commands,nonzero,
    hints:stats.hints,usedHelp:stats.usedHelp,independent:stats.independent,
    sources:unique(evidence),
    actions:unique(actions),
    hypotheses:unique(hypotheses),
    consequences:unique(consequences),
    verification:'Symulator potwierdził warunek zaliczenia na podstawie stanu i historii działań. To nie jest niezależna analiza rzeczywistego incydentu.',
    transferQuestion:questions[missionId]??'Które dane musiałbyś zebrać, aby rozwiązać podobny problem z innymi nazwami plików i innym punktem awarii?'
  };
}

/** Reject malformed historical snapshots; older sessions simply have no AAR. */
export function restoreAfterActionReports(value:unknown):AfterActionReports{
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const result:AfterActionReports={};
  for(const [id,v] of Object.entries(value).slice(0,100)){
    if(!/^[a-z0-9-]{1,64}$/.test(id)||!v||typeof v!=='object'||Array.isArray(v))continue;
    const x=v as Partial<AfterActionReport>;
    if(x.missionId!==id||typeof x.verification!=='string'||
       typeof x.transferQuestion!=='string')continue;
    const safeNum=(v:unknown,max:number):number=>
      Number.isSafeInteger(v)&&(v as number)>=0?Math.min(v as number,max):0;
    const safeLines=(v:unknown):string[]=>
      Array.isArray(v)?v.filter((x):x is string=>typeof x==='string')
        .slice(0,6).map(x=>x.slice(0,240)):[];
    result[id]={
      missionId:id,commands:safeNum(x.commands,100000),
      nonzero:safeNum(x.nonzero,100000),hints:safeNum(x.hints,3),
      usedHelp:x.usedHelp===true,independent:x.independent===true,
      sources:safeLines(x.sources),actions:safeLines(x.actions),
      hypotheses:safeLines(x.hypotheses),consequences:safeLines(x.consequences),
      verification:x.verification.slice(0,500),
      transferQuestion:x.transferQuestion.slice(0,500)
    };
  }
  return result;
}
export function restoreMissionReflections(value:unknown):MissionReflections{
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const result:MissionReflections={};
  for(const [id,text] of Object.entries(value).slice(0,100)){
    if(/^[a-z0-9-]{1,64}$/.test(id)&&typeof text==='string')
      result[id]=text.slice(0,600);
  }
  return result;
}

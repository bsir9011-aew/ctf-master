import {missions} from './missions.ts';
import {commandLessons,restoreAcademyProgress,type AcademyProgress} from './commandAcademy.ts';
import {restoreCoachMetrics,type AcademyCoachMetrics} from './academyCoach.ts';
import {restoreLearning,type LearningMap} from './learning.ts';
import {restoreReviewHistory,type ReviewHistory} from './review.ts';
import {
  restoreAfterActionReports,restoreMissionReflections,
  type AfterActionReports,type MissionReflections
} from './afterAction.ts';

export const BACKUP_FORMAT='ctf-master-progress';
export const BACKUP_SCHEMA=1;
const MAX_TEXT=350_000;
const ids=new Map(missions.map((m,i)=>[m.id,i]));

export interface BackupMissionData {
  completed:number[];
  learning:LearningMap;
  reviewHistory:ReviewHistory;
  reports:AfterActionReports;
  reflections:MissionReflections;
}
export interface ProgressBackup {
  format:typeof BACKUP_FORMAT;
  schema:typeof BACKUP_SCHEMA;
  createdAt:string;
  missions:string[];
  academy:AcademyProgress;
  coach:AcademyCoachMetrics;
  learning:LearningMap;
  reviewHistory:ReviewHistory;
  reports:AfterActionReports;
  reflections:MissionReflections;
}

const asObject=(value:unknown):Record<string,unknown>|null=>
  value!==null&&typeof value==='object'&&!Array.isArray(value)
    ?value as Record<string,unknown>:null;
const knownIds=(value:unknown):string[]=>
  Array.isArray(value)?[...new Set(value.filter((x):x is string=>
    typeof x==='string'&&ids.has(x)))]:[];
const completedIds=(items:readonly number[])=>[...new Set(
  items.filter(i=>Number.isSafeInteger(i)&&i>=0&&i<missions.length).map(i=>missions[i].id)
)];

export function makeProgressBackup(
  session:BackupMissionData,
  academy:unknown,coach:unknown,
  createdAt='2026-01-01T00:00:00.000Z'
):string{
  const payload:ProgressBackup={
    format:BACKUP_FORMAT,schema:BACKUP_SCHEMA,createdAt,
    missions:completedIds(session.completed),
    academy:restoreAcademyProgress(academy),
    coach:restoreCoachMetrics(coach),
    learning:restoreLearning(session.learning),
    reviewHistory:restoreReviewHistory(session.reviewHistory),
    reports:restoreAfterActionReports(session.reports),
    reflections:restoreMissionReflections(session.reflections)
  };
  return JSON.stringify(payload,null,2);
}

/** Reject unsupported/malformed formats before any storage or state updates.
 * Preserve only known IDs and use existing defensive restorers, not raw JSON.
 */
export function parseProgressBackup(text:string):ProgressBackup {
  if(text.length>MAX_TEXT)throw Error('Kopia jest zbyt duża (limit 350 KB).');
  let raw:unknown;
  try{raw=JSON.parse(text);}catch{throw Error('Nieprawidłowy JSON. Wklej pełny kod kopii.');}
  const data=asObject(raw);
  if(!data||data.format!==BACKUP_FORMAT)
    throw Error('To nie jest kopia postępów CTF Master.');
  if(data.schema!==BACKUP_SCHEMA)
    throw Error('Nieobsługiwany format kopii. Wymagana wersja 1.');
  if(!Array.isArray(data.missions)||!asObject(data.academy)||
     !Array.isArray(asObject(data.academy)?.completed)||
     !Array.isArray(asObject(data.academy)?.mastered))
    throw Error('Brakuje danych o misjach lub Akademii. Nic nie przywrócono.');
  return {
    format:BACKUP_FORMAT,schema:BACKUP_SCHEMA,
    createdAt:typeof data.createdAt==='string'?data.createdAt.slice(0,40):'nieznana',
    missions:knownIds(data.missions),
    academy:restoreAcademyProgress(data.academy),
    coach:restoreCoachMetrics(data.coach),
    learning:restoreLearning(data.learning),
    reviewHistory:restoreReviewHistory(data.reviewHistory),
    reports:restoreAfterActionReports(data.reports),
    reflections:restoreMissionReflections(data.reflections)
  };
}

/** Merge, never remove previously earned completions. File-system worlds and
 * active mission attempts intentionally stay local to the current install.
 */
export function mergeMissionProgress(
  current:BackupMissionData,
  imported:ProgressBackup
):BackupMissionData {
  const completed=[...new Set([
    ...current.completed.filter(i=>Number.isSafeInteger(i)&&i>=0&&i<missions.length),
    ...imported.missions.map(id=>ids.get(id)!).filter(i=>i!==undefined)
  ])].sort((a,b)=>a-b);
  const learning=restoreLearning(current.learning);
  for(const [id,x] of Object.entries(imported.learning)){
    if(!ids.has(id))continue;
    const old=learning[id];
    learning[id]=old?{
      commands:Math.max(old.commands,x.commands),
      errors:Math.max(old.errors,x.errors),
      hints:Math.max(old.hints,x.hints),
      usedHelp:old.usedHelp||x.usedHelp,
      independent:old.independent||x.independent
    }:x;
  }
  const reviewHistory=restoreReviewHistory(current.reviewHistory);
  for(const [id,x] of Object.entries(imported.reviewHistory)){
    const old=reviewHistory[id as keyof ReviewHistory];
    reviewHistory[id as keyof ReviewHistory]=old?{
      attempts:Math.max(old.attempts,x.attempts),
      streak:Math.max(old.streak,x.streak)
    }:x;
  }
  const reports=restoreAfterActionReports(current.reports);
  for(const [id,report] of Object.entries(imported.reports))
    if(ids.has(id)&&!reports[id])reports[id]=report;
  const reflections=restoreMissionReflections(current.reflections);
  for(const [id,entry] of Object.entries(imported.reflections))
    if(ids.has(id)&&!(id in reflections))reflections[id]=entry;
  return {completed,learning,reviewHistory,reports,reflections};
}
export function mergeAcademyProgress(
  current:unknown,imported:ProgressBackup
):AcademyProgress {
  const old=restoreAcademyProgress(current),restored=imported.academy;
  const all=new Set([...old.completed,...restored.completed]);
  const mastered=new Set([...old.mastered,...restored.mastered]);
  return restoreAcademyProgress({
    completed:[...all],mastered:[...mastered],
    selectedId:restored.selectedId??old.selectedId??commandLessons[0].id
  });
}
export function mergeCoachProgress(current:unknown,imported:ProgressBackup):AcademyCoachMetrics {
  const merged=restoreCoachMetrics(current);
  for(const [id,x] of Object.entries(imported.coach)){
    const old=merged[id];
    merged[id]={
      errors:Math.max(x.errors,old?.errors??0),
      help:Math.max(x.help,old?.help??0)
    };
  }
  return restoreCoachMetrics(merged);
}

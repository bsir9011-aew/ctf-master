import type { CommandResult, LinuxState } from './linux.ts';

export type InvestigationVariant = 'intro' | 'transfer';

interface IncidentCase {
  source: string;
  archive: string;
  evidence: string;
  files: Readonly<Record<string,string>>;
}

const LAB='/home/player/practice';
const CASES:Record<InvestigationVariant,IncidentCase>={
  intro:{
    source:LAB+'/logs/edge.log',
    archive:LAB+'/evidence.log',
    evidence:'HTTP 502 upstream timeout',
    files:{
      [LAB+'/logs/edge.log']:
        '02:10 INFO deploy started\n02:13 INFO proxy ready\n02:14 ERROR HTTP 502 upstream timeout\n02:15 WARN reconnect retry\n',
      [LAB+'/logs/worker.log']:
        '02:12 INFO tasks processed\n02:14 WARN queue lag 1s\n02:15 INFO tasks processed\n',
      [LAB+'/logs/session.log']:
        '02:12 INFO session opened\n02:14 INFO session refreshed\n'
    }
  },
  transfer:{
    source:LAB+'/logs/identity.log',
    archive:LAB+'/incident-evidence.log',
    evidence:'LOGIN FAIL repeated',
    files:{
      [LAB+'/logs/identity.log']:
        '04:10 INFO account active\n04:12 ALERT LOGIN FAIL repeated\n04:13 WARN source 198.51.100.31\n',
      [LAB+'/logs/payments.log']:
        '04:11 INFO payment settled\n04:12 WARN database slow\n',
      [LAB+'/logs/scheduler.log']:
        '04:10 INFO task complete\n04:12 INFO next job queued\n'
    }
  }
};

/** Add independent virtual forensic artifacts without modifying the base system. */
export function investigationFiles(kind:InvestigationVariant):Record<string,string>{
  return {...CASES[kind].files};
}

export interface InvestigationStatus {
  evidenceFound:boolean;
  evidencePreserved:boolean;
  completed:boolean;
}

/**
 * Reading the actual source must happen before the copy operation.
 * Copying a decoy, reading only a copied file, or changing original
 * evidence cannot satisfy the objective.
 */
export function investigationStatus(
  kind:InvestigationVariant,state:LinuxState,events:readonly CommandResult[]
):InvestigationStatus {
  const data=CASES[kind];
  const original=data.files[data.source];
  const readAt=events.findIndex(event=>
    event.ok &&
    ['cat','grep','head','tail','pipeline'].includes(event.command) &&
    event.target===data.source &&
    event.output.includes(data.evidence)
  );
  const evidenceFound=readAt>=0;
  const copiedAfterRead=events.some((event,index)=>
    evidenceFound && index>readAt && event.ok &&
    event.command==='cp' && event.target===data.archive);
  const originalUntouched=state.files[data.source]===original;
  const decoysUntouched=Object.entries(data.files).every(([path,body])=>state.files[path]===body);
  const evidencePreserved=copiedAfterRead && originalUntouched && decoysUntouched &&
    Object.hasOwn(state.files,data.archive) &&
    state.files[data.archive]===original;
  return {
    evidenceFound,
    evidencePreserved,
    completed:evidenceFound && evidencePreserved
  };
}

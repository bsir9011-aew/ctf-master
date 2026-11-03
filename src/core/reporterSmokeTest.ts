import {executeLinux,type LinuxState} from './linux.ts';
import type {WorkshopResult} from './bashWorkshop.ts';
import {previewReporterFix,type ReporterFixPreview} from './reporterConfigRepair.ts';
import {verifyReporterStart,type ReporterStartVerification} from './reporterControlledStart.ts';
import {REPORTER_CONFIG_PATH} from './reporterConfigFixture.ts';

export type ReporterSmokeConclusion=''|'missing-output-dir'|'restart-again'|'report-written'|'change-permissions';
export interface ReporterSmokeResult {
  attempted:boolean;
  command:string;
  outputPath:string;
  readCode:0|1;
  writeCode:0|1;
  writeMessage:string;
  directoryExists:boolean;
  conclusion:Exclude<ReporterSmokeConclusion,''>;
  message:string;
  state:LinuxState;
}
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const SOURCE='/home/player/practice/.reporter-smoke-input.csv';
const CONTENT='id,total\n101,42\n';
const OUTNAME='ctf-smoke-report.csv';

/** A disposable virtual write attempt, not a production export.
 * After systemctl active, it exercises the configured output path via the
 * existing Linux redirection simulator; the actual exit code is evidence.
 */
export function runReporterSmoke(
  incident:Pick<WorkshopResult,'completed'|'steps'|'state'>,
  fix:ReporterFixPreview|null,
  start:ReporterStartVerification|null
):ReporterSmokeResult|null {
  if(!fix?.verified||!start?.verified)return null;
  const expectedFix=previewReporterFix(incident,'rename-directive');
  const expectedStart=verifyReporterStart(incident,expectedFix);
  if(!expectedFix||!expectedStart?.verified||
     !same(expectedFix,fix)||!same(expectedStart,start))return null;

  const config=executeLinux(start.state,'cat '+REPORTER_CONFIG_PATH);
  if(!config.ok||config.output!==start.state.files[REPORTER_CONFIG_PATH])return null;
  const lines=config.output.split('\n').filter(line=>line&&!line.startsWith('#'));
  const keys=lines.map(line=>line.split('=')[0]);
  if(keys.length!==3||new Set(keys).size!==3||
     !['format','output_path','retry_limit'].every(k=>keys.includes(k)))return null;
  const values=new Map(lines.map(line=>{
    const index=line.indexOf('=');
    return [line.slice(0,index),line.slice(index+1)];
  }));
  if(values.get('format')!=='csv'||values.get('retry_limit')!=='3')return null;
  const outputDir=values.get('output_path');
  if(!outputDir||!/^\/[a-zA-Z0-9/_-]+$/.test(outputDir)||outputDir==='/')return null;
  const outputPath=outputDir.replace(/\/$/,'')+'/'+OUTNAME;
  if(Object.hasOwn(start.state.files,SOURCE)||start.state.dirs.includes(SOURCE)||
     Object.hasOwn(start.state.files,outputPath)||start.state.dirs.includes(outputPath))return null;
  const reporter=start.state.services?.reporter;
  const process=start.state.processes?.find(p=>p.service==='reporter');
  if(reporter?.status!=='active'||!process?.running||process.pid!==reporter.pid)return null;

  // One in-memory sample input - never present in the Academy.
  const sandbox:LinuxState={...start.state,
    files:{...start.state.files,[SOURCE]:CONTENT},
    permissions:{...start.state.permissions,[SOURCE]:0o600},
    ownership:{...start.state.ownership,[SOURCE]:{uid:1000,gid:1000}}
  };
  const command='cat '+SOURCE+' > '+outputPath;
  const before=executeLinux(sandbox,'cat '+SOURCE);
  if(!before.ok||before.output!==CONTENT)return null;
  const written=executeLinux(sandbox,command);
  const directoryExists=sandbox.dirs.includes(outputDir);
  const succeeded=written.ok&&written.state.files[outputPath]===CONTENT&&
    executeLinux(written.state,'cat '+outputPath).output===CONTENT;
  const blocked=!directoryExists&&!written.ok&&
    written.output.includes('katalog docelowy nie istnieje')&&
    !Object.hasOwn(written.state.files,outputPath);
  if(!succeeded&&!blocked)return null;

  const restBefore={...sandbox};
  const restAfter={...written.state};
  delete restBefore.lastExitCode;delete restAfter.lastExitCode;
  if(succeeded){
    restAfter.files={...written.state.files};
    delete restAfter.files[outputPath];
    restAfter.permissions={...written.state.permissions};
    delete restAfter.permissions[outputPath];
    restAfter.ownership={...written.state.ownership};
    delete restAfter.ownership[outputPath];
  }
  if(!same(restBefore,restAfter))return null;

  const conclusion:Exclude<ReporterSmokeConclusion,''>=
    succeeded?'report-written':'missing-output-dir';
  return {
    attempted:true,command,outputPath,directoryExists,
    readCode:0,writeCode:succeeded?0:1,
    writeMessage:succeeded?'Zapis próbki się powiódł.':written.output,
    conclusion,
    message:succeeded?
      'Próbny zapis CSV i ponowny odczyt przeszły w wirtualnym świecie. To test próbki, nie gwarancja stabilności.':
      'Reporter jest active, ale wirtualny zapis próbnego CSV nie powiódł się: brak katalogu output_path. Sama dostępność procesu nie wystarcza.',
    state:written.state
  };
}
export function gradeReporterSmoke(
  report:ReporterSmokeResult|null,
  selected:ReporterSmokeConclusion
):{matched:boolean|null;message:string}|null{
  if(!selected)return null;
  if(!report?.attempted)return {
    matched:null,message:'Najpierw uruchom próbny zapis i zbierz jego faktyczny wynik.'
  };
  if(selected!==report.conclusion)return {
    matched:false,message:'Porównaj kod zapisu z istnieniem katalogu docelowego. Nie utożsamiaj active ze sprawnym eksportem.'
  };
  return {
    matched:true,message:report.conclusion==='missing-output-dir'?
      'Trafnie: brak katalogu docelowego blokuje zapis. Następnie sprawdź bezpieczny sposób jego przygotowania.':
      'Trafnie: próbny zapis i odczyt się powiodły. Nadal potrzebne jest monitorowanie produkcyjne.'
  };
}

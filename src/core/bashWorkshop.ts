import {createAcademyState} from './commandAcademy.ts';
import {executeLinux,type CommandResult,type LinuxState} from './linux.ts';
import {parseConditionals} from './conditionals.ts';
import {parseForLoop} from './forLoop.ts';
import {scanShell} from './shellSyntax.ts';
import {workshopSourceLines,type SourceLine} from './workshopSourceLines.ts';
import {type WorkshopId} from './workshopScenarios.ts';
export {WORKSHOP_DEFAULT} from './workshopScenarios.ts';

export const WORKSHOP_MAX_LINES=4;
export const WORKSHOP_MAX_CHARS=700;
const SOURCES=['/home/player/practice/events.log','/home/player/practice/alerts.log'];
const COPIES=SOURCES.map(path=>path+'.copy');
const EXPECTED_LOG='/home/player/practice/manual.log';
const MISSING_LOG='/home/player/practice/missing.log';
const LOCKED_LOG='/home/player/practice/checks/locked.log';
const diagnostics={
  diagnosis:{
    checks:[{flag:'-f',target:EXPECTED_LOG,code:0},{flag:'-f',target:MISSING_LOG,code:1}],
    operator:'&&',status:'1',
    incomplete:'Zdiagnozuj dwa logi jedną linią: test -f dla istniejącego manual.log, następnie && test -f dla brakującego missing.log. Użyj $BASE.',
    completed:'Zaliczone: manual.log istnieje, missing.log nie istnieje, a echo $? potwierdziło status 1. Kod 1 to wynik testu, nie awaria terminala.'
  },
  permissions:{
    checks:[{flag:'-f',target:LOCKED_LOG,code:0},{flag:'-r',target:LOCKED_LOG,code:1}],
    operator:'&&',status:'1',
    incomplete:'Sprawdź ten sam plik checks/locked.log: najpierw test -f (istnieje), następnie && test -r (brak prawa odczytu). Użyj $BASE.',
    completed:'Zaliczone: locked.log istnieje (test -f → 0), ale nie masz prawa go czytać (test -r → 1). Echo $? potwierdziło wynik 1, bez modyfikowania uprawnień.'
  },
  fallback:{
    checks:[{flag:'-f',target:MISSING_LOG,code:1},{flag:'-f',target:EXPECTED_LOG,code:0}],
    operator:'||',status:'0',
    incomplete:'Najpierw sprawdź missing.log (wynik 1). Następnie użyj ||, aby uruchomić test istniejącego manual.log (wynik 0). Obie ścieżki przez $BASE.',
    completed:'Zaliczone: missing.log nie istnieje (1), więc operator || uruchomił sprawdzanie manual.log (0). echo $? pokazało 0: plan awaryjny zadziałał.'
  }
} as const;

export interface WorkshopStep {
  line:number;
  command:string;
  exitCode:number;
  output:string;
  variables:string[];
  changedFiles:string[];
  iterations:number;
  skipped:number;
  checks:{command:string;operator?:'&&'|'||';executed:boolean;exitCode?:number}[];
}
export interface WorkshopResult {
  completed:boolean;
  feedback:string;
  steps:WorkshopStep[];
  /** Physical, one-based editor line that needs attention, when identifiable. */
  errorLine?:number;
  /** Returned only for deterministic testing; never execute on the host. */
  state:LinuxState;
}

const error=(feedback:string,state:LinuxState,steps:WorkshopStep[]=[],errorLine?:number):WorkshopResult=>
  ({completed:false,feedback,steps,state,errorLine});
const wordsOnly=(raw:string):string[]|null=>{
  const tokens=scanShell(raw);
  if(!tokens||!tokens.length||tokens.some(t=>t.kind!=='word'))return null;
  return tokens.map(t=>t.kind==='word'?t.value:'');
};

/** Strict preflight: only assignment, one bounded for/cp and test predicates.
 * The entire program is checked before executing ANY file-changing command.
 */
function preflight(lines:readonly SourceLine[],seed:LinuxState,scenario:WorkshopId):{feedback:string;line:number}|null{
  let simulated=seed;
  for(let i=0;i<lines.length;i++){
    const {raw:line,line:number}=lines[i];
    const fail=(feedback:string)=>({feedback:'Linia '+number+': '+feedback,line:number});
    if(line.length>240)return fail('za długa (limit 240 znaków).');
    if(/^for(?:\s|$)/u.test(line)){
      if(scenario!=='backup')return fail('w diagnozie użyj test -f / test -r i echo $?, nie pętli.');
      const loop=parseForLoop(simulated,line);
      if(!loop)return fail('sprawdź składnię for ...; do cp ...; done.');
      const body=wordsOnly(loop.body);
      if(!body||body.length!==3||body[0]!=='cp')
        return fail('w pętli dozwolone jest tylko jedno cp ŹRÓDŁO CEL.');
      continue;
    }
    const segments=parseConditionals(line);
    if(segments===null)return fail('niepełny warunek && lub ||.');
    if(segments){
      if(segments.some(part=>{
        const w=wordsOnly(part.raw);
        return !w||w.length!==3||w[0]!=='test'||
          (scenario==='permissions'?!['-f','-r'].includes(w[1]):w[1]!=='-f');
      }))return fail(scenario==='permissions'?'użyj warunków test -f i test -r połączonych && lub ||.':'użyj warunków test -f połączonych && lub ||.');
      continue;
    }
    const words=wordsOnly(line);
    if(!words)return fail('nieobsługiwana składnia.');
    if(words.length===1&&/^[A-Za-z_][A-Za-z0-9_]*=.*/su.test(words[0])){
      const result=executeLinux(simulated,line);
      if(!result.ok)return fail(result.output);
      simulated=result.state;
      continue;
    }
    if(words.length===3&&words[0]==='test'&&
      (scenario==='permissions'?['-f','-r'].includes(words[1]):words[1]==='-f'))continue;
    if(scenario!=='backup'&&/^echo\s+\$\?$/u.test(line))continue;
    return fail(scenario==='permissions'?'dozwolone są przypisania, test -f, test -r i echo $?.':'dozwolone są przypisania, for z cp i test -f.');
  }
  return null;
}

/** Rebuild world per run: no stale files from earlier attempts can make a bad
 * script appear successful. Never accept scripts, paths, or shell on the host.
 */
export function runWorkshop(script:string,scenario:WorkshopId='backup'):WorkshopResult {
  const initial=createAcademyState();
  if(script.length>WORKSHOP_MAX_CHARS)
    return error('Skrypt jest za długi (maksymalnie 700 znaków).',initial);
  const lines=workshopSourceLines(script);
  if(!lines.length)return error('Wpisz krótki skrypt i uruchom go.',initial);
  if(lines.length>WORKSHOP_MAX_LINES)
    return error('Maksymalnie 4 niepuste linie. Nie rozbudowuj tego zadania.',initial,[],lines[WORKSHOP_MAX_LINES].line);
  const invalid=preflight(lines,initial,scenario);
  if(invalid)return error(invalid.feedback,initial,[],invalid.line);

  let state=initial;
  const events:CommandResult[]=[];
  const steps:WorkshopStep[]=[];
  for(let index=0;index<lines.length;index++){
    const before=state;
    const result=executeLinux(state,lines[index].raw);
    state=result.state;
    events.push(result);
    const changedFiles=Object.keys(state.files).filter(path=>before.files[path]!==state.files[path]);
    steps.push({
      line:lines[index].line,command:result.command,exitCode:result.exitCode??(result.ok?0:1),
      output:result.output.slice(0,250),
      variables:Object.keys(state.variables??{}).filter(key=>
        before.variables?.[key]!==state.variables?.[key]).slice(0,5)
        .map(key=>key+'='+state.variables?.[key]),
      changedFiles:changedFiles.slice(0,5).map(path=>path.replace('/home/player/','~/')),
      iterations:result.loopTrace?.length??0,
      skipped:result.conditionalTrace?.filter(s=>!s.executed).length??0,
      checks:(result.conditionalTrace??[]).map(part=>({
        command:part.raw.slice(0,120),operator:part.operator,executed:part.executed,
        exitCode:part.exitCode
      }))
    });
    // A non-zero test is the evidence to observe in scenario 02, not
    // automatically a script failure. Still reject any other failed command.
    const diagnosticTest=scenario!=='backup'&&result.command==='conditional'&&
      result.conditionalTrace?.every(part=>part.command==='test'&&
        (scenario==='permissions'?['-f','-r'].includes(part.testFlag??''):part.testFlag==='-f'));
    if(!result.ok&&!diagnosticTest)return error('Linia '+lines[index].line+': '+(result.output||'polecenie zakończyło się błędem.'),state,steps,lines[index].line);
  }

  if(state.variables?.BASE!=='~/practice')
    return error('Ustaw BASE=~/practice. Ta zmienna określa katalog logów.',state,steps,
      lines.find(x=>/^BASE=/.test(x.raw))?.line);
  if(scenario!=='backup'){
    const config=diagnostics[scenario];
    const position=events.findIndex(e=>e.command==='conditional');
    const checked=position>=0?events[position].conditionalTrace:undefined;
    const valid=checked?.length===2&&checked.every((part,i)=>
      part.executed&&part.command==='test'&&
      part.operator===(i===0?undefined:config.operator)&&
      part.testFlag===config.checks[i].flag&&part.target===config.checks[i].target&&
      part.exitCode===config.checks[i].code&&/\$\{?BASE\}?/.test(part.raw));
    if(!valid)return error(config.incomplete,state,steps,
      lines.find(x=>x.raw.startsWith('test '))?.line);
    const status=events[position+1];
    if(!status||status.command!=='echo'||status.target!=='previous-exit'||
       status.output!==config.status||position!==1||events.length!==3)
      return error('Po dwóch testach odczytaj ich ostatni kod przez echo $?. Oczekiwany wynik: '+config.status+'.',state,steps,
        lines.find(x=>x.raw.startsWith('echo '))?.line);
    if(Object.keys(state.files).some(path=>state.files[path]!==initial.files[path])||
       Object.keys(initial.files).some(path=>state.files[path]!==initial.files[path]))
      return error('Diagnoza nie powinna modyfikować plików.',state,steps);
    return {completed:true,
      feedback:config.completed,
      steps,state};
  }
  if(!lines.some(item=>item.raw.startsWith('for ')&&/\$\{?BASE\}?/.test(item.raw)))
    return error('W nagłówku pętli odwołaj się do $BASE zamiast wpisywać ścieżki ponownie.',state,steps,
      lines.find(x=>x.raw.startsWith('for '))?.line);
  const loop=events.find(x=>x.command==='for'&&x.loopTrace?.length===2);
  if(!loop||!loop.loopTrace?.every((step,i)=>step.ok&&
    step.command==='cp'&&step.target===COPIES[i]&&
    step.refs.filter(x=>x==='FILE').length>=2))
    return error('Sprawdź pętlę: jedna operacja cp powinna utworzyć osobną kopię każdego z dwóch logów.',state,steps,
      lines.find(x=>x.raw.startsWith('for '))?.line);

  if(SOURCES.some((path,i)=>state.files[path]!==initial.files[path]||
     state.files[COPIES[i]]!==initial.files[path]))
    return error('Kopie nie zgadzają się ze źródłami. Sprawdź wartości zmiennej FILE.',state,steps,
      lines.find(x=>x.raw.startsWith('for '))?.line);

  const verified=events.some(e=>e.command==='conditional'&&
    e.conditionalTrace?.length===2&&
    e.conditionalTrace.every((part,i)=>part.executed&&part.command==='test'&&
      part.testFlag==='-f'&&part.target===COPIES[i]&&part.exitCode===0));
  if(!verified)return error('Kopie powstały. Dodaj na końcu kontrolę obu plików przez test -f ... && test -f ...',state,steps,
    lines.find(x=>x.raw.startsWith('test '))?.line);
  return {completed:true,feedback:'Zaliczone: dwie kopie utworzone i sprawdzone. Oryginały pozostały bez zmian.',steps,state};
}

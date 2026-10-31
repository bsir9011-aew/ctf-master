import {createAcademyState} from './commandAcademy.ts';
import {executeLinux,type CommandResult,type LinuxState} from './linux.ts';
import {parseConditionals} from './conditionals.ts';
import {parseForLoop} from './forLoop.ts';
import {scanShell} from './shellSyntax.ts';

export const WORKSHOP_DEFAULT='BASE=~/practice\nfor FILE in ...; do ...; done\ntest -f ... && test -f ...';
export const WORKSHOP_MAX_LINES=4;
export const WORKSHOP_MAX_CHARS=700;
const SOURCES=['/home/player/practice/events.log','/home/player/practice/alerts.log'];
const COPIES=SOURCES.map(path=>path+'.copy');

export interface WorkshopStep {
  line:number;
  command:string;
  exitCode:number;
  output:string;
  variables:string[];
  changedFiles:string[];
  iterations:number;
  skipped:number;
}
export interface WorkshopResult {
  completed:boolean;
  feedback:string;
  steps:WorkshopStep[];
  /** Returned only for deterministic testing; never execute on the host. */
  state:LinuxState;
}

const error=(feedback:string,state:LinuxState,steps:WorkshopStep[]=[]):WorkshopResult=>
  ({completed:false,feedback,steps,state});
const wordsOnly=(raw:string):string[]|null=>{
  const tokens=scanShell(raw);
  if(!tokens||!tokens.length||tokens.some(t=>t.kind!=='word'))return null;
  return tokens.map(t=>t.value);
};

/** Strict preflight: only assignment, one bounded for/cp and test predicates.
 * The entire program is checked before executing ANY file-changing command.
 */
function preflight(lines:readonly string[],seed:LinuxState):string|null{
  let simulated=seed;
  for(let i=0;i<lines.length;i++){
    const line=lines[i],number=i+1;
    if(line.length>240)return 'Linia '+number+': za długa (limit 240 znaków).';
    if(/^for(?:\s|$)/u.test(line)){
      const loop=parseForLoop(simulated,line);
      if(!loop)return 'Linia '+number+': sprawdź składnię for ...; do cp ...; done.';
      const body=wordsOnly(loop.body);
      if(!body||body.length!==3||body[0]!=='cp')
        return 'Linia '+number+': w pętli dozwolone jest tylko jedno cp ŹRÓDŁO CEL.';
      continue;
    }
    const segments=parseConditionals(line);
    if(segments===null)return 'Linia '+number+': niepełny warunek && lub ||.';
    if(segments){
      if(segments.some(part=>{
        const w=wordsOnly(part.raw);
        return !w||w.length!==3||w[0]!=='test'||w[1]!=='-f';
      }))return 'Linia '+number+': użyj warunków test -f połączonych && lub ||.';
      continue;
    }
    const words=wordsOnly(line);
    if(!words)return 'Linia '+number+': nieobsługiwana składnia.';
    if(words.length===1&&/^[A-Za-z_][A-Za-z0-9_]*=.*/su.test(words[0])){
      const result=executeLinux(simulated,line);
      if(!result.ok)return 'Linia '+number+': '+result.output;
      simulated=result.state;
      continue;
    }
    if(words.length===3&&words[0]==='test'&&words[1]==='-f')continue;
    return 'Linia '+number+': dozwolone są przypisania, for z cp i test -f.';
  }
  return null;
}

/** Rebuild world per run: no stale files from earlier attempts can make a bad
 * script appear successful. Never accept scripts, paths, or shell on the host.
 */
export function runWorkshop(script:string):WorkshopResult {
  const initial=createAcademyState();
  if(script.length>WORKSHOP_MAX_CHARS)
    return error('Skrypt jest za długi (maksymalnie 700 znaków).',initial);
  const lines=script.replace(/\r\n/g,'\n').split('\n').map(x=>x.trim()).filter(Boolean);
  if(!lines.length)return error('Wpisz krótki skrypt i uruchom go.',initial);
  if(lines.length>WORKSHOP_MAX_LINES)
    return error('Maksymalnie 4 niepuste linie. Nie rozbudowuj tego zadania.',initial);
  const invalid=preflight(lines,initial);
  if(invalid)return error(invalid,initial);

  let state=initial;
  const events:CommandResult[]=[];
  const steps:WorkshopStep[]=[];
  for(let index=0;index<lines.length;index++){
    const before=state;
    const result=executeLinux(state,lines[index]);
    state=result.state;
    events.push(result);
    const changedFiles=Object.keys(state.files).filter(path=>before.files[path]!==state.files[path]);
    steps.push({
      line:index+1,command:result.command,exitCode:result.exitCode??(result.ok?0:1),
      output:result.output.slice(0,250),
      variables:Object.keys(state.variables??{}).filter(key=>
        before.variables?.[key]!==state.variables?.[key]).slice(0,5)
        .map(key=>key+'='+state.variables?.[key]),
      changedFiles:changedFiles.slice(0,5).map(path=>path.replace('/home/player/','~/')),
      iterations:result.loopTrace?.length??0,
      skipped:result.conditionalTrace?.filter(s=>!s.executed).length??0
    });
    if(!result.ok)return error('Linia '+(index+1)+': '+(result.output||'polecenie zakończyło się błędem.'),state,steps);
  }

  if(state.variables?.BASE!=='~/practice')
    return error('Ustaw BASE=~/practice. Ta zmienna określa katalog logów.',state,steps);
  if(!lines.some(line=>line.startsWith('for ')&&/\$\{?BASE\}?/.test(line)))
    return error('W nagłówku pętli odwołaj się do $BASE zamiast wpisywać ścieżki ponownie.',state,steps);
  const loop=events.find(x=>x.command==='for'&&x.loopTrace?.length===2);
  if(!loop||!loop.loopTrace?.every((step,i)=>step.ok&&
    step.command==='cp'&&step.target===COPIES[i]&&
    step.refs.filter(x=>x==='FILE').length>=2))
    return error('Sprawdź pętlę: jedna operacja cp powinna utworzyć osobną kopię każdego z dwóch logów.',state,steps);

  if(SOURCES.some((path,i)=>state.files[path]!==initial.files[path]||
     state.files[COPIES[i]]!==initial.files[path]))
    return error('Kopie nie zgadzają się ze źródłami. Sprawdź wartości zmiennej FILE.',state,steps);

  const verified=events.some(e=>e.command==='conditional'&&
    e.conditionalTrace?.length===2&&
    e.conditionalTrace.every((part,i)=>part.executed&&part.command==='test'&&
      part.testFlag==='-f'&&part.target===COPIES[i]&&part.exitCode===0));
  if(!verified)return error('Kopie powstały. Dodaj na końcu kontrolę obu plików przez test -f ... && test -f ...',state,steps);
  return {completed:true,feedback:'Zaliczone: dwie kopie utworzone i sprawdzone. Oryginały pozostały bez zmian.',steps,state};
}

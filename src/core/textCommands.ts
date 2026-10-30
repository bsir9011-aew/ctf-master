import type { CommandResult, LinuxState } from './linux.ts';
import { modeOf } from './permissions.ts';

export type TextCommand = 'head' | 'tail' | 'wc' | 'sort' | 'uniq';
const TEXT_COMMANDS:readonly TextCommand[]=['head','tail','wc','sort','uniq'];
export function isTextCommand(value:string):value is TextCommand {
  return TEXT_COMMANDS.some(cmd=>cmd===value);
}
const displayLines=(value:string):string[] =>
  value.length===0?[]:value.replace(/\n$/,'').split('\n');

export function executeTextCommand(
  state:LinuxState,
  command:TextCommand,
  args:string[],
  pathOf:(raw:string)=>string
):CommandResult {
  const done=(output:string,ok=true,target?:string):CommandResult=>({
    output,ok,state,command,target
  });
  let requested:string|undefined;
  let limit=10;
  let wcFlag:string|null=null;

  if(command==='head'||command==='tail') {
    if(args.length===1) requested=args[0];
    else if(args.length===3&&args[0]==='-n') {
      const n=args[1];
      if(!/^\d+$/.test(n)||Number(n)<1||Number(n)>100)
        return done(command+': -n wymaga liczby calkowitej 1-100',false);
      limit=Number(n);requested=args[2];
    } else return done('Uzycie: '+command+' [-n LICZBA] PLIK',false);
  } else if(command==='wc') {
    if(args.length===1) requested=args[0];
    else if(args.length===2&&['-l','-w','-c'].includes(args[0])){
      wcFlag=args[0];requested=args[1];
    } else return done('Uzycie: wc [-l|-w|-c] PLIK',false);
  } else {
    if(args.length!==1) return done('Uzycie: '+command+' PLIK (bez potokow)',false);
    requested=args[0];
  }
  if(!requested||requested.startsWith('-'))
    return done('Uzycie: '+command+' PLIK',false);
  const path=pathOf(requested);
  if(!Object.hasOwn(state.files,path))
    return done(command+': '+requested+': No such file',false);
  if(!(modeOf(state,path)&0o400))
    return done(command+': '+requested+': Permission denied',false);
  const content=state.files[path];
  const lines=displayLines(content);

  if(command==='head') return done(lines.slice(0,limit).join('\n'),true,path);
  if(command==='tail') return done(lines.slice(-limit).join('\n'),true,path);
  if(command==='sort') return done([...lines].sort().join('\n'),true,path);
  if(command==='uniq') return done(lines.filter((line,i)=>i===0||line!==lines[i-1]).join('\n'),true,path);

  // wc -l counts newline characters, not logical rows. All teaching fixtures
  // have trailing newlines so students see familiar line counts.
  const lineCount=(content.match(/\n/g)??[]).length;
  const wordCount=content.trim()===''?0:content.trim().split(/\s+/u).length;
  const byteCount=new TextEncoder().encode(content).length;
  const result=wcFlag==='-l'?String(lineCount):
    wcFlag==='-w'?String(wordCount):
      wcFlag==='-c'?String(byteCount):
        [lineCount,wordCount,byteCount].join(' ');
  return done(result,true,path);
}

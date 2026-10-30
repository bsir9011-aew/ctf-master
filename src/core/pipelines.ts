import type { CommandResult, LinuxState } from './linux.ts';

/** Split only pipes outside single or double quotes. No shell execution or eval. */
export function splitPipeline(raw:string):string[]|null {
  const sections:string[]=[];
  let quote:"'"|'"'|null=null;
  let part='';
  for(const char of raw) {
    if(char==="'"||char==='"') {
      if(quote===null) quote=char;
      else if(quote===char) quote=null;
      part+=char;
    } else if(char==='|'&&quote===null) {
      if(!part.trim()) return null;
      sections.push(part.trim());
      part='';
    } else part+=char;
  }
  if(quote!==null||!part.trim()) return null;
  sections.push(part.trim());
  return sections;
}
const FIRST=new Set(['cat','grep','head','tail','sort','uniq']);
const NEXT=new Set(['grep','sort','uniq','head','tail','wc']);
export const PIPELINE_LIMIT=5;

const asLines=(stream:string):string[] =>
  !stream ? [] : stream.replace(/\n$/,'').split('\n');
const fromLines=(lines:readonly string[]):string=>lines.length?lines.join('\n')+'\n':'';
const countWords=(s:string)=>s.trim()===''?0:s.trim().split(/\s+/u).length;

export function executePipeline(
  state:LinuxState,
  parts:readonly string[],
  tokenize:(raw:string)=>string[]|null,
  runReadOnly:(raw:string)=>CommandResult
):CommandResult {
  const stages:string[]=[];
  const failed=(reason:string):CommandResult=>({
    state,output:'potok: '+reason,ok:false,command:'pipeline',
    stages:[...stages]
  });
  if(parts.length<2||parts.length>PIPELINE_LIMIT) return failed('dozwolone 2-5 etapow');
  const parsed=parts.map(tokenize);
  if(parsed.some(args=>!args||!args.length)) return failed('niepoprawne cytowanie lub puste polecenie');
  const commands=parsed as string[][];
  if(!FIRST.has(commands[0][0])) return failed('poczatek musi czytac plik: cat, grep, head, tail, sort lub uniq');
  if(commands.slice(1).some(args=>!NEXT.has(args[0])))
    return failed('kolejne etapy: grep, sort, uniq, head, tail, wc');
  if(parts.some(x=>/[;><]/.test(x))) return failed('brak przekierowan i separatorow polecen');

  const first=runReadOnly(parts[0]);
  if(!first.ok) return failed('etap 1: '+first.output);
  // Stage 1 is a read-only command. Convert displayed lines into a stream
  // whose lines end with LF; later stages receive that content, never a path.
  stages.push(commands[0][0]);
  // cat preserves the file's exact trailing-newline behavior. Other
  // read-only commands display rows and produce newline-terminated output.
  let stream=commands[0][0]==='cat'?first.output:fromLines(asLines(first.output));
  for(let i=1;i<commands.length;i++){
    const [command,...args]=commands[i];
    stages.push(command);
    const lines=asLines(stream);
    if(command==='sort'||command==='uniq'){
      if(args.length) return failed('etap '+(i+1)+': '+command+' czyta potok bez argumentu PLIK');
      stream=fromLines(command==='sort'
        ? [...lines].sort()
        : lines.filter((line,index)=>index===0||line!==lines[index-1]));
    } else if(command==='grep') {
      const insensitive=args[0]==='-i';
      const rest=insensitive?args.slice(1):args;
      if(rest.length!==1||!rest[0]||rest[0].startsWith('-'))
        return failed('etap '+(i+1)+': grep [-i] WZORZEC');
      const pattern=insensitive?rest[0].toLowerCase():rest[0];
      const hits=lines.filter(line=>
        (insensitive?line.toLowerCase():line).includes(pattern));
      if(!hits.length) return failed('etap '+(i+1)+': grep nie znalazl pasujacych wierszy');
      stream=fromLines(hits);
    } else if(command==='head'||command==='tail') {
      let n=10;
      if(args.length){
        if(args.length!==2||args[0]!=='-n'||!/^\d+$/.test(args[1])||
           Number(args[1])<1||Number(args[1])>100)
          return failed('etap '+(i+1)+': '+command+' [-n 1..100]');
        n=Number(args[1]);
      }
      stream=fromLines(command==='head'?lines.slice(0,n):lines.slice(-n));
    } else {
      if(args.length>1||(args.length===1&&!['-l','-w','-c'].includes(args[0])))
        return failed('etap '+(i+1)+': wc [-l|-w|-c]');
      const nlines=(stream.match(/\n/g)??[]).length;
      const words=countWords(stream);
      const bytes=new TextEncoder().encode(stream).length;
      stream=(args[0]==='-l'?String(nlines):args[0]==='-w'?String(words):
        args[0]==='-c'?String(bytes):[nlines,words,bytes].join(' '))+'\n';
    }
  }
  return {
    state,ok:true,command:'pipeline',target:first.target,
    stages,
    filterPattern:commands[0][0]==='grep'
      ? (commands[0][1]==='-i'?commands[0][2]:commands[0][1]) : undefined,
    output:stream.replace(/\n$/,'')
  };
}

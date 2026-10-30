/**
 * Small educational lexer shared by the virtual terminal, pipes and redirects.
 * It never expands variables, globs, substitutions or launches a host shell.
 * Quoted/escaped | and > remain literal characters in a word.
 */
export type ShellToken =
  | {kind:'word';value:string;start:number;end:number}
  | {kind:'pipe'|'overwrite'|'append'|'and'|'or';start:number;end:number};

export function scanShell(raw:string):ShellToken[]|null {
  const result:ShellToken[]=[];
  let quote:"'"|'"'|null=null;
  let value='';
  let started=false;
  let start=0;

  const begin=(i:number)=>{if(!started){started=true;start=i;}};
  const flush=(i:number)=>{
    if(started){result.push({kind:'word',value,start,end:i});value='';started=false;}
  };

  for(let i=0;i<raw.length;i++){
    const ch=raw[i];
    if(quote==="'"){
      if(ch==="'")quote=null;
      else value+=ch;
      continue;
    }
    if(quote==='"'){
      if(ch==='"'){quote=null;continue;}
      if(ch==='\\' && i+1<raw.length && (raw[i+1]==='"'||raw[i+1]==='\\')){
        value+=raw[++i];
      } else {
        value+=ch;
      }
      continue;
    }
    if(ch==="'" || ch==='"'){
      begin(i);quote=ch;continue;
    }
    if(ch==='\\'){
      if(i+1>=raw.length)return null;
      begin(i);value+=raw[++i];continue;
    }
    if(/\s/u.test(ch)){flush(i);continue;}
    // Semicolon, input redirect and single & remain unsupported.
    if(ch===';'||ch==='<')return null;
    if(ch==='&'){
      if(raw[i+1]!=='&')return null;
      flush(i);
      result.push({kind:'and',start:i,end:i+2});
      i++;
      continue;
    }
    if(ch==='|'||ch==='>'){
      flush(i);
      if(ch==='|'&&raw[i+1]==='|'){
        result.push({kind:'or',start:i,end:i+2});
        i++;
      } else if(ch==='|')result.push({kind:'pipe',start:i,end:i+1});
      else if(raw[i+1]==='>'){
        result.push({kind:'append',start:i,end:i+2});
        i++;
      } else result.push({kind:'overwrite',start:i,end:i+1});
      continue;
    }
    begin(i);value+=ch;
  }
  if(quote!==null)return null;
  flush(raw.length);
  return result;
}

/** Plain argument tokens only: shell operators are parsed by callers. */
export function tokenizeShellWords(raw:string):string[]|null {
  const tokens=scanShell(raw);
  if(!tokens||tokens.some(t=>t.kind!=='word'))return null;
  return tokens.map(t=>(t as Extract<ShellToken,{kind:'word'}>).value);
}

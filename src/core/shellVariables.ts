/**
 * Educational Bash-like parameter expansion. Never calls a host shell.
 * Expansion is done while lexing: single quotes and escaped $ stay literal;
 * double quotes and unquoted words expand $NAME, braced names and $?.
 * Deliberately no word splitting, globbing, command substitution or eval.
 */
export const VARIABLE_LIMIT=16;
export const VARIABLE_VALUE_LIMIT=256;
const VALID_NAME=/^[A-Za-z_][A-Za-z0-9_]*$/;
export interface ExpandedWords {words:string[]; refs:string[]}

export function expandVirtualWords(
  raw:string, variables:Readonly<Record<string,string>>, lastCode:number
):ExpandedWords|null {
  const words:string[]=[];
  const refs:string[]=[];
  let value='',begun=false;
  let quote:"'"|'"'|null=null;
  const flush=()=>{if(begun){words.push(value);value='';begun=false;}};
  const substitute=(index:number):number=>{
    const next=raw[index+1];
    if(next==='?'){
      value+=String(lastCode);
      refs.push('?');
      return index+1;
    }
    if(next==='{'){
      const close=raw.indexOf('}',index+2);
      if(close<0)return -1;
      const name=raw.slice(index+2,close);
      if(!VALID_NAME.test(name))return -1;
      value+=Object.hasOwn(variables,name)?variables[name]:'';
      refs.push(name);
      return close;
    }
    const match=/^[A-Za-z_][A-Za-z0-9_]*/.exec(raw.slice(index+1));
    if(!match){value+='$';return index;}
    const name=match[0];
    value+=Object.hasOwn(variables,name)?variables[name]:'';
    refs.push(name);
    return index+name.length;
  };
  for(let i=0;i<raw.length;i++){
    const c=raw[i];
    if(quote==="'"){
      if(c==="'")quote=null;else value+=c;
      continue;
    }
    if(c==='\\'){
      if(quote==='"'){
        if(i+1<raw.length&&['$','"','\\'].includes(raw[i+1])){
          begun=true;value+=raw[++i];
        }else {begun=true;value+=c;}
      }else{
        if(i+1>=raw.length)return null;
        begun=true;value+=raw[++i];
      }
      continue;
    }
    if(c===quote){quote=null;continue;}
    if(c==='"'||c==="'"){
      if(quote===null){quote=c;begun=true;}else {begun=true;value+=c;}
      continue;
    }
    if(c==='$'){
      begun=true;
      const end=substitute(i);
      if(end<0)return null;
      i=end;continue;
    }
    if(!quote&&/\s/u.test(c)){flush();continue;}
    if(!quote&&['|','>','<',';','&'].includes(c))return null;
    begun=true;value+=c;
  }
  if(quote)return null;
  flush();
  return {words,refs};
}
export function readAssignment(parts:readonly string[]):{name:string;value:string}|null{
  if(parts.length!==1)return null;
  const match=/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/s.exec(parts[0]);
  if(!match)return null;
  return {name:match[1],value:match[2]};
}
export const validName=(name:string)=>VALID_NAME.test(name);

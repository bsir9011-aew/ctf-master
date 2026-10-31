/** Keep the original physical line number even when blank lines are ignored
 * by the virtual workshop's four-command limit.
 */
export interface SourceLine {line:number;raw:string}
export interface EditorRange {start:number;end:number}

export function workshopSourceLines(script:string):SourceLine[] {
  return script.replace(/\r\n/g,'\n').split('\n')
    .map((raw,i)=>({line:i+1,raw:raw.trim()}))
    .filter(item=>item.raw.length>0);
}

/** HTML textarea selection offsets count UTF-16 code units, like JS strings.
 * The line can be selected for easy replacement without mutating the draft.
 * CRLF is treated as one line break but its two original offsets are retained.
 */
export function sourceLineRange(script:string,line:number):EditorRange|null {
  if(!Number.isSafeInteger(line)||line<1)return null;
  let start=0;
  for(let i=1;i<line;i++){
    const breakAt=script.indexOf('\n',start);
    if(breakAt<0)return null;
    start=breakAt+1;
  }
  const breakAt=script.indexOf('\n',start);
  let end=breakAt<0?script.length:breakAt;
  if(end>start&&script[end-1]==='\r')end--;
  // Select only the command, not leading/trailing layout whitespace.
  while(start<end&&(script[start]===' '||script[start]==='\t'))start++;
  while(end>start&&(script[end-1]===' '||script[end-1]==='\t'))end--;
  return {start,end};
}

/** Pure, UTF-16-offset based edit, matching textarea.selectionStart/End.
 * Replaces selected text rather than always appending. Never exceeds maxLength.
 */
export interface EditorInsertion {
  value:string;
  cursor:number;
}
export function insertAtSelection(
  value:string,
  token:string,
  start:number,
  end:number,
  maxLength:number
):EditorInsertion|null {
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||
     start<0||end<start||end>value.length||!token||
     !Number.isSafeInteger(maxLength)||maxLength<0)return null;
  const next=value.slice(0,start)+token+value.slice(end);
  if(next.length>maxLength)return null;
  return {value:next,cursor:start+token.length};
}

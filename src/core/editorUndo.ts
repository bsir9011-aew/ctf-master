/** The Bash editor keeps a small in-memory undo stack for accidental edits.
 * Snapshots use textarea UTF-16 selection offsets, never store filesystem data,
 * and do not change the persistent draft schema.
 */
export interface EditorSnapshot {
  value:string;
  start:number;
  end:number;
}
export type EditKind='typing'|'shortcut'|'reset';
export interface UndoHistory {
  past:EditorSnapshot[];
  lastTyping:{at:number;caret:number}|null;
}
export const UNDO_LIMIT=20;
export const emptyUndoHistory=():UndoHistory=>({past:[],lastTyping:null});

export function recordEditorEdit(
  history:UndoHistory,before:EditorSnapshot,after:EditorSnapshot,
  kind:EditKind,at:number
):UndoHistory {
  if(before.value===after.value)return history;
  const simpleTyping=kind==='typing'&&before.start===before.end&&
    after.start===after.end&&
    Math.abs(after.value.length-before.value.length)<=2;
  const previous=history.lastTyping;
  const group=simpleTyping&&previous!==null&&
    at>=previous.at&&at-previous.at<=1000&&
    previous.caret===before.start&&history.past.length>0;
  return {
    past:group?history.past:[...history.past,before].slice(-UNDO_LIMIT),
    lastTyping:simpleTyping?{at,caret:after.end}:null
  };
}

export function undoEditorEdit(
  history:UndoHistory
):{history:UndoHistory;snapshot:EditorSnapshot}|null {
  if(!history.past.length)return null;
  return {
    snapshot:history.past[history.past.length-1],
    history:{past:history.past.slice(0,-1),lastTyping:null}
  };
}

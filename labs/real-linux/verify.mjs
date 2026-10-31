import {existsSync,lstatSync,readFileSync} from 'node:fs';
import {home,root,identity,paths,fixtures,sha256} from './lab.mjs';

const inspect=(path,isDirectory=false)=>{
  try {
    const info=lstatSync(path);
    if(info.isSymbolicLink())return null;
    if(isDirectory?!info.isDirectory():!info.isFile())return null;
    return info;
  }catch{return null;}
};
const mode=(info)=>info?.mode&0o777;
const sameContent=(path,expected)=>{
  if(!inspect(path))return false;
  try{return sha256(readFileSync(path))===sha256(expected);}catch{return false;}
};
function main(){
  if(!inspect(home,true)||!inspect(root,true)||
     !sameContent(paths.marker,identity)){
    console.error('Lab missing or not initialized. From the repository root run: node labs/real-linux/setup.mjs');
    process.exitCode=2;return;
  }
  const checks=[
    ['Minimal access to the evidence directory (owner only)',
      mode(inspect(paths.vault,true))===0o700],
    ['Audit source is unchanged and retains its original permissions',
      mode(inspect(paths.source))===0o644&&sameContent(paths.source,fixtures.source)],
    ['Ticket and unrelated service log are unchanged',
      mode(inspect(paths.ticket))===0o644&&sameContent(paths.ticket,fixtures.ticket)&&
      mode(inspect(paths.decoy))===0o644&&sameContent(paths.decoy,fixtures.decoy)],
    ['Delivery directory retains safe owner-only access',
      mode(inspect(paths.delivery,true))===0o700],
    ['A separate, regular evidence copy exists with expected permissions',
      mode(inspect(paths.copy))===0o644],
    ['Copied evidence matches the complete original (SHA-256)',
      sameContent(paths.copy,fixtures.source)]
  ];
  let passed=0;
  for(const [description,ok] of checks){
    console.log((ok?'PASS':'NOT YET')+' | '+description);
    if(ok)passed++;
  }
  console.log('RESULT: '+passed+'/'+checks.length);
  if(passed===checks.length){
    console.log('REAL LINUX LAB PASSED: filesystem state and copy integrity verified.');
    console.log('This checks outcomes, not your diagnosis process. Explain WHY the fix worked.');
  }else{
    console.log('Lab incomplete. Inspect the actual filesystem before changing anything else.');
    process.exitCode=1;
  }
}
try{main();}catch(error){console.error(String(error));process.exitCode=2;}

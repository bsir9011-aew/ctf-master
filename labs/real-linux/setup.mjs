import {chmodSync,existsSync,lstatSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {home,root,marker,identity,paths,fixtures} from './lab.mjs';

const assertDirectory=(path)=>{
  if(existsSync(path)){
    const kind=lstatSync(path);
    if(!kind.isDirectory()||kind.isSymbolicLink())throw Error('Unsafe lab path: '+path);
    return false;
  }
  return true;
};
function main(){
  const newHome=assertDirectory(home);
  if(newHome)mkdirSync(home,{mode:0o700});
  const newRoot=assertDirectory(root);
  if(!newRoot){
    if(!existsSync(paths.marker)||lstatSync(paths.marker).isSymbolicLink()||
      readFileSync(paths.marker,'utf8')!==identity){
      throw Error('Lab folder already exists without a valid marker. No files changed: '+root);
    }
    console.log('Existing lab preserved (no reset): '+root);
    console.log('Check with: node labs/real-linux/verify.mjs');
    return;
  }

  mkdirSync(root,{mode:0o700});
  mkdirSync(paths.vault,{mode:0o700});
  mkdirSync(paths.delivery,{mode:0o700});
  for(const [path,data] of [
    [paths.ticket,fixtures.ticket],[paths.decoy,fixtures.decoy],
    [paths.source,fixtures.source]
  ]){
    writeFileSync(path,data,{flag:'wx',mode:0o600});
    chmodSync(path,0o644);
  }
  // Real POSIX directory rights. Unlike the PWA simulator, this affects
  // actual read/traverse checks on disk inside the isolated workspace.
  chmodSync(paths.vault,0o600);
  writeFileSync(paths.marker,identity,{flag:'wx',mode:0o600});
  console.log('Real Linux lab created: '+root);
  console.log('Start with: cd '+root);
  console.log('Read the ticket: cat issue.txt');
  console.log('When finished: node labs/real-linux/verify.mjs (from repo root)');
  console.log('Do NOT use sudo. Setup never touches files outside the lab folder.');
}
try{main();}catch(error){console.error(String(error));process.exitCode=1;}

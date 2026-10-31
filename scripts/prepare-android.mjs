import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const binary=resolve(root,'node_modules','.bin',process.platform==='win32'?'cap.cmd':'cap');
const web=resolve(root,'dist','index.html');

function run(args){
  console.log('Capacitor:',args.join(' '));
  execFileSync(binary,args,{cwd:root,stdio:'inherit',shell:process.platform==='win32'});
}
if(!existsSync(binary)){
  console.error('Capacitor not installed. Install the pinned Android dependencies documented in docs/ANDROID_APK.md.');
  process.exitCode=1;
}else if(!existsSync(web)){
  console.error('Web bundle missing. Run npm run build before preparing Android.');
  process.exitCode=1;
}else{
  try{
    if(!existsSync(resolve(root,'android','gradlew')))run(['add','android']);
    run(['sync','android']);
  }catch(error){
    console.error('Android project generation failed:',error instanceof Error?error.message:String(error));
    process.exitCode=1;
  }
}

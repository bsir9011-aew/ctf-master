import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const parent=resolve(process.env.CTF_LAB_PARENT || repo);
export const home=join(parent,'.ctf-master-labs');
export const root=join(home,'permissions-01');
export const marker='.ctf-master-lab-id';
export const identity='ctf-master:real-linux:permissions-01:v1\n';

export const paths=Object.freeze({
  ticket:join(root,'issue.txt'),
  decoy:join(root,'service.log'),
  vault:join(root,'archive'),
  source:join(root,'archive','audit.log'),
  delivery:join(root,'delivered'),
  copy:join(root,'delivered','evidence.log'),
  marker:join(root,marker)
});
export const fixtures=Object.freeze({
  ticket:'INC-REAL-01 | 09:14 | The audit export cannot be read after maintenance.\n'+
    'The source is in archive/audit.log. Diagnose the actual cause, restore the\n'+
    'minimum access needed and preserve a verified copy in delivered/evidence.log.\n'+
    'Keep the original, the service log and their permissions unchanged.\n'+
    'Do not use sudo or make files world-accessible.\n',
  decoy:'09:12 INFO web ready\n09:14 WARN elevated request latency\n09:15 INFO web normal\n',
  source:'09:10 AUDIT user=analyst event=case-open id=6842\n'+
    '09:13 AUDIT user=svc-report event=export-ready id=6849\n'
});
export const sha256=(text)=>createHash('sha256').update(text).digest('hex');

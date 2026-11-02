import {recoveryFixture} from './pathRecovery.ts';

/** Small mobile-friendly ticket pool. These are local virtual fixtures,
 * not additional routes or new persistent missions.
 */
export const blindTickets={
  service:{
    title:'INC-041 · Eksport usług',
    symptom:'Eksport dziennika usług nie może odczytać pliku.',
    name:'service.log',
    content:recoveryFixture('intro').content
  },
  worker:{
    title:'INC-052 · Kolejka zadań',
    symptom:'Proces kolejki zgłasza problem z odczytem swojego dziennika.',
    name:'worker.log',
    content:'WORKER: queue healthy\n'
  },
  billing:{
    title:'INC-063 · Raport rozliczeń',
    symptom:'Zadanie raportujące nie może otworzyć dziennika rozliczeń.',
    name:'billing.log',
    content:'BILLING: report ready\n'
  }
} as const;
export type BlindTicketId=keyof typeof blindTickets;
export const blindTicketIds=Object.keys(blindTickets) as BlindTicketId[];
const ROOT='/home/player/practice/diagnostics';
export function blindTicket(id:BlindTicketId='service'){
  const item=blindTickets[id];
  return {...item,id,directory:ROOT,file:ROOT+'/'+item.name,
    backup:id==='service'?'/home/player/practice/service.log.verified-backup':
      '/home/player/practice/.verified-'+id+'.backup'};
}

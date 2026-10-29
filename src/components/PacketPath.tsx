import { useState } from 'react';
import type { NetworkState } from '../core/network';
import { dnsName, remotePorts } from '../core/diagnostics';
import { analyzePacketPath, type TargetMode } from '../core/packetPath';

interface Props {
  network: NetworkState | undefined;
  expanded: boolean;
  onToggle: () => void;
}
const stageLabels = {ok:'OK', blocked:'STOP', waiting:'Do ustalenia', skipped:'Pominięto'};

export default function PacketPath({network,expanded,onToggle}:Props) {
  const [mode,setMode] = useState<TargetMode>('ip');
  const [portChoice,setPortChoice] = useState('auto');
  const expected=remotePorts(network ?? {
    address:'10.20.30.25',prefix:24,gateway:'10.20.30.254',router:'10.20.30.1',
    externalHost:'198.51.100.10',linkUp:true
  })[0] ?? 443;
  const port=portChoice==='auto'?expected:Number(portChoice);
  const analysis=analyzePacketPath(network,mode,port);
  const diagram=[
    {id:'host',label:'Komputer',detail:analysis.source,sub:'Interfejs eth0'},
    {id:'switch',label:'Przełącznik',detail:'Warstwa 2',sub:'Przekazuje ramki Ethernet'},
    {id:'router',label:'Router',detail:analysis.router,sub:'Brama: '+(network?.gateway ?? '10.20.30.254')},
    {id:'server',label:'Serwer',detail:analysis.destination,sub:'TCP/'+port}
  ];
  const failingNode=analysis.failure==='link'?'host':analysis.failure==='route'?'router':
    analysis.failure==='tcp'?'server':null;

  return <section className="packet-panel" aria-label="Schemat drogi pakietu">
    <div className="packet-heading">
      <div><p className="eyebrow">JAK PŁYNIE PAKIET?</p><h3>Komputer → przełącznik → router → serwer</h3>
        <p>Model logiczny. Przełącznik nie ma jeszcze konfigurowanych VLAN-ów ani portów.</p>
      </div>
      <button type="button" className="packet-reveal" onClick={onToggle}
        aria-expanded={expanded} aria-controls="packet-diagnostic-details">
        {expanded?'Ukryj analizę':'Pokaż analizę (pomoc)'}
      </button>
    </div>
    <div className="packet-flow" aria-label="Trasa sieciowa">
      {diagram.map((node,i)=><div className="packet-flow-item" key={node.id}>
        <div className={'packet-node '+(expanded&&node.id===failingNode?'packet-node-blocked':'')}>
          <span className="packet-node-index">{i+1}</span><strong>{node.label}</strong>
          {expanded&&<><code>{node.detail}</code><small>{node.sub}</small></>}
        </div>
        {i<diagram.length-1&&<span className="packet-arrow" aria-hidden="true">→</span>}
      </div>)}
    </div>
    {expanded&&<div id="packet-diagnostic-details" className="packet-detail">
      <div className="packet-controls">
        <fieldset><legend>Cel połączenia</legend>
          <button type="button" className={mode==='ip'?'selected':''} aria-pressed={mode==='ip'}
            onClick={()=>setMode('ip')}>Adres IP</button>
          <button type="button" className={mode==='name'?'selected':''} aria-pressed={mode==='name'}
            onClick={()=>setMode('name')}>Domena</button>
        </fieldset>
        <label>Port zdalnego serwera
          <select value={portChoice} onChange={e=>setPortChoice(e.target.value)}>
            <option value="auto">Port laboratorium ({expected})</option>
            {[22,443,8080,8443,9000].filter(p=>p!==expected).map(p=>
              <option value={p} key={p}>TCP/{p}</option>)}
          </select>
        </label>
      </div>
      <p className="packet-target">Cel: <strong>{mode==='name'?dnsName(network ?? {
        address:'10.20.30.25',prefix:24,gateway:'10.20.30.254',
        router:'10.20.30.1',externalHost:'198.51.100.10',linkUp:true
      }):analysis.destination}:{port}</strong></p>
      <p className={'packet-conclusion '+(analysis.failure?'packet-bad':'packet-good')} role="status">
        {analysis.message}
      </p>
      <ol className="packet-stages">
        {analysis.stages.map(stage=><li className={'packet-stage packet-'+stage.status} key={stage.id}>
          <div><strong>{stage.title}</strong><span>{stageLabels[stage.status]}</span></div>
          <p>{stage.description}</p>
        </li>)}
      </ol>
      <p className="packet-disclaimer">Kolejność przedstawia diagnostykę problemu, a nie fizyczną kolejność wszystkich pakietów. Widok nie wysyła pakietów ani nie zmienia konfiguracji; zrób to komendami w terminalu.</p>
    </div>}
  </section>;
}

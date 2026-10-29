import { configuredDns, dnsName, expectedDns, remotePorts } from './diagnostics.ts';
import { healthyGateway, initialNetwork, sameSubnet, type NetworkState } from './network.ts';

export type PathStageStatus = 'ok' | 'blocked' | 'waiting' | 'skipped';
export type PathStageId = 'link' | 'route' | 'dns' | 'arp' | 'tcp';
export type TargetMode = 'name' | 'ip';

export interface PathStage {
  id: PathStageId;
  title: string;
  status: PathStageStatus;
  description: string;
}
export interface PacketPathResult {
  source: string;
  router: string;
  destination: string;
  target: string;
  port: number;
  arpMac: string | null;
  failure: PathStageId | null;
  message: string;
  stages: PathStage[];
}

/**
 * Read-only explanation of the same virtual network used by ping and nc.
 * Stages are ordered for troubleshooting, not as a wire-level capture.
 * Never opens a socket or mutates the simulated system.
 */
export function analyzePacketPath(
  network: NetworkState | undefined,
  mode: TargetMode,
  port: number
): PacketPathResult {
  const net = network ?? initialNetwork();
  const portValid = Number.isInteger(port) && port >= 1 && port <= 65535;
  const linkOK = net.linkUp;
  const sameLan = sameSubnet(net.address, net.router, net.prefix);
  const routeOK = healthyGateway(net);
  const dnsOK = mode === 'ip' || configuredDns(net) === expectedDns(net);
  const tcpOK = portValid && remotePorts(net).includes(port);
  const target = mode === 'name' ? dnsName(net) : net.externalHost;
  const arpMac = net.arpCache?.[net.router] ?? null;

  const failure: PathStageId | null =
    !linkOK ? 'link' :
    !routeOK ? 'route' :
    !dnsOK ? 'dns' :
    !tcpOK ? 'tcp' : null;
  const passed = (id:PathStageId):boolean => {
    const order:PathStageId[] = ['link','route','dns','arp','tcp'];
    return failure === null || order.indexOf(id) <= order.indexOf(failure);
  };
  const stages:PathStage[] = [
    {
      id:'link',title:'1. Interfejs Ethernet',
      status:linkOK ? 'ok' : 'blocked',
      description:linkOK
        ? 'eth0 jest UP — host może wysyłać ramki do przełącznika.'
        : 'eth0 jest DOWN. Ramki nie opuszczają komputera.'
    },
    {
      id:'route',title:'2. Adres i brama',
      status:!passed('route') ? 'skipped' : routeOK ? 'ok' : 'blocked',
      description:!passed('route') ? 'Najpierw napraw interfejs eth0.' :
        !sameLan ? 'Adres '+net.address+'/'+net.prefix+' nie należy do podsieci rzeczywistego routera '+net.router+'.' :
        net.gateway !== net.router
          ? 'Brama domyślna wskazuje '+net.gateway+', ale router laboratorium ma IP '+net.router+'.'
          : 'Brama '+net.gateway+' jest osiągalna w lokalnej podsieci.'
    },
    {
      id:'dns',title:'3. Rozpoznanie nazwy',
      status:!passed('dns') ? 'skipped' : mode==='ip' ? 'skipped' : dnsOK ? 'ok' : 'blocked',
      description:!passed('dns') ? 'Brak trasy — nie można dotrzeć do resolvera.' :
        mode==='ip' ? 'Użyto adresu IP bez zapytania DNS.' :
        dnsOK ? dnsName(net)+' → '+net.externalHost+' (resolver '+configuredDns(net)+').' :
          'Skonfigurowano DNS '+configuredDns(net)+', oczekiwany resolver: '+expectedDns(net)+'.'
    },
    {
      id:'arp',title:'4. MAC następnego hopu',
      status:!passed('arp') ? 'skipped' : arpMac ? 'ok' : 'waiting',
      description:!passed('arp') ? 'Do tego etapu nie dotarliśmy.' :
        arpMac ? 'Tablica sąsiadów: '+net.router+' → '+arpMac+'. MAC serwera zdalnego nie jest tu używany.' :
          'Router '+net.router+' jest osiągalny. MAC nie figuruje jeszcze w tablicy sąsiadów; symulator pozna go po komunikacji.'
    },
    {
      id:'tcp',title:'5. Port TCP '+port,
      status:!passed('tcp') ? 'skipped' : tcpOK ? 'ok' : 'blocked',
      description:!passed('tcp') ? 'Wcześniejszy etap uniemożliwia próbę TCP.' :
        tcpOK ? 'Fikcyjny serwer '+net.externalHost+' odpowiada SYN/ACK na TCP/'+port+'.' :
          'Host jest osiągalny, ale zdalny port TCP/'+port+' jest zamknięty (connection refused).'
    }
  ];

  const messages:Record<Exclude<PathStageId,'arp'>,string> = {
    link:'Problem: łącze eth0 jest wyłączone.',
    route:'Problem: adresacja, podsieć lub brama nie pozwalają dotrzeć do routera.',
    dns:'Problem: resolver DNS nie rozpoznaje nazwy hosta.',
    tcp:'Problem: serwer jest osiągalny, ale wskazany port TCP jest zamknięty.'
  };
  return {
    source:net.address+'/'+net.prefix,router:net.router,destination:net.externalHost,
    target,port,arpMac,failure,
    message:failure === null ? 'Droga do serwera i wskazany port TCP są osiągalne w symulatorze.' :
      messages[failure as Exclude<PathStageId,'arp'>],
    stages
  };
}

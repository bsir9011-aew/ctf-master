import type { CommandResult, LinuxState } from './linux.ts';

export interface NetworkState {
  address: string;
  prefix: number;
  gateway: string;
  router: string;
  externalHost: string;
  linkUp: boolean;
}

export const initialNetwork = (): NetworkState => ({
  address:'10.20.30.25', prefix:24, gateway:'10.20.30.254',
  router:'10.20.30.1', externalHost:'198.51.100.10', linkUp:true
});

/** In the virtual lab IP addresses are strings, never actual sockets or requests. */
export function ipv4Number(raw: string): number | null {
  if (!/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(raw)) return null;
  const segments = raw.split('.').map(Number);
  if (segments.some(x => x > 255)) return null;
  return (((segments[0] * 0x1000000) + (segments[1] << 16) +
    (segments[2] << 8) + segments[3]) >>> 0);
}
function numberIPv4(value: number): string {
  return [24,16,8,0].map(shift => String((value >>> shift) & 255)).join('.');
}
function mask(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}
export function sameSubnet(a: string, b: string, prefix: number): boolean {
  const left = ipv4Number(a), right = ipv4Number(b);
  return left !== null && right !== null && Number.isInteger(prefix) && prefix >= 0 && prefix <= 32 &&
    (left & mask(prefix)) === (right & mask(prefix));
}
export function networkCIDR(address: string, prefix: number): string {
  const ip = ipv4Number(address);
  return ip === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32
    ? 'invalid' : numberIPv4((ip & mask(prefix)) >>> 0) + '/' + prefix;
}

const healthyGateway = (network: NetworkState): boolean =>
  network.linkUp && sameSubnet(network.address, network.router, network.prefix) &&
  network.gateway === network.router;

export function executeNetworkCommand(state: LinuxState, cmd: string, args: string[]): CommandResult {
  const net = state.network ?? initialNetwork();
  const done = (output:string, ok=true, next=state, target?:string): CommandResult =>
    ({output,ok,state:next,command:cmd,target});
  const update = (next:NetworkState):LinuxState => ({...state,network:next});

  if (cmd === 'ip') {
    if ((args.length===1 && args[0]==='addr') || (args.length===2 && args[0]==='addr' && args[1]==='show')) {
      return done('2: eth0: <'+(net.linkUp?'UP':'DOWN')+'>\n    inet '+net.address+'/'+net.prefix+' scope global eth0',true,state,'eth0');
    }
    if ((args.length===1 && args[0]==='route') || (args.length===2 && args[0]==='route' && args[1]==='show')) {
      return done('default via '+net.gateway+' dev eth0\n'+networkCIDR(net.address,net.prefix)+' dev eth0 scope link',true,state,'route');
    }
    if (args.length===5 && args[0]==='addr' && args[1]==='replace' && args[3]==='dev' && args[4]==='eth0') {
      const parts=args[2].split('/');
      const ip=parts[0], prefix=Number(parts[1]);
      if (parts.length!==2 || ipv4Number(ip)===null || !/^(?:[1-9]|[12][0-9]|3[0-2])$/.test(parts[1]) ||
          ipv4Number(ip)===0 || (ipv4Number(ip)! >= 0xe0000000)) {
        return done('ip: Invalid IPv4 address/prefix (1-32)',false);
      }
      return done('eth0: '+ip+'/'+prefix,true,update({...net,address:ip,prefix}),'eth0');
    }
    if (args.length===5 && args[0]==='route' && args[1]==='replace' &&
        args[2]==='default' && args[3]==='via') {
      const gateway=args[4];
      if (ipv4Number(gateway)===null || !sameSubnet(net.address,gateway,net.prefix) ||
          gateway===net.address || !net.linkUp) {
        return done('ip: Nexthop has invalid gateway (check eth0 address and link)',false);
      }
      return done('default via '+gateway+' dev eth0',true,update({...net,gateway}),'route');
    }
    if (args.length===4 && args[0]==='link' && args[1]==='set' && args[2]==='eth0' &&
        ['up','down'].includes(args[3])) {
      const linkUp=args[3]==='up';
      return done('eth0 '+args[3],true,update({...net,linkUp}),'eth0');
    }
    return done('Uzycie: ip addr show | ip addr replace IP/PREFIX dev eth0 | ip route show | ip route replace default via IP | ip link set eth0 up|down',false);
  }

  if (cmd==='ping') {
    const host=args.length===3 && args[0]==='-c' && args[1]==='1' ? args[2] : null;
    if (!host || ipv4Number(host)===null) return done('Uzycie: ping -c 1 ADRES_IPV4 (symulacja)',false);
    let reachable = false;
    if (host==='127.0.0.1') reachable=true;
    else if (net.linkUp && host===net.router && sameSubnet(net.address,host,net.prefix)) reachable=true;
    else if (host===net.externalHost && healthyGateway(net)) reachable=true;
    if (reachable) return done('64 bytes from '+host+': icmp_seq=1 ttl=64 time=1.0 ms\n1 packets transmitted, 1 received',true,state,host);
    const reason=!net.linkUp ? 'Network interface is down' :
      (host===net.externalHost && !healthyGateway(net)) ? 'Destination Host Unreachable (route/subnet)' : '100% packet loss';
    return done('PING '+host+': '+reason+'\n1 packets transmitted, 0 received',false,state,host);
  }

  if (cmd==='ss') {
    if (args.length!==1 || args[0]!=='-lnt') return done('Uzycie: ss -lnt',false);
    const services=state.services ?? {};
    const processes=state.processes ?? [];
    const active=(unit:string) => services[unit]?.status==='active' &&
      processes.some(p=>p.service===unit && p.running);
    const ports:[string,string][]=[['sshd','22'],['web','8080'],['api','9000']];
    const rows=ports.filter(([unit])=>active(unit)).map(([unit,port])=>
      'LISTEN 0      128    0.0.0.0:'+port+'    0.0.0.0:*    '+unit);
    return done(['State  Recv-Q Send-Q Local Address:Port Peer Address:Port Service',
      ...rows].join('\n'),true,state,'tcp-listeners');
  }
  return done('Nieobslugiwana komenda sieciowa',false);
}

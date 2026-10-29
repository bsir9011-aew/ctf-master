import type { CommandResult, LinuxState } from './linux.ts';
import { ipv4Number, sameSubnet, healthyGateway, type NetworkState } from './network.ts';

/** All addresses, hostnames, ports, and MACs below are fictional lab fixtures. */
const DEFAULT_NAME = 'lab.ctf.test';
const DEFAULT_DNS = '198.51.100.53';
const DEFAULT_CONFIGURED = '198.51.100.54';
const ROUTER_MAC = '02:42:ac:14:1e:01';

export function dnsName(net: NetworkState): string { return net.dnsName ?? DEFAULT_NAME; }
export function expectedDns(net: NetworkState): string { return net.dnsExpected ?? DEFAULT_DNS; }
export function configuredDns(net: NetworkState): string { return net.dnsServer ?? DEFAULT_CONFIGURED; }
export function remotePorts(net: NetworkState): number[] { return net.remotePorts ?? [443]; }

export function resolveHost(net: NetworkState, host: string):
  {address:string|null; error:string|null; needsDns:boolean} {
  if (ipv4Number(host) !== null) return {address:host,error:null,needsDns:false};
  if (host !== dnsName(net)) return {address:null,error:'NXDOMAIN: unknown lab hostname',needsDns:true};
  if (!healthyGateway(net)) return {address:null,error:'DNS timeout: gateway or interface unreachable',needsDns:true};
  if (configuredDns(net) !== expectedDns(net)) return {address:null,error:'DNS server not responding',needsDns:true};
  return {address:net.externalHost,error:null,needsDns:true};
}

const learnedArp = (net: NetworkState):NetworkState =>
  ({...net,arpCache:{...net.arpCache,[net.router]:ROUTER_MAC}});

export function arpAfterGateway(net:NetworkState):NetworkState {
  return healthyGateway(net) ? learnedArp(net) : net;
}

export function executeDiagnosticCommand(state:LinuxState,cmd:string,args:string[]):CommandResult {
  const net=state.network!;
  const done=(output:string,ok=true,next=state,target?:string):CommandResult =>
    ({state:next,output,ok,command:cmd,target});
  const learn=():LinuxState=>({...state,network:arpAfterGateway(net)});

  if (cmd==='resolvectl') {
    if (args.length===2 && args[0]==='dns' && args[1]==='eth0') {
      return done('Link eth0: DNS Server '+configuredDns(net),true,state,'dns');
    }
    if (args.length===3 && args[0]==='dns' && args[1]==='eth0') {
      const ip=args[2];
      if (ipv4Number(ip)===null || ip==='0.0.0.0' || ip==='255.255.255.255') {
        return done('resolvectl: Invalid DNS IPv4 address',false);
      }
      return done('Link eth0: DNS Server '+ip,true,
        {...state,network:{...net,dnsServer:ip}},'dns');
    }
    return done('Uzycie: resolvectl dns eth0 [DNS_IPV4]',false);
  }

  if (cmd==='nslookup') {
    if (args.length!==1) return done('Uzycie: nslookup NAZWA',false);
    const host=args[0];
    if (ipv4Number(host)!==null) return done('nslookup: use a hostname instead of an IP',false);
    const result=resolveHost(net,host);
    if (result.error) return done(result.error,false,state,host);
    return done('Server: '+configuredDns(net)+'\nName: '+host+'\nAddress: '+result.address,
      true,learn(),host);
  }

  if (cmd==='nc' || cmd==='trace') {
    const host=cmd==='nc' && args.length===3 && args[0]==='-z' ? args[1] :
      cmd==='trace' && args.length===2 ? args[0] : null;
    const portRaw=cmd==='nc' ? args[2] : args[1];
    if (!host || !/^[1-9][0-9]*$/.test(portRaw ?? '') ||
      Number(portRaw)>65535 || Number(portRaw)<1) {
      return done(cmd==='nc'?'Uzycie: nc -z HOST PORT':'Uzycie: trace HOST PORT',false);
    }
    const port=Number(portRaw);
    const result=resolveHost(net,host);
    const target=host+':'+port;
    const steps=['DNS: '+(result.needsDns ? result.error ?? host+' -> '+result.address : 'literal IP '+host)];
    if (result.error) return done(steps.join('\n'),false,state,target);
    const address=result.address!;
    const remote=address===net.externalHost;
    const loopback=address==='127.0.0.1';
    const local=net.linkUp && address===net.router &&
      sameSubnet(net.address,address,net.prefix);
    const reachable=remote ? healthyGateway(net) : loopback || local;
    steps.push('ROUTE: '+(remote?'via '+net.gateway+' dev eth0':loopback?'local loopback':local?'direct eth0':'no route'));
    if (!reachable) return done(steps.concat('NETWORK: Destination Host Unreachable').join('\n'),false,state,target);
    const next=remote ? learn():state;
    steps.push(remote ? 'ARP: '+net.router+' -> '+ROUTER_MAC :
      loopback ? 'L2: loopback, no ARP' : 'ARP: directly connected peer');
    // This is a lab *remote* service, not a local ss listener.
    const open=remote && remotePorts(net).includes(port);
    steps.push('TCP: '+(open?'SYN -> SYN/ACK (open)':'SYN -> no listener / refused'));
    return done(cmd==='trace' ? steps.join('\n') :
      (open?'Connection to '+target+' succeeded (simulated TCP)':
      'nc: '+target+': Connection refused (simulated TCP)'),open,next,target);
  }

  return done('Unsupported diagnostic command',false);
}

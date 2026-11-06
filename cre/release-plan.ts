import {getAddress,parseAbi,type Address,type Abi} from 'viem';
import gateArtifact from '../src/releases/ENSReleaseGate.json';
import vaultArtifact from '../src/releases/ReleaseLPVault.json';
export type ReleaseTarget={gate:string;consumers:string[]};
export const releaseMulticallAbi=parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[] results)']);
export const releaseMulticallAddress='0xcA11bde05977b3631167028862bE2a173976CA11' as Address;
export function releaseReadPlan(target:ReleaseTarget){
  const gate=getAddress(target.gate),abi=gateArtifact.abi as Abi;
  const calls:{to:Address;abi:Abi;fn:string;args:readonly unknown[]}[]=['owner','treasury','manager','identityValid','candidate','epoch','coverageHash','consumerCount','resolver','dnsName'].map(fn=>({to:gate,abi,fn,args:[]}));
  target.consumers.forEach((address,i)=>{
    calls.push({to:gate,abi,fn:'consumers',args:[BigInt(i)]});
    for(const fn of ['gate','manager','tokenId'])calls.push({to:getAddress(address),abi:vaultArtifact.abi as Abi,fn,args:[]});
  });return calls;
}

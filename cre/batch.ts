import { decodeFunctionResult, encodeFunctionData, parseAbi, type Abi, type Address, type Hex } from 'viem';
export const MULTICALL3:Address='0xcA11bde05977b3631167028862bE2a173976CA11';
const multicallAbi=parseAbi(['function aggregate3((address target,bool allowFailure,bytes callData)[] calls) payable returns ((bool success,bytes returnData)[] results)']);
export type ViewCall={address:Address;fn:string;args:readonly unknown[];abi:Abi};
const key=(c:ViewCall)=>JSON.stringify([c.address.toLowerCase(),c.fn,c.args],(_,v)=>typeof v==='bigint'?String(v):v);
export class ViewBatch {
  private cache=new Map<string,unknown>();
  constructor(private call:(to:Address,data:Hex)=>Hex){}
  warm(calls:ViewCall[]){
    const unique=[...new Map(calls.filter(c=>!this.cache.has(key(c))).map(c=>[key(c),c])).values()];
    if(!unique.length)return;
    const inputs=unique.map(c=>{
      const fn=c.abi.find(f=>f.type==='function'&&f.name===c.fn);
      if(!fn||fn.type!=='function'||!['view','pure'].includes(fn.stateMutability))throw new Error('CRE batching accepts declared view/pure functions only.');
      return {target:c.address,allowFailure:false,callData:encodeFunctionData({abi:c.abi,functionName:c.fn,args:c.args} as never)};
    });
    const data=encodeFunctionData({abi:multicallAbi,functionName:'aggregate3',args:[inputs]});
    const results=decodeFunctionResult({abi:multicallAbi,functionName:'aggregate3',data:this.call(MULTICALL3,data)});
    if(results.length!==unique.length)throw new Error('Incomplete batched view response.');
    results.forEach((r,i)=>{if(!r.success)throw new Error('A required contract read failed.');const c=unique[i];this.cache.set(key(c),decodeFunctionResult({abi:c.abi,functionName:c.fn,data:r.returnData} as never));});
  }
  read(c:ViewCall):any{if(!this.cache.has(key(c)))throw new Error(`Required view was not batched: ${c.fn}`);return this.cache.get(key(c));}
}

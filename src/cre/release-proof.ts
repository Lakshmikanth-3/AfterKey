import {sha256,stringToHex,isAddress} from 'viem';
import {canonicalJson} from './auth';

export function releaseOutputFromLogs(logs:unknown):any{
  const outputs:any[]=[],groups=new Map<string,{total:number;parts:Map<number,string>}>();
  const visit=(value:unknown):void=>{
    if(typeof value==='string'){
      let parsed:any;try{parsed=JSON.parse(value);}catch{return;}
      if(parsed?.source==='Chainlink CRE'&&parsed.kind==='configuration-release')outputs.push(parsed);
      if(parsed?.source==='AfterKey CRE chunk'){
        if(typeof parsed.digest!=='string'||typeof parsed.content!=='string'||!Number.isInteger(parsed.total)||parsed.total<1||parsed.total>200||!Number.isInteger(parsed.index)||parsed.index<0||parsed.index>=parsed.total)throw new Error('Invalid release evidence chunk.');
        let group=groups.get(parsed.digest);if(!group){group={total:parsed.total,parts:new Map()};groups.set(parsed.digest,group);}
        if(group.total!==parsed.total||(group.parts.has(parsed.index)&&group.parts.get(parsed.index)!==parsed.content))throw new Error('Conflicting release evidence chunks.');
        group.parts.set(parsed.index,parsed.content);
      }
    }else if(Array.isArray(value))value.forEach(visit);
    else if(value&&typeof value==='object')Object.values(value).forEach(visit);
  };
  visit(logs);
  for(const [digest,g] of groups){
    if(g.parts.size!==g.total)throw new Error('Incomplete CRE evidence chunks.');
    const encoded=Array.from({length:g.total},(_,i)=>g.parts.get(i)!).join('');
    if(sha256(stringToHex(encoded))!==digest)throw new Error('CRE evidence digest mismatch.');
    visit(encoded);
  }
  if(!outputs.length)throw new Error('Execution has no configuration-release output. Cron/departure results are not release proof.');
  if(outputs.some(o=>canonicalJson(o)!==canonicalJson(outputs[0])))throw new Error('Release node outputs disagree.');
  return outputs[0];
}
export function validateReleaseOutput(output:any,target:{gate:string;consumers:string[]}){
  const hex32=(v:unknown)=>typeof v==='string'&&/^0x[0-9a-f]{64}$/i.test(v);
  const uint=(v:unknown)=>typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v)&&BigInt(v)<2n**256n;
  if(output?.source!=='Chainlink CRE'||output.kind!=='configuration-release'||output.schemaVersion!==1||typeof output.gate!=='string'||output.gate.toLowerCase()!==target.gate.toLowerCase())throw new Error('Release output does not match configured gate.');
  if(!hex32(output.digest)||!hex32(output.coverage)||!hex32(output.transactionHash)||!uint(output.block)||BigInt(output.block)===0n||!uint(output.epoch))throw new Error('Malformed release proof fields.');
  if(output.passed!==true||!Array.isArray(output.issues)||output.issues.length)throw new Error('Release verification did not pass.');
  if(!Array.isArray(output.positions)||output.positions.length!==target.consumers.length||output.positions.some((p:any,i:number)=>!isAddress(p.consumer)||p.consumer.toLowerCase()!==target.consumers[i].toLowerCase()||!uint(p.tokenId)))throw new Error('Release proof consumer coverage differs.');
  if(new Set(output.positions.map((p:any)=>p.tokenId)).size!==output.positions.length)throw new Error('Duplicate position in release proof.');
}

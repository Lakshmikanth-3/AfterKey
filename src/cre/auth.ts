import { getAddress, hexToBytes, parseSignature, sha256, stringToHex, type Hex } from 'viem';
export const CRE_GATEWAY='https://01.gateway.zone-a.cre.chain.link';
export type TriggerInput={eventId:string;event:'departure'|'recheck'|'verify'|'release';subject:string;beforeBlock?:string;issueNumber?:number;gate?:string};
export function canonicalJson(value:unknown):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}
const base64url=(bytes:Uint8Array)=>btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const encode=(data:unknown)=>base64url(new TextEncoder().encode(JSON.stringify(data)));
export function triggerSigningRequest(workflowId:string,input:TriggerInput,issuer:string,now=Math.floor(Date.now()/1000),jti=crypto.randomUUID()){
  if(!/^[a-fA-F0-9]{64}$/.test(workflowId))throw new Error('Invalid deployed workflow ID.');
  if(!/^[a-f0-9-]{36}$/i.test(jti))throw new Error('A unique JWT request ID is required.');
  const body=canonicalJson({jsonrpc:'2.0',id:jti,method:'workflows.execute',params:{input,workflow:{workflowID:workflowId}}});
  const digest=sha256(stringToHex(body));
  const signingInput=`${encode({alg:'ETH',typ:'JWT'})}.${encode({digest,iss:getAddress(issuer),iat:now,exp:now+300,jti})}`;
  return {body,digest,signingInput,expiresAt:now+300,requestId:jti};
}
export function finishTriggerJwt(signingInput:string,signature:Hex):string {
  const {r,s,yParity}=parseSignature(signature);
  if(yParity===undefined)throw new Error('Wallet returned an unsupported signature.');
  const bytes=new Uint8Array(65);bytes.set(hexToBytes(r));bytes.set(hexToBytes(s),32);bytes[64]=yParity;
  return `${signingInput}.${base64url(bytes)}`;
}
export async function submitTrigger(request:ReturnType<typeof triggerSigningRequest>,signature:Hex,workflowId:string){
  if(Math.floor(Date.now()/1000)>=request.expiresAt)throw new Error('CRE authorization expired. Prepare a new request.');
  const response=await fetch('/api/cre-trigger',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${finishTriggerJwt(request.signingInput,signature)}`},body:request.body,signal:AbortSignal.timeout(40000)});
  const data=await response.json();
  if(!response.ok||data.error)throw new Error(`CRE gateway: ${data.error?.message||response.status}. Check execution history before retrying.`);
  const r=data.result;
  if(data.id!==request.requestId||r?.workflow_id?.replace(/^0x/,'').toLowerCase()!==workflowId.toLowerCase()||typeof r?.workflow_execution_id!=='string'||r.status!=='ACCEPTED')throw new Error('Unexpected CRE response. Check workflow history; do not assume the request failed.');
  // An accepted trigger is not a completed execution. Never store or export the bearer JWT.
  return {requestId:request.requestId,workflowId,executionId:r.workflow_execution_id,status:'ACCEPTED' as const,acceptedAt:new Date().toISOString()};
}

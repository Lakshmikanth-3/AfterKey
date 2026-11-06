import { recoverMessageAddress, bytesToHex, sha256, stringToHex } from 'viem';
import deployment from '../cre/deployment.json' with { type: 'json' };
import production from '../cre/config.production.json' with { type: 'json' };
import { canonicalJson } from '../src/cre/auth.js';

export type TriggerPolicy = { workflowId: string; subject: string; owner: string };
const decode = (value: string) => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const positiveBlock=(value:unknown)=>typeof value==='string'&&/^\d+$/.test(value)&&BigInt(value)>0n;

function validateTriggerInput(input:unknown,subject:string){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Request is outside the deployed workspace.');
  const value=input as Record<string,unknown>;
  const allowed=new Set(['eventId','event','subject','beforeBlock','issueNumber']);
  if(Object.keys(value).some(key=>!allowed.has(key)))throw new Error('CRE request contains unsupported input.');
  if(typeof value.subject!=='string'||value.subject.toLowerCase()!==subject.toLowerCase()||!['departure','recheck','verify'].includes(String(value.event))||typeof value.eventId!=='string'||!value.eventId||value.eventId.length>128)throw new Error('Request is outside the deployed workspace.');
  if(value.beforeBlock!==undefined&&!positiveBlock(value.beforeBlock))throw new Error('CRE baseline must be a positive block number.');
  if(value.event==='verify'&&!positiveBlock(value.beforeBlock))throw new Error('Verification requires a positive baseline block.');
  if(value.issueNumber!==undefined&&(!Number.isSafeInteger(value.issueNumber)||Number(value.issueNumber)<1))throw new Error('CRE issue number must be a positive safe integer.');
  if(value.event!=='departure'&&value.issueNumber!==undefined)throw new Error('GitHub issue numbers are only valid for departure checks.');
}

// Web-standard primitives work in the local server and the hosted Worker.
export async function validateSignedTrigger(body:string,authorization:string,now=Math.floor(Date.now()/1000),policy:TriggerPolicy={workflowId:deployment.workflowId,subject:production.subject,owner:production.authorizedEVMAddress}){
  if(new TextEncoder().encode(body).length>16000||authorization.length>4000||!authorization.startsWith('Bearer '))throw new Error('Missing or oversized signed CRE request.');
  const parts=authorization.slice(7).split('.');
  if(parts.length!==3)throw new Error('Invalid CRE authorization format.');
  const json=(part:string)=>JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(decode(part)));
  const header=json(parts[0]),claims=json(parts[1]);
  if(header.alg!=='ETH'||header.typ!=='JWT')throw new Error('Unsupported CRE authorization.');
  if(!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||claims.iat>now+30||claims.exp<=now||claims.exp-claims.iat>300||claims.exp<=claims.iat)throw new Error('CRE authorization expired or exceeds five minutes.');
  const request=JSON.parse(body),input=request.params?.input;
  if(request.jsonrpc!=='2.0'||request.method!=='workflows.execute'||request.id!==claims.jti||!/^[a-f0-9-]{36}$/i.test(request.id)||request.params?.workflow?.workflowID!==policy.workflowId)throw new Error('Request does not match the deployed workflow.');
  validateTriggerInput(input,policy.subject);
  if(claims.digest!==sha256(stringToHex(canonicalJson(request)))||canonicalJson(request)!==body)throw new Error('Request body differs from its signed digest.');
  const bytes=decode(parts[2]);
  if(bytes.length!==65||bytes[64]>1)throw new Error('Invalid Ethereum signature.');
  const signer=await recoverMessageAddress({message:`${parts[0]}.${parts[1]}`,signature:bytesToHex(bytes)});
  if(typeof claims.iss!=='string'||signer.toLowerCase()!==claims.iss.toLowerCase()||signer.toLowerCase()!==policy.owner.toLowerCase())throw new Error('Only the deployed owner may authorize CRE requests.');
}

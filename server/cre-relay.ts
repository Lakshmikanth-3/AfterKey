import { recoverMessageAddress, bytesToHex, sha256, stringToHex } from 'viem';
import type { IncomingMessage, ServerResponse } from 'node:http';
import deployment from '../cre/deployment.json';
import production from '../cre/config.production.json';
import { CRE_GATEWAY, canonicalJson } from '../src/cre/auth';

export async function validateSignedTrigger(body:string,authorization:string,now=Math.floor(Date.now()/1000),policy={workflowId:deployment.workflowId,subject:production.subject,owner:production.authorizedEVMAddress}){
  if(Buffer.byteLength(body)>16000||authorization.length>4000||!authorization.startsWith('Bearer '))throw new Error('Missing or oversized signed CRE request.');
  const jwt=authorization.slice(7),parts=jwt.split('.');
  if(parts.length!==3)throw new Error('Invalid CRE authorization format.');
  const header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8')),claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
  if(header.alg!=='ETH'||header.typ!=='JWT')throw new Error('Unsupported CRE authorization.');
  if(!Number.isSafeInteger(claims.iat)||!Number.isSafeInteger(claims.exp)||claims.iat>now+30||claims.exp<=now||claims.exp-claims.iat>300||claims.exp<=claims.iat)throw new Error('CRE authorization expired or exceeds five minutes.');
  const request=JSON.parse(body),input=request.params?.input;
  if(request.jsonrpc!=='2.0'||request.method!=='workflows.execute'||request.id!==claims.jti||!/^[a-f0-9-]{36}$/i.test(request.id)||request.params?.workflow?.workflowID!==policy.workflowId)throw new Error('Request does not match the deployed workflow.');
  if(!input||typeof input.subject!=='string'||input.subject.toLowerCase()!==policy.subject.toLowerCase()||!['departure','recheck','verify'].includes(input.event)||typeof input.eventId!=='string'||!input.eventId||input.eventId.length>128)throw new Error('Request is outside the deployed workspace.');
  if(claims.digest!==sha256(stringToHex(canonicalJson(request)))||canonicalJson(request)!==body)throw new Error('Request body differs from its signed digest.');
  const bytes=Buffer.from(parts[2],'base64url');
  if(bytes.length!==65||bytes[64]>1)throw new Error('Invalid Ethereum signature.');
  const signer=await recoverMessageAddress({message:`${parts[0]}.${parts[1]}`,signature:bytesToHex(bytes)});
  if(typeof claims.iss!=='string'||signer.toLowerCase()!==claims.iss.toLowerCase()||signer.toLowerCase()!==policy.owner.toLowerCase())throw new Error('Only the deployed owner may authorize CRE requests.');
}
export async function creRelay(req:IncomingMessage,res:ServerResponse,next?:()=>void){
  if(req.url?.split('?')[0]!=='/api/cre-trigger'){next?.();return;}
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.writeHead(405);res.end(JSON.stringify({error:{message:'POST a signed request.'}}));return;}
  let body='';
  try{
    for await(const chunk of req){body+=chunk.toString('utf8');if(Buffer.byteLength(body)>16000)throw new Error('Request exceeds 16 KB.');}
    const authorization=req.headers.authorization||'';
    await validateSignedTrigger(body,authorization);
    // Fixed destination; no arbitrary URL, no private key, no saved bearer token and no retries.
    const response=await fetch(CRE_GATEWAY,{method:'POST',headers:{'Content-Type':'application/json',Authorization:authorization},body,signal:AbortSignal.timeout(30000)});
    const text=await response.text();
    if(text.length>100000)throw new Error('CRE gateway response exceeds the limit.');
    res.writeHead(response.status);res.end(text);
  }catch(error){res.writeHead(400);res.end(JSON.stringify({error:{message:error instanceof Error?error.message:'CRE relay rejected this request. Check execution history before retrying.'}}));}
}

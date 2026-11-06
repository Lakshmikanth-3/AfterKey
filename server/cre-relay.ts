import type { IncomingMessage, ServerResponse } from 'node:http';
import { CRE_GATEWAY } from '../src/cre/auth';
import { validateSignedTrigger } from './cre-policy';
export { validateSignedTrigger } from './cre-policy';
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

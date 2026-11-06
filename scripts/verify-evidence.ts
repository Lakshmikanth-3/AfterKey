import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { decodeFunctionData } from 'viem';
import { clientFor, DEFAULT_RPC, serialize, same, compareOwner, deriveFindings, adminMask, type Snapshot } from '../src/engine';
import { ensAbi } from '../src/ens/abi';
import { readIdentity } from '../src/ens/preservation';
import { recordRole } from '../src/ens/roles';
import { WORKSPACE_OWNER, WORKSPACE_SUBJECT } from '../src/workspace';

const path=process.argv[2];if(!path)throw new Error('Pass the exported evidence JSON path.');
const bytes=await readFile(path),data=JSON.parse(bytes.toString('utf8'));
const numeric=new Set(['block','root','local','ownerRoot','ownerLocal','expiry','tokenId','effective','recordId','positionCount']);
const revive=(s:any):Snapshot=>JSON.parse(JSON.stringify(s),(key,value)=>numeric.has(key)&&typeof value==='string'&&/^\d+$/.test(value)?BigInt(value):value);
const before=revive(data.before),after=revive(data.after),client=clientFor(DEFAULT_RPC);
if(before.config.scanUniswap!==false||after.config.scanUniswap!==false)throw new Error('This independent verifier covers ENS-only exports. Uniswap verification requires separate position reads.');
const checks:{check:string;pass:boolean}[]=[];
const check=(label:string,pass:boolean)=>checks.push({check:label,pass});
check('Sepolia chain matches evidence',data.chainId===11155111&&await client.getChainId()===11155111);
check('Known workspace wallets retained',same(before.owner,WORKSPACE_OWNER)&&same(after.owner,WORKSPACE_OWNER)&&same(before.subject,WORKSPACE_SUBJECT)&&same(after.subject,WORKSPACE_SUBJECT));
check('Configured scope unchanged',serialize(before.config.targets)===serialize(after.config.targets)&&before.config.scanUniswap===after.config.scanUniswap);
for(const [phase,snapshot] of [['before',before],['after',after]] as const){
  const header=await client.getBlock({blockNumber:snapshot.block});
  check(`${phase}: canonical block hash and timestamp`,header.hash===snapshot.blockHash&&new Date(Number(header.timestamp)*1000).toISOString()===snapshot.timestamp);
  check(`${phase}: all configured scopes present and reads complete`,snapshot.complete&&snapshot.errors.length===0&&snapshot.ens.length===snapshot.config.targets.length);
  const cache=new Map<string,Promise<any>>();
  const read=(address:any,fn:string,args:unknown[]):Promise<any>=>{
    const id=`${address}:${fn}:${serialize(args)}`;
    if(!cache.has(id))cache.set(id,client.readContract({address,abi:ensAbi,functionName:fn,args,blockNumber:snapshot.block} as never));
    return cache.get(id)!;
  };
  for(const entry of snapshot.ens){
    const {target}=entry,resource=BigInt(target.resource);
    const [root,local,ownerRoot,ownerLocal,identity]=await Promise.all([
      read(target.address,'roles',[0n,snapshot.subject]),read(target.address,'roles',[resource,snapshot.subject]),
      read(target.address,'roles',[0n,snapshot.owner]),read(target.address,'roles',[resource,snapshot.owner]),readIdentity(target,read),
    ]);
    check(`${phase}: ${target.label} roles and captured identity`,root===entry.root&&local===entry.local&&ownerRoot===entry.ownerRoot&&ownerLocal===entry.ownerLocal&&serialize(identity)===serialize(entry.identity));
    if(target.kind==='registry'){
      const [owner,expiry,tokenId,operator,canonical]=await Promise.all([read(target.address,'getOwner',[resource]),read(target.address,'getExpiry',[resource]),read(target.address,'getTokenId',[resource]),read(target.address,'isApprovedForAll',[snapshot.owner,snapshot.subject]),read(target.address,'getResource',[resource])]);
      check(`${phase}: ${target.label} ownership, expiry and operator`,same(owner,entry.registryOwner!)&&expiry===entry.expiry&&tokenId===entry.tokenId&&operator===entry.operator&&canonical===resource);
    }else if(target.recordType){
      const [subject,owner]=await Promise.all([read(target.address,'hasRoles',[resource,recordRole(target.recordType),snapshot.subject]),read(target.address,'hasRoles',[resource,recordRole(target.recordType),snapshot.owner])]);
      check(`${phase}: effective record authorization`,subject===entry.subjectCanWrite&&owner===entry.ownerCanWrite);
      if(root)check(`${phase}: owner can revoke reported root roles`,await read(target.address,'hasRoles',[0n,adminMask(root),snapshot.owner]));
    }
  }
  check(`${phase}: remaining path count matches recorded roles`,deriveFindings(snapshot).length===snapshot.findings.length);
}
const receipts=[];
for(const recorded of data.transactions){
  const [tx,receipt]=await Promise.all([client.getTransaction({hash:recorded.hash}),client.getTransactionReceipt({hash:recorded.hash})]);
  const call=decodeFunctionData({abi:ensAbi,data:tx.input});
  const planned=before.findings.find(f=>tx.to&&same(f.address,tx.to)&&f.data===tx.input);
  const valid=receipt.status==='success'&&same(tx.from,before.owner)&&Boolean(planned)&&call.functionName===recorded.functionName&&receipt.blockNumber>before.block&&receipt.blockNumber<=after.block&&receipt.blockNumber===BigInt(recorded.blockNumber)&&receipt.blockHash===recorded.blockHash;
  check('Mined revocation matches reviewed calldata, owner and snapshot interval',valid);
  receipts.push({hash:recorded.hash,status:receipt.status,block:receipt.blockNumber,from:tx.from,to:tx.to,functionName:call.functionName,args:call.args,url:`https://sepolia.etherscan.io/tx/${recorded.hash}`});
}
const ownerChanges=compareOwner(before,after);
check('Captured owner control, records and pointers retained',ownerChanges.length===0&&data.ownerProblems.length===0);
check('Configured permissions absent after recorded revocation',after.findings.length===0&&after.ens.every(e=>e.root===0n&&e.local===0n&&e.operator!==true&&e.subjectCanWrite!==true));
check('Verified export includes a mined revocation and a later snapshot',data.verified===true&&data.signedOffboardingVerified===true&&receipts.length>0&&before.block<after.block);
const result={checkedAt:new Date().toISOString(),sourceFile:basename(path),sourceSha256:createHash('sha256').update(bytes).digest('hex'),beforeBlock:before.block,afterBlock:after.block,passed:checks.every(c=>c.pass),checks,ownerChanges,receipts,scope:'The configured ENS resources only. Uniswap and Chainlink execution were not included in this export.'};
await writeFile('docs/ens-offboarding-verification.json',serialize(result)+'\n');
console.log(serialize(result));if(!result.passed)process.exitCode=1;

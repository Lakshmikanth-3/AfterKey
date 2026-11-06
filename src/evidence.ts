import type { Address, Hash, Hex } from 'viem';
import { compareOwner, type Snapshot } from './engine';

export type EvidenceTransaction={label:string;hash:Hash;status:'pending'|'confirmed'|'failed'|'unverified';submittedHash?:Hash;from?:Address;to?:Address;data?:Hex;value?:bigint;intentVerified?:boolean;functionName?:string;blockNumber?:bigint;blockHash?:Hash};
type Input={before?:Snapshot;after?:Snapshot;transactions:EvidenceTransaction[];ownerProblems:string[];verified:boolean};
export function evidenceReport(input:Input){
  const {before,after,transactions,verified}=input;
  const ownerProblems=[...new Set([...input.ownerProblems,...(before&&after?compareOwner(before,after):[])])];
  const scope=(s:Snapshot)=>JSON.stringify({uniswap:s.config.scanUniswap!==false,targets:s.config.targets.map(t=>[t.address.toLowerCase(),BigInt(t.resource).toString(),t.kind,t.name??'',t.recordType??'',t.argument??'']).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))});
  const comparable=Boolean(before?.complete&&after?.complete&&after.block>=before.block&&before.owner.toLowerCase()===after.owner.toLowerCase()&&before.subject.toLowerCase()===after.subject.toLowerCase()&&scope(before)===scope(after));
  const uniswapIncluded=Boolean(after&&after.config.scanUniswap!==false);
  const matches=(t:EvidenceTransaction,f:Snapshot['findings'][number])=>t.intentVerified===true&&t.status==='confirmed'&&t.from?.toLowerCase()===before?.owner.toLowerCase()&&t.value===0n&&t.functionName===f.fn&&t.to?.toLowerCase()===f.address.toLowerCase()&&t.data?.toLowerCase()===f.data.toLowerCase();
  const confirmedRevocations=transactions.filter(t=>before&&after&&t.blockNumber!==undefined&&t.blockHash&&t.blockNumber>before.block&&t.blockNumber<=after.block&&before.findings.some(f=>matches(t,f)));
  const matchedPaths=before?.findings.filter(f=>confirmedRevocations.some(t=>matches(t,f))).length??0;
  const permissionStateVerified=Boolean(verified&&comparable&&after&&!after.findings.length&&!ownerProblems.length);
  const status=!after||!after.complete?'incomplete':!verified?'baseline':!comparable?'incomplete':ownerProblems.length?'owner_changed':after.findings.length?'access_remaining':'permissions_absent';
  const redact=(s:Snapshot|undefined)=>s?{...s,config:{...s.config,rpc:'[not exported]'}}:undefined;
  return {product:'AfterKey',version:2,chainId:11155111,createdAt:new Date().toISOString(),status,
    method:confirmedRevocations.length?'Live permission reads with confirmed revocation transactions recorded.':'Live permission-state reads. No confirmed revocation transaction is included.',
    coverage:`Explicitly configured ENSv2 contract/resources${uniswapIncluded?' and Uniswap v3 position-manager approvals':''}. Unconfigured resources, alternate wallets and signatures are outside coverage.`,
    protocols:{ensResourceCount:after?.config.targets.length??0,uniswapIncluded,chainlinkExecutionIncluded:false},
    permissionStateVerified,confirmedRevocationCount:confirmedRevocations.length,
    signedOffboardingVerified:permissionStateVerified&&matchedPaths>0&&matchedPaths===before?.findings.length,
    signedReceiptCoverage:{baselinePaths:before?.findings.length??0,matchedPaths,note:'Exact mined owner calls must cover every baseline finding. Missing or legacy receipt details cannot prove a fully owner-signed cleanup.'},
    before:redact(before),after:redact(after),transactions,ownerProblems,verified};
}

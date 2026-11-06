import type { Address, Hash } from 'viem';
import type { Snapshot } from './engine';

export type EvidenceTransaction={label:string;hash:Hash;status:'pending'|'confirmed'|'failed';to?:Address;functionName?:string;blockNumber?:bigint;blockHash?:Hash};
type Input={before?:Snapshot;after?:Snapshot;transactions:EvidenceTransaction[];ownerProblems:string[];verified:boolean};
export function evidenceReport(input:Input){
  const {before,after,transactions,ownerProblems,verified}=input;
  const uniswapIncluded=Boolean(after&&after.config.scanUniswap!==false);
  const confirmedRevocations=transactions.filter(t=>t.status==='confirmed'&&['revokeRootRoles','revokeRoles','approve','setApprovalForAll'].includes(t.functionName||''));
  const scopedReceipts=confirmedRevocations.filter(t=>before&&after&&t.blockNumber!==undefined&&t.blockHash&&t.blockNumber>before.block&&t.blockNumber<=after.block&&before.findings.some(f=>f.fn===t.functionName&&f.address.toLowerCase()===t.to?.toLowerCase()));
  const permissionStateVerified=Boolean(verified&&before&&after?.complete&&!after.findings.length&&!ownerProblems.length);
  const status=!after||!after.complete?'incomplete':!verified?'baseline':ownerProblems.length?'owner_changed':after.findings.length?'access_remaining':'permissions_absent';
  const redact=(s:Snapshot|undefined)=>s?{...s,config:{...s.config,rpc:'[not exported]'}}:undefined;
  return {product:'AfterKey',version:2,chainId:11155111,createdAt:new Date().toISOString(),status,
    method:confirmedRevocations.length?'Live permission reads with confirmed revocation transactions recorded.':'Live permission-state reads. No confirmed revocation transaction is included.',
    coverage:`Explicitly configured ENSv2 contract/resources${uniswapIncluded?' and Uniswap v3 position-manager approvals':''}. Unconfigured resources, alternate wallets and signatures are outside coverage.`,
    protocols:{ensResourceCount:after?.config.targets.length??0,uniswapIncluded,chainlinkExecutionIncluded:false},
    permissionStateVerified,confirmedRevocationCount:confirmedRevocations.length,
    signedOffboardingVerified:permissionStateVerified&&scopedReceipts.length>0,
    before:redact(before),after:redact(after),transactions,ownerProblems,verified};
}

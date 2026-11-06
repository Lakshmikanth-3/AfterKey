import type { GitHubCasePolicy } from './case-policy';
export type CreTarget={label:string;address:string;resource:string;kind:'registry'|'resolver';name?:string;recordType?:'text';argument?:string};
export type Config={authorizedEVMAddress:string;owner:string;subject:string;ensTargets:CreTarget[];maxPositions:number;scanUniswap?:boolean;monitorSchedule?:string;watchApprovals?:boolean;github?:GitHubCasePolicy};
export type PermissionSnapshot={block:string;blockHash:string;owner:string;subject:string;positionCount:string;uniswapIncluded:boolean;operator:boolean;positions:{tokenId:string;owner:string;approved:string;token0:string;token1:string;fee:number;tickLower:number;tickUpper:number;liquidity:string;tokensOwed0:string;tokensOwed1:string}[];ens:{address:string;resource:string;root:string;local:string;ownerRoot:string;ownerLocal:string;nameOwner:string|null;operator:boolean|null;identity?:Record<string,string>;subjectCanWrite?:boolean;ownerCanWrite?:boolean}[];findings:{protocol:string;kind:string;contract:string;resource?:string;roles?:string;tokenId?:string;label?:string}[];complete:boolean};
export function compareSnapshots(before:PermissionSnapshot,after:PermissionSnapshot):string[]{
  const changes:string[]=[];
  if(before.owner.toLowerCase()!==after.owner.toLowerCase()||before.subject.toLowerCase()!==after.subject.toLowerCase())changes.push('Wallet pair changed');
  if(before.uniswapIncluded!==after.uniswapIncluded)changes.push('Uniswap coverage changed');
  if(before.positionCount!==after.positionCount)changes.push('Position count changed');
  for(const p of before.positions){const q=after.positions.find(q=>q.tokenId===p.tokenId);if(!q){changes.push(`Position #${p.tokenId} is missing`);continue;}
    for(const key of ['owner','token0','token1','fee','tickLower','tickUpper','liquidity','tokensOwed0','tokensOwed1'] as const)if(String(p[key]).toLowerCase()!==String(q[key]).toLowerCase())changes.push(`Position #${p.tokenId}: ${key} changed`);
  }
  if(before.ens.length!==after.ens.length)changes.push('ENS coverage changed');
  for(const e of before.ens){const q=after.ens.find(q=>q.address.toLowerCase()===e.address.toLowerCase()&&q.resource===e.resource);
    if(!q){changes.push(`ENS resource missing: ${e.resource}`);continue;}
    if((BigInt(q.ownerRoot)&BigInt(e.ownerRoot))!==BigInt(e.ownerRoot)||(BigInt(q.ownerLocal)&BigInt(e.ownerLocal))!==BigInt(e.ownerLocal))changes.push(`Owner ENS roles changed: ${e.resource}`);
    if(e.nameOwner?.toLowerCase()!==q.nameOwner?.toLowerCase())changes.push(`ENS ownership changed: ${e.resource}`);
    if(e.ownerCanWrite===true&&q.ownerCanWrite!==true)changes.push(`Owner record authority changed: ${e.resource}`);
    if(JSON.stringify(e.identity)!==JSON.stringify(q.identity))changes.push(`ENS identity changed: ${e.resource}`);
  }
  return changes;
}

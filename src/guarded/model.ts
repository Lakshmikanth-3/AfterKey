import { parseAbi } from 'viem';

export const vaultAbi=parseAbi([
  'function owner() view returns (address)', 'function treasury() view returns (address)',
  'function manager() view returns (address)', 'function registry() view returns (address)',
  'function resolver() view returns (address)', 'function tokenId() view returns (uint256)',
  'function nameResource() view returns (uint256)', 'function capabilityResource() view returns (uint256)',
  'function capabilityKey() view returns (string)', 'function label() view returns (string)',
  'function operator() view returns (address)', 'function mandateExpiry() view returns (uint64)',
  'function epoch() view returns (uint256)', 'function paused() view returns (bool)',
  'function canCollect(address account) view returns (bool)',
  'function setOperator(address next,uint64 expiry)', 'function setPaused(bool value)',
  'function collect() returns (uint256 amount0,uint256 amount1)', 'function release()',
]);
export type VaultState={address:string;owner:string;treasury:string;manager:string;registry:string;resolver:string;tokenId:string;nameResource:string;capabilityResource:string;capabilityKey:string;label:string;operator:string;mandateExpiry:string;epoch:string;paused:boolean;custodian:string;subjectCanCollect:boolean;operatorCanCollect:boolean};
export const vaultFields=['owner','treasury','manager','registry','resolver','tokenId','nameResource','capabilityResource','capabilityKey','label','operator','mandateExpiry','epoch','paused'] as const;
export function vaultContinuity(before:VaultState,after:VaultState):string[]{
  const changes:string[]=[];
  for(const field of ['address','owner','treasury','manager','registry','resolver','tokenId','nameResource','capabilityResource','capabilityKey','label','custodian'] as const)
    if(before[field].toLowerCase()!==after[field].toLowerCase())changes.push(`Protected position ${before.tokenId}: ${field} changed`);
  // Operator, expiry, pause and epoch are expected to change during a handover.
  if(BigInt(after.epoch)<BigInt(before.epoch))changes.push('Vault epoch moved backwards');
  return changes;
}

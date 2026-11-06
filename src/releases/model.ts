import {decodeAbiParameters,encodeAbiParameters,parseAbiParameters,keccak256,zeroAddress,type Address,type Hex} from 'viem';
export const configurationParams=parseAbiParameters('address operator,address treasury,address manager,uint64 expiry');
export const reportParams=parseAbiParameters('uint256 chain,address gate,bytes32 digest,uint256 baseEpoch,bytes32 coverage,uint64 until,bool passed');
export type ReleaseConfiguration={operator:Address;treasury:Address;manager:Address;expiry:bigint};
export function encodeConfiguration(c:ReleaseConfiguration):Hex{return encodeAbiParameters(configurationParams,[c.operator,c.treasury,c.manager,c.expiry]);}
export function decodeConfiguration(payload:Hex):ReleaseConfiguration{
  if(payload.length!==258)throw new Error('Candidate must contain four ABI-encoded fields.');
  const [operator,treasury,manager,expiry]=decodeAbiParameters(configurationParams,payload);return {operator,treasury,manager,expiry};
}
export function configurationProblems(c:ReleaseConfiguration,owner:string,manager:string,now:bigint):string[]{
  const eq=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase(),issues:string[]=[];
  if(eq(c.operator,zeroAddress)||eq(c.operator,owner))issues.push('Operator must differ from owner and zero address');
  if(!eq(c.treasury,owner))issues.push('Recipient differs from fixed owner treasury');
  if(!eq(c.manager,manager))issues.push('Position manager differs from approved manager');
  if(c.expiry<=now||c.expiry>now+30n*86400n)issues.push('Mandate must expire within 30 days');
  return issues;
}
export function consumerCoverage(consumers:readonly Address[]):Hex{return keccak256(encodeAbiParameters([{type:'address[]'}],[consumers]));}
export type ImpactIdentity={name:string;resolver:string;recordId:string};
export function affectedNames(source:ImpactIdentity,names:ImpactIdentity[]):string[]{
  if(source.recordId==='0')return []; // No bundle exists; do not label empty records as linked.
  return names.filter(n=>n.resolver.toLowerCase()===source.resolver.toLowerCase()&&n.recordId===source.recordId).map(n=>n.name);
}

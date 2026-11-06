import {parseEventLogs,type Address,type Hash,type Log} from 'viem';
import {POSITION_MANAGER,positionAbi} from './contracts';
const collectedAbi=[{type:'event',name:'Collected',inputs:[{name:'digest',type:'bytes32',indexed:true},{name:'epoch',type:'uint256',indexed:false},{name:'amount0',type:'uint256',indexed:false},{name:'amount1',type:'uint256',indexed:false}]}] as const;
const eq=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
export function verifyReleaseCollectionLogs(logs:Log[],expected:{consumer:Address;tokenId:bigint;recipient:Address;digest:Hash;epoch:bigint}){
  const manager=parseEventLogs({abi:positionAbi,eventName:'Collect',logs}).filter(e=>eq(e.address,POSITION_MANAGER));
  const consumer=parseEventLogs({abi:collectedAbi,eventName:'Collected',logs}).filter(e=>eq(e.address,expected.consumer));
  if(manager.length!==1||consumer.length!==1)throw new Error('Expected exactly one official manager Collect and one consumer Collected event.');
  const m=manager[0].args,v=consumer[0].args;
  if(m.tokenId!==expected.tokenId||!eq(m.recipient,expected.recipient)||!eq(v.digest,expected.digest)||v.epoch!==expected.epoch||m.amount0!==v.amount0||m.amount1!==v.amount1)throw new Error('Collection events differ from the reviewed NFT, recipient, version or amounts.');
  return {tokenId:m.tokenId,recipient:m.recipient,digest:v.digest,epoch:v.epoch,amount0:m.amount0,amount1:m.amount1,zeroCollection:m.amount0===0n&&m.amount1===0n};
}

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeEventTopics,encodeAbiParameters,parseAbi,type Address,type Hash,type Log} from 'viem';
import {verifyReleaseCollectionLogs} from '../src/uniswap/collection-proof';
import {POSITION_MANAGER,positionAbi} from '../src/uniswap/contracts';
const consumer='0x1111111111111111111111111111111111111111' as Address,recipient='0x2222222222222222222222222222222222222222' as Address,digest=('0x'+'a'.repeat(64)) as Hash;
const expected={consumer,recipient,digest,epoch:2n,tokenId:7n};
const consumerAbi=parseAbi(['event Collected(bytes32 indexed digest,uint256 epoch,uint256 amount0,uint256 amount1)']);
function logs(amount0=0n,amount1=0n):Log[]{return [
 {address:POSITION_MANAGER,topics:encodeEventTopics({abi:positionAbi,eventName:'Collect',args:{tokenId:7n}}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[recipient,amount0,amount1])},
 {address:consumer,topics:encodeEventTopics({abi:consumerAbi,eventName:'Collected',args:{digest}}),data:encodeAbiParameters([{type:'uint256'},{type:'uint256'},{type:'uint256'}],[2n,amount0,amount1])},
] as Log[];}
test('collection proof binds official manager, consumer, NFT, owner, version and raw amounts',()=>{
  assert.equal(verifyReleaseCollectionLogs(logs(),expected).zeroCollection,true);
  assert.equal(verifyReleaseCollectionLogs(logs(3n,4n),expected).amount1,4n);
  for(const patch of [{tokenId:8n},{recipient:consumer},{epoch:1n},{digest:('0x'+'b'.repeat(64)) as Hash}])assert.throws(()=>verifyReleaseCollectionLogs(logs(),{...expected,...patch}));
});
test('forged, missing, duplicated and amount-mismatched events fail collection proof',()=>{
  const forged=logs();forged[0].address=consumer;assert.throws(()=>verifyReleaseCollectionLogs(forged,expected));
  assert.throws(()=>verifyReleaseCollectionLogs(logs().slice(1),expected));
  assert.throws(()=>verifyReleaseCollectionLogs([...logs(),logs()[0]],expected));
  const changed=logs(1n,2n);changed[1]=logs(9n,2n)[1];assert.throws(()=>verifyReleaseCollectionLogs(changed,expected));
});

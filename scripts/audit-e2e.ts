import { writeFile } from 'node:fs/promises';
import { decodeFunctionData, parseAbiItem, type Hash } from 'viem';
import { inspectName } from '../src/ens/protocol';
import { ensAbi, factoryAbi } from '../src/ens/abi';
import { clientFor, DEFAULT_RPC, scan, serialize, same } from '../src/engine';
import { WORKSPACE_OWNER, WORKSPACE_SUBJECT } from '../src/workspace';
import { SET_TEXT, resolverResource } from '../src/ens/roles';

const name='treasury-agent.manager.eth',key='agent-context';
const identity=await inspectName(name,DEFAULT_RPC,key);
const child=identity.entries.find(e=>e.name===name),parent=identity.entries.find(e=>e.name==='manager.eth');
if(!child||!parent)throw new Error('The registered operator namespace was not found.');
const config={owner:WORKSPACE_OWNER,subject:WORKSPACE_SUBJECT,rpc:DEFAULT_RPC,targets:identity.targets,scanUniswap:true};
const snapshot=await scan(config);
const client=clientFor(DEFAULT_RPC),fromBlock=12073683n,toBlock=snapshot.block;
const [localLogs,attachment,changes]=await Promise.all([
  client.getLogs({address:[identity.resolver,child.registry],fromBlock,toBlock}),
  client.getLogs({address:parent.registry,event:parseAbiItem('event SubregistryUpdated(uint256 indexed tokenId,address indexed subregistry,address indexed sender)'),args:{subregistry:child.registry,sender:WORKSPACE_OWNER},fromBlock,toBlock}),
  client.getLogs({address:identity.resolver,event:parseAbiItem('event EACRolesChanged(uint256 indexed resource,address indexed account,uint256 oldRoleBitmap,uint256 newRoleBitmap)'),args:{account:WORKSPACE_SUBJECT},fromBlock,toBlock}),
]);
const hashes=[...new Set<Hash>([...localLogs,...attachment].map(l=>l.transactionHash).filter((h):h is Hash=>Boolean(h)))];
const transactions=[];
for(const hash of hashes){
  const [tx,receipt]=await Promise.all([client.getTransaction({hash}),client.getTransactionReceipt({hash})]);
  if(!same(tx.from,WORKSPACE_OWNER)&&!same(tx.from,WORKSPACE_SUBJECT))continue;
  let method='Unrecognized call',args:unknown;
  for(const abi of [ensAbi,factoryAbi])try{const decoded=decodeFunctionData({abi,data:tx.input});method=decoded.functionName;args=decoded.args;break;}catch{}
  transactions.push({hash,url:`https://sepolia.etherscan.io/tx/${hash}`,block:receipt.blockNumber,from:tx.from,to:tx.to,status:receipt.status,method,args});
}
transactions.sort((a,b)=>Number(a.block-b.block));
const resolver=snapshot.ens.find(e=>e.target.kind==='resolver'&&e.target.recordType==='text');
const result={checkedAt:new Date().toISOString(),method:'Real Sepolia reads, mined receipts and operator role-change logs; no transaction submitted',chainId:11155111,block:snapshot.block,blockHash:snapshot.blockHash,owner:WORKSPACE_OWNER,operator:WORKSPACE_SUBJECT,name,key,namespace:{registry:child.registry,resolver:identity.resolver,registeredOwner:child.owner,inspectedAtBlock:identity.block,text:resolver?.identity?.kind==='resolver'?resolver.identity.textValue:identity.text},ens:{broadTextRole:resolver?Boolean(resolver.root&SET_TEXT):null,keyTextRole:resolver?Boolean(resolver.local&SET_TEXT):null,operatorCanEdit:resolver?.subjectCanWrite??null,ownerCanEdit:resolver?.ownerCanWrite??null,offboardingComplete:snapshot.complete&&snapshot.findings.every(f=>f.protocol!=='ENSv2'),remainingFindings:snapshot.findings.map(f=>({title:f.title,protocol:f.protocol,scope:f.scope}))},uniswap:{positionManagerIncluded:true,positionCount:snapshot.positionCount,operatorApproved:snapshot.operator,positionIds:snapshot.positions.map(p=>p.id),signedLifecycleVerified:false},coverage:{complete:snapshot.complete,errors:snapshot.errors},transactions,operatorRoleChanges:changes.map(l=>({hash:l.transactionHash,block:l.blockNumber,scope:l.args.resource===0n?'resolver-wide':l.args.resource===resolverResource('text',key)?'selected-key':'other',old:l.args.oldRoleBitmap,new:l.args.newRoleBitmap})),limits:['Receipt history starts at the known AfterKey resolver deployment block.','No before/after revocation preservation result is claimed while operator access remains.','Zero Uniswap positions is an empty-wallet read, not a position-revocation demonstration.']};
await writeFile('docs/e2e-live-audit.json',serialize(result)+'\n');
console.log(serialize({block:result.block,ens:result.ens,uniswap:result.uniswap,coverage:result.coverage,verifiedTransactions:transactions.map(t=>({method:t.method,hash:t.hash,status:t.status})),operatorRoleChanges:result.operatorRoleChanges}));
if(!snapshot.complete)process.exitCode=1;

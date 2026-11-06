import { encodeFunctionData, getAddress, isAddress, zeroAddress, type Address, type Hex, type Hash } from 'viem';
import { clientFor, same, validateConfig, type Config } from '../engine';
import { positionAbi, positionEconomics, POSITION_MANAGER, tokenAbi, type PositionEconomics } from './contracts';

export type Position=PositionEconomics&{id:bigint;owner:Address;approved:Address;portfolioApproved:boolean;symbol0:string;symbol1:string;decimals0:number;decimals1:number};
export type Portfolio={block:bigint;blockHash:Hash;owner:Address;subject:Address;operator:boolean;count:bigint;positions:Position[];complete:boolean};
export type PositionOperation='delegate-position'|'delegate-portfolio'|'revoke-position'|'revoke-portfolio'|'collect'|'withdraw';
export type PositionRequest={operation:PositionOperation;tokenId?:string;actor:string;liquidity?:string;amount0Min?:string;amount1Min?:string;deadline?:string};
export type PositionAction={label:string;to:Address;data:Hex;actor:Address;request:PositionRequest;position?:Position;block:bigint;owner:Address;subject:Address;warning:string};
export async function readPortfolio(config:Config):Promise<Portfolio>{
  validateConfig(config);
  const c=clientFor(config.rpc);
  if(await c.getChainId()!==11155111)throw new Error('Select an Ethereum Sepolia RPC.');
  const block=await c.getBlockNumber({cacheTime:0}),header=await c.getBlock({blockNumber:block});
  const owner=getAddress(config.owner),subject=getAddress(config.subject);
  const read=(fn:string,args:readonly unknown[])=>c.readContract({address:POSITION_MANAGER,abi:positionAbi,functionName:fn,args,blockNumber:block} as never) as Promise<any>;
  const [count,operator]=await Promise.all([read('balanceOf',[owner]),read('isApprovedForAll',[owner,subject])]) as [bigint,boolean];
  const positions:Position[]=[];
  const metadata=new Map<string,Promise<{symbol:string;decimals:number}>>();
  const token=(address:Address)=>{
    if(!metadata.has(address.toLowerCase()))metadata.set(address.toLowerCase(),(async()=>{
      // Token presentation may fail independently. Do not invent a symbol/decimals.
      const [symbol,decimals]=await Promise.all([c.readContract({address,abi:tokenAbi,functionName:'symbol',blockNumber:block}).catch(()=>address.slice(0,8)),c.readContract({address,abi:tokenAbi,functionName:'decimals',blockNumber:block})]);
      return {symbol,decimals};
    })());
    return metadata.get(address.toLowerCase())!;
  };
  for(let i=0;i<Number(count>50n?50n:count);i++){
    const id=await read('tokenOfOwnerByIndex',[owner,BigInt(i)]);
    const [actualOwner,approved,raw]=await Promise.all([read('ownerOf',[id]),read('getApproved',[id]),read('positions',[id])]);
    if(!same(actualOwner,owner))throw new Error(`Position #${id} changed owner during discovery.`);
    const e=positionEconomics(raw),[t0,t1]=await Promise.all([token(e.token0),token(e.token1)]);
    positions.push({...e,id,owner:getAddress(actualOwner),approved:getAddress(approved),portfolioApproved:operator,symbol0:t0.symbol,symbol1:t1.symbol,decimals0:t0.decimals,decimals1:t1.decimals});
  }
  return {block,blockHash:header.hash,owner,subject,operator,count,positions,complete:count<=50n};
}
const uint=(value:string|undefined,max:bigint,label:string)=>{if(!value||!/^\d+$/.test(value)||BigInt(value)>max)throw new Error(`Enter a valid ${label}.`);return BigInt(value);};
const max128=2n**128n-1n,max256=2n**256n-1n;
export function buildPositionAction(portfolio:Portfolio,request:PositionRequest,now=BigInt(Math.floor(Date.now()/1000))):PositionAction{
  if(!portfolio.complete)throw new Error('The 50-position workspace limit was exceeded. No action prepared.');
  if(!isAddress(request.actor))throw new Error('Select the owner or departing operator as signer.');
  const actor=getAddress(request.actor),owner=portfolio.owner,subject=portfolio.subject;
  if(!same(actor,owner)&&!same(actor,subject))throw new Error('Signer is outside this workspace.');
  const ownerAction=request.operation!=='collect';
  if(ownerAction&&!same(actor,owner))throw new Error('This action must be signed by the asset owner.');
  let p:Position|undefined;
  if(!['delegate-portfolio','revoke-portfolio'].includes(request.operation)){
    const id=uint(request.tokenId,max256,'position token ID');
    p=portfolio.positions.find(p=>p.id===id);
    if(!p||!same(p.owner,owner))throw new Error('Position is not owned by this workspace.');
  }
  const encode=(fn:string,args:readonly unknown[])=>encodeFunctionData({abi:positionAbi,functionName:fn,args} as never);
  let data:Hex,label:string,warning='';
  switch(request.operation){
    case 'delegate-position':
      if(!same(p!.approved,zeroAddress)&&!same(p!.approved,subject))throw new Error('Another wallet already has this position approval. Review it before replacing.');
      if(same(p!.approved,subject))throw new Error('This position approval is already active.');
      data=encode('approve',[subject,p!.id]);label=`Delegate position #${p!.id}`;warning='ERC-721 approval allows managing and transferring this NFT. It is not limited to collecting fees.';break;
    case 'delegate-portfolio':
      if(portfolio.operator)throw new Error('Portfolio approval is already active.');
      data=encode('setApprovalForAll',[subject,true]);label='Delegate all current and future positions';warning='This approval also allows transferring every position in this manager, including future positions.';break;
    case 'revoke-position':
      if(!same(p!.approved,subject))throw new Error('There is no individual approval for this operator on this position.');
      data=encode('approve',[zeroAddress,p!.id]);label=`Remove position #${p!.id} approval`;warning=portfolio.operator?'Portfolio approval still authorizes this operator. Complete offboarding removes both paths.':'';break;
    case 'revoke-portfolio':
      if(!portfolio.operator)throw new Error('Portfolio approval is already absent.');
      data=encode('setApprovalForAll',[subject,false]);label='Remove portfolio approval';warning='Individual position approvals are independent. Scan all access paths after confirmation.';break;
    case 'collect':
      if(!same(actor,owner)&&!portfolio.operator&&!same(p!.approved,actor))throw new Error('Operator has no live authorization to collect from this position.');
      data=encode('collect',[{tokenId:p!.id,recipient:owner,amount0Max:max128,amount1Max:max128}]);label=`Collect position #${p!.id} to owner`;warning='Collects owed tokens, which may include previously removed principal. The recipient is fixed to the owner. Actual amounts come from the receipt.';break;
    case 'withdraw':{
      const liquidity=uint(request.liquidity,max128,'liquidity amount');
      const amount0Min=uint(request.amount0Min,max256,'token 0 minimum'),amount1Min=uint(request.amount1Min,max256,'token 1 minimum');
      const deadline=uint(request.deadline,max256,'deadline');
      if(!liquidity||liquidity>p!.liquidity)throw new Error('Withdrawal must be positive and within the current liquidity.');
      if(amount0Min===0n&&amount1Min===0n)throw new Error('Set at least one positive token minimum to protect the withdrawal.');
      if(deadline<=now||deadline>now+900n)throw new Error('Withdrawal deadline must be within the next 15 minutes.');
      data=encode('multicall',[[encode('decreaseLiquidity',[{tokenId:p!.id,liquidity,amount0Min,amount1Min,deadline}]),encode('collect',[{tokenId:p!.id,recipient:owner,amount0Max:max128,amount1Max:max128}])]]);
      label=`Withdraw liquidity from #${p!.id} to owner`;warning='Atomically decreases the reviewed liquidity and collects to the owner. The NFT remains owned by the team. Token minimums are your limits, not a price quote.';break;
    }
    default:throw new Error('Unsupported position operation.');
  }
  return {label,to:POSITION_MANAGER,data,actor,request:{...request},position:p,block:portfolio.block,owner,subject,warning};
}
export async function preparePositionAction(config:Config,request:PositionRequest){return buildPositionAction(await readPortfolio(config),request);}
export function samePositionAction(a:PositionAction,b:PositionAction):boolean{
  return same(a.actor,b.actor)&&same(a.owner,b.owner)&&same(a.subject,b.subject)&&same(a.to,b.to)&&a.data===b.data&&a.position?.liquidity===b.position?.liquidity&&a.position?.approved===b.position?.approved&&a.position?.portfolioApproved===b.position?.portfolioApproved;
}

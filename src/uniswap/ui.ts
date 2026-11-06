import { formatUnits, parseEventLogs, type TransactionReceipt } from 'viem';
import { errorText, serialize, short, type Config } from '../engine';
import { withReadDeadline } from '../ens/read-deadline';
import { positionAbi, POSITION_MANAGER } from './contracts';
import { preparePositionAction, readPortfolio, type Portfolio, type PositionAction, type PositionOperation } from './positions';
import { parseTokenMinimum } from './amounts';
import { positionSetupGuide, bindPositionSetupGuide } from './setup-guide';

type Context={config:Config;busy:boolean;render:()=>void;task:(label:string,action:()=>Promise<void>)=>Promise<void>;send:(action:PositionAction)=>Promise<TransactionReceipt>;offboard:()=>void};
const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
let portfolio:Portfolio|undefined,prepared:PositionAction|undefined,reviewed=false,feedback='';
let workspaceKey='';
let operation:PositionOperation='delegate-position',tokenId='',actor='owner',liquidity='',min0='',min1='';
let tab:'positions'|'manage'|'proof'='positions';
type ReceiptProof={operation:string;hash:string;block:string;signer:string;tokenId?:string;events:unknown[]};
let receipts:ReceiptProof[]=[];
try{receipts=JSON.parse(localStorage.getItem('afterkey.uniswap.receipts.v1')||'[]');}catch{}
const options:Record<PositionOperation,string>={'delegate-position':'Delegate one position','delegate-portfolio':'Delegate all positions','revoke-position':'Remove one approval','revoke-portfolio':'Remove portfolio approval',collect:'Collect to owner',withdraw:'Withdraw liquidity to owner'};
export function uniswapWorkspace(ctx:Context):string{
  const key=JSON.stringify([ctx.config.owner.toLowerCase(),ctx.config.subject.toLowerCase(),ctx.config.rpc]);
  if(key!==workspaceKey){portfolio=undefined;prepared=undefined;reviewed=false;feedback='';workspaceKey=key;}
  const p=portfolio?.positions.find(p=>String(p.id)===tokenId);
  return `<div class="simple-heading"><div class="eyebrow">UNISWAP v3 / DELEGATED LIQUIDITY</div><h1>Keep the position.<br/>Change who operates it<span>.</span></h1><p>Delegate, collect and offboard against the official Sepolia position manager.</p></div>
  <div class="ens-tabs" role="tablist">${(['positions','manage','proof'] as const).map(t=>`<button data-uni-tab="${t}" class="${t===tab?'active':''}" ${ctx.busy?'disabled':''}>${t==='positions'?'Your positions':t==='manage'?'Manage access & liquidity':'Transaction proof'}</button>`).join('')}</div>
  <section class="settings-card"><div class="section-number">${tab==='positions'?'01 / DISCOVER':tab==='manage'?'02 / REVIEW & SIGN':'03 / VERIFY'}</div>
  ${tab==='positions'?`<h2>Team liquidity</h2>${positionSetupGuide()}<p>Owner ${esc(short(ctx.config.owner))} · Operator ${esc(short(ctx.config.subject))}</p><div class="ens-controls"><button class="button primary" id="uni-read" ${ctx.busy?'disabled':''}>Read live positions</button><a class="button" href="https://app.uniswap.org/positions/add/new?protocolVersion=v3&chain=ethereum_sepolia&currencyA=NATIVE&currencyB=0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" target="_blank" rel="noreferrer">Create a Sepolia position ↗</a></div>
  ${portfolio?`<p>Block ${portfolio.block} · ${portfolio.count} positions · Portfolio approval ${portfolio.operator?'ACTIVE':'absent'}</p>${!portfolio.complete?'<p class="blocked">More than 50 positions. Workspace coverage is incomplete.</p>':''}${!portfolio.count?'<div class="target-empty"><h3>No v3 position owned by this wallet</h3><p>Create a real Sepolia v3 position in Uniswap, then refresh here. You need both test tokens and Sepolia ETH. An ENS registration does not create a liquidity position.</p></div>':portfolio.positions.map(q=>`<article class="uni-position"><div><h3>${esc(q.symbol0)} / ${esc(q.symbol1)} <span class="chip">${q.fee/10000}%</span></h3><a href="https://sepolia.etherscan.io/nft/${POSITION_MANAGER}/${q.id}" target="_blank" rel="noreferrer">Position #${q.id} ↗</a></div><dl class="protocol-metrics"><div><dt>Liquidity units</dt><dd>${q.liquidity}</dd></div><div><dt>Tick range</dt><dd>${q.tickLower} → ${q.tickUpper}</dd></div><div><dt>Recorded owed ${esc(q.symbol0)}</dt><dd>${q.decimals0===null?`${q.tokensOwed0} base units (decimals unavailable)`:formatUnits(q.tokensOwed0,q.decimals0)}</dd></div><div><dt>Recorded owed ${esc(q.symbol1)}</dt><dd>${q.decimals1===null?`${q.tokensOwed1} base units (decimals unavailable)`:formatUnits(q.tokensOwed1,q.decimals1)}</dd></div></dl><p>Individual approval: ${esc(short(q.approved))} · Owner: ${esc(short(q.owner))}</p><button class="button" data-uni-position="${q.id}">Manage this position →</button></article>`).join('')}<p class="muted-note">Recorded owed amounts exclude fees not yet checkpointed and may include removed principal. They are not a live fee quote or a USD valuation.</p><button class="button" id="uni-export-portfolio">Export position snapshot</button>`:''}`:
  tab==='manage'?`<h2>Review one operation</h2><div class="ens-input-row"><label>Operation<select id="uni-operation">${Object.entries(options).map(([v,l])=>`<option value="${v}" ${operation===v?'selected':''}>${l}</option>`).join('')}</select></label><label>Position token ID<input id="uni-token" inputmode="numeric" value="${esc(tokenId)}" placeholder="Select from Your positions"/></label><label>Signing wallet<select id="uni-actor"><option value="owner" ${actor==='owner'?'selected':''}>Owner · ${short(ctx.config.owner)}</option><option value="operator" ${actor==='operator'?'selected':''}>Operator · ${short(ctx.config.subject)}</option></select></label></div>
  ${operation==='withdraw'?`<div class="ens-input-row"><label>Liquidity units to remove<input id="uni-liquidity" value="${esc(liquidity)}" placeholder="Positive integer, not a token amount"/></label><label>Minimum ${esc(p?.symbol0||'token 0')} received<input id="uni-min0" value="${esc(min0)}" placeholder="Token amount"/></label><label>Minimum ${esc(p?.symbol1||'token 1')} received<input id="uni-min1" value="${esc(min1)}" placeholder="Token amount"/></label></div><p class="muted-note">Use token minimums you accept. At least one must be positive. The review expires in ten minutes. Liquidity withdrawal is an owner action.</p>`:''}
  <div class="ens-controls"><button class="button primary" id="uni-prepare" ${ctx.busy?'disabled':''}>Check live state & prepare</button><button class="button" id="uni-offboard" ${ctx.busy?'disabled':''}>Scan every access path →</button></div>
  ${prepared?`<div class="ens-action"><h3>${esc(prepared.label)}</h3><p>${esc(prepared.warning)}</p><p>Signer ${esc(prepared.actor)} · Read at block ${prepared.block}</p>${prepared.request.operation==='withdraw'?`<p>Remove ${esc(prepared.request.liquidity)} liquidity units · minimums ${esc(min0)} / ${esc(min1)} · deadline ${new Date(Number(prepared.request.deadline)*1000).toLocaleTimeString()}</p>`:''}<details><summary>Review destination and calldata</summary><code class="calldata">${prepared.to}<br/>${prepared.data}</code></details><label class="review-check"><input id="uni-review" type="checkbox" ${reviewed?'checked':''}/>I reviewed the signer, permissions, recipient and exact operation.</label><button class="button primary" id="uni-send" ${ctx.busy||!reviewed?'disabled':''}>Sign this operation</button></div>`:''}`:
  `<h2>Confirmed Uniswap operations</h2>${receipts.length?receipts.map(r=>`<article class="uni-position"><h3>${esc(r.operation)}</h3><a href="https://sepolia.etherscan.io/tx/${esc(r.hash)}" target="_blank" rel="noreferrer">${esc(short(r.hash))} ↗</a><p>Block ${esc(r.block)} · Signer ${esc(short(r.signer))}</p>${r.events.length?`<pre>${esc(serialize(r.events))}</pre>`:''}</article>`).join(''):'<p>No confirmed operations have been recorded in this browser.</p>'}<button class="button" id="uni-export">Export transaction evidence</button>`}
  ${feedback?`<div id="uni-feedback" class="operator-feedback" role="status">${esc(feedback)}</div>`:''}</section>`;
}
export function bindUniswapWorkspace(ctx:Context){
  bindPositionSetupGuide();
  const capture=()=>{const val=(id:string,fallback:string)=>document.querySelector<HTMLInputElement>(`#${id}`)?.value??fallback;operation=val('uni-operation',operation) as PositionOperation;tokenId=val('uni-token',tokenId).trim();actor=val('uni-actor',actor);liquidity=val('uni-liquidity',liquidity);min0=val('uni-min0',min0);min1=val('uni-min1',min1);};
  const on=(id:string,fn:()=>void)=>{const el=document.getElementById(id);if(el)el.onclick=fn;};
  const work=(label:string,fn:()=>Promise<void>)=>{feedback=`${label}…`;void ctx.task(label,async()=>{try{await fn();}catch(e){feedback=errorText(e);throw e;}});};
  document.querySelectorAll<HTMLButtonElement>('[data-uni-tab]').forEach(b=>b.onclick=()=>{capture();tab=b.dataset.uniTab as typeof tab;prepared=undefined;reviewed=false;ctx.render();});
  document.querySelectorAll<HTMLButtonElement>('[data-uni-position]').forEach(b=>b.onclick=()=>{tokenId=b.dataset.uniPosition!;tab='manage';prepared=undefined;ctx.render();});
  ['uni-operation','uni-token','uni-actor','uni-liquidity','uni-min0','uni-min1'].forEach(id=>{const e=document.getElementById(id);e?.addEventListener('change',()=>{capture();prepared=undefined;reviewed=false;ctx.render();});});
  on('uni-read',()=>work('Reading live Uniswap positions',async()=>{portfolio=await withReadDeadline(readPortfolio(ctx.config));feedback=`Live portfolio loaded at block ${portfolio.block}.`; }));
  on('uni-prepare',()=>{capture();prepared=undefined;reviewed=false;work('Checking live position permissions',async()=>{
    portfolio=await withReadDeadline(readPortfolio(ctx.config));
    const p=portfolio.positions.find(p=>String(p.id)===tokenId);
    if(operation==='withdraw'&&!p)throw new Error('Read and select an owned position first.');
    const request={operation,tokenId,actor:actor==='owner'?ctx.config.owner:ctx.config.subject,...(operation==='withdraw'?{liquidity,amount0Min:String(parseTokenMinimum(min0,p!.decimals0,'Token 0 minimum')),amount1Min:String(parseTokenMinimum(min1,p!.decimals1,'Token 1 minimum')),deadline:String(Math.floor(Date.now()/1000)+600)}:{})};
    prepared=await withReadDeadline(preparePositionAction(ctx.config,request));feedback='Live state checked. Review the operation, then sign in your wallet.';
  });});
  const review=document.querySelector<HTMLInputElement>('#uni-review');if(review)review.onchange=()=>{reviewed=review.checked;ctx.render();};
  on('uni-send',()=>{if(!prepared||!reviewed)return;const action=prepared;work('Confirming the reviewed Uniswap operation',async()=>{
    const receipt=await ctx.send(action);
    const events=parseEventLogs({abi:positionAbi,logs:receipt.logs.filter(l=>l.address.toLowerCase()===POSITION_MANAGER.toLowerCase()),strict:false}).map(e=>({event:e.eventName,args:e.args}));
    receipts.unshift({operation:action.label,hash:receipt.transactionHash,block:String(receipt.blockNumber),signer:action.actor,tokenId:action.request.tokenId,events});
    try{localStorage.setItem('afterkey.uniswap.receipts.v1',serialize(receipts.slice(0,50)));}catch{}
    prepared=undefined;reviewed=false;feedback=`Confirmed at block ${receipt.blockNumber}. Transaction proof saved. Refresh positions to read the new state.`;
  });});
  on('uni-offboard',ctx.offboard);
  const exportJson=(name:string,data:unknown)=>{const u=URL.createObjectURL(new Blob([serialize(data)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
  on('uni-export',()=>exportJson('afterkey-uniswap-operations.json',{chainId:11155111,manager:POSITION_MANAGER,receipts}));
  on('uni-export-portfolio',()=>exportJson('afterkey-uniswap-snapshot.json',{chainId:11155111,manager:POSITION_MANAGER,portfolio}));
}

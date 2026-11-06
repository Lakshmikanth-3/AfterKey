import {releaseWorkspace,bindReleaseWorkspace} from './releases/ui';
import releaseGateArtifact from './releases/ENSReleaseGate.json';
import releaseConsumerArtifact from './releases/ReleaseLPVault.json';
import { evidenceReport, type EvidenceTransaction } from './evidence';
import { waitForReviewedReceipt, type ReviewedCall } from './transactions';
import { walletDiscovery, selectWallet, type WalletProvider, type WalletChoice } from './wallet';
import { accessEvidence } from './ens/evidence-ui';
import { prepareRecordWrite, sameRecordWrite, type RecordWrite } from './ens/operator';
import './style.css';
import './design.css';
import './studio.css';
import { createIcons, ArrowUpRight, ArrowRight, ShieldCheck, KeyRound, ScanLine, Settings2, History, Wallet, ChevronRight, Check, Circle, Plus, X, Download, ExternalLink, RefreshCw, LoaderCircle, LockKeyhole, Layers, AlertTriangle, Copy, LogOut } from 'lucide';
import { createWalletClient, custom, getAddress, isAddress, zeroAddress, type Address, type Hash } from 'viem';
import { sepolia } from 'viem/chains';
import { WORKSPACE_OWNER, WORKSPACE_SUBJECT } from './workspace';
import { DEFAULT_RPC, POSITION_MANAGER, scan, clientFor, same, short, serialize, compareOwner, errorText, type Config, type Snapshot } from './engine';
import { ensWorkspace, bindEnsWorkspace } from './ens/ui';
import type { SetupAction } from './ens/protocol';
import creDeployment from '../cre/deployment.json';
import { uniswapWorkspace, bindUniswapWorkspace } from './uniswap/ui';
import { preparePositionAction, samePositionAction, type PositionAction } from './uniswap/positions';
import { creWorkspace, bindCreWorkspace } from './cre/ui';
import { guardedWorkspace, bindGuardedWorkspace, type VaultRequest } from './guarded/ui';
import { prepareVaultAction, prepareVaultDeployment, readVault } from './guarded/client';
import vaultArtifact from './guarded/artifact.json';
import { encodeDeployData } from 'viem';

declare global { interface Window { ethereum?:WalletProvider } }
const wallets=walletDiscovery(window,()=>window.ethereum);
let selectedWallet:WalletChoice|undefined;
let unbindWallet:()=>void=()=>{};
const app=document.querySelector<HTMLDivElement>('#app')!;
const icons={ArrowUpRight,ArrowRight,ShieldCheck,KeyRound,ScanLine,Settings2,History,Wallet,ChevronRight,Check,Circle,Plus,X,Download,ExternalLink,RefreshCw,LoaderCircle,LockKeyhole,Layers,AlertTriangle,Copy,LogOut};
const icon=(name:string,cls='')=>`<i data-lucide="${name}" class="${cls}"></i>`;
const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
let config:Config={owner:WORKSPACE_OWNER,subject:WORKSPACE_SUBJECT,rpc:DEFAULT_RPC,targets:[]};
try { const stored=localStorage.getItem('afterkey.config.v1'); if(stored) config={...config,...JSON.parse(stored)}; }catch{}
if(!config.owner)config.owner=WORKSPACE_OWNER;
if(!config.subject)config.subject=WORKSPACE_SUBJECT;
if(config.scanUniswap===undefined)config.scanUniswap=false;
let account:Address|undefined;
let view:'releases'|'ens'|'uniswap'|'guarded'|'cre'|'offboard'|'settings'|'history'='releases';
let busy=false,busyText='',error='',notice='';
let before:Snapshot|undefined, current:Snapshot|undefined;
let reviewed=false, verified=false, ownerProblems:string[]=[];
let transactions:EvidenceTransaction[]=[];
let selected=new Set<string>();
const storedReports=()=>{try{return JSON.parse(localStorage.getItem('afterkey.reports.v1')||'[]') as any[];}catch{return [];}};
const persist=()=>localStorage.setItem('afterkey.config.v1',JSON.stringify(config));
function download(name:string,data:unknown){const url=URL.createObjectURL(new Blob([serialize(data)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function report(){return evidenceReport({before,after:current,transactions,ownerProblems,verified});}
function clearScan(){before=undefined;current=undefined;verified=false;reviewed=false;ownerProblems=[];selected.clear();transactions=[];}
function render(){
  app.innerHTML=`<div class="topnav ${window.scrollY>50?'scrolled':''}"><a class="brand" href="#" aria-label="AfterKey home"><img src="/logo.svg" alt=""/><span>afterkey<span class="brand-dot">.</span></span></a><nav aria-label="Workspace navigation">${(['releases','settings'] as const).map(v=>`<button data-view="${v}" class="${view===v?'active':''}" ${busy?'disabled':''}>${v==='releases'?'Workflow':'Connection'}</button>`).join('')}</nav><button class="button wallet-button" id="connect">${icon('wallet')}${account?`${esc(selectedWallet?.name||'Wallet')} · ${short(account)}`:'Connect wallet'}</button></div><div class="shell"><main>
  ${error?`<div role="alert" class="banner danger">${icon('alert-triangle')}<span>${esc(error)}</span><button data-dismiss="error" aria-label="Dismiss error">${icon('x')}</button></div>`:''}
  ${notice?`<div role="status" class="banner">${icon('check')}<span>${esc(notice)}</span><button data-dismiss="notice" aria-label="Dismiss notification">${icon('x')}</button></div>`:''}
  ${view==='releases'?releaseWorkspace(releaseContext()):view==='ens'?ensWorkspace(ensContext()):view==='uniswap'?uniswapWorkspace(uniswapContext()):view==='guarded'?guardedWorkspace(guardedContext()):view==='cre'?creWorkspace(creContext()):view==='settings'?settingsView():view==='history'?historyView():offboardView()}
  <footer><span>${icon('lock-keyhole')} Your keys stay in your wallet. Every transaction needs your signature.</span><div class="brand-strip"><a href="https://ens.domains" target="_blank" rel="noreferrer"><img src="/brands/ens.svg" alt="ENS"/><span>ENSv2</span></a><a href="https://chain.link/cross-chain/cre" target="_blank" rel="noreferrer"><img src="/brands/chainlink.svg" alt="Chainlink"/><span>CRE</span></a><a href="https://uniswap.org" target="_blank" rel="noreferrer"><img src="/brands/uniswap.svg" alt="Uniswap"/><span>Uniswap</span></a></div></footer></main></div>${busy?`<div class="working" role="status">${icon('loader-circle','spin')}<span>${esc(busyText)}</span></div>`:''}`;
  createIcons({icons});bind();bindReleaseWorkspace(releaseContext());bindEnsWorkspace(ensContext());bindUniswapWorkspace(uniswapContext());bindCreWorkspace(creContext());bindGuardedWorkspace(guardedContext());
  if(view==='uniswap'&&(config.guardedVaults?.length??0)>0){
    const tabs=document.querySelector('.ens-tabs');
    if(tabs){const button=document.createElement('button');button.textContent='Existing protected vaults';button.disabled=busy;button.onclick=()=>{view='guarded';render();};tabs.append(button);}
  }
  if(view==='guarded'){
    const tabs=document.querySelector('.ens-tabs');
    if(tabs){const button=document.createElement('button');button.textContent='Wallet positions';button.disabled=busy;button.onclick=()=>{view='uniswap';render();};tabs.prepend(button);}
  }
}
function offboardView(){
  const stage=verified?4:transactions.length?3:current?2:1;
  const count=current?.findings.length;
  return `<div class="page-heading"><div><div class="eyebrow">ACCESS ENDS HERE</div><h1>Close the doors<br/>they left open<span>.</span></h1><p>Find surviving permissions. Revoke with confidence.<br class="desktop-break"/> Check what remains, directly on chain.</p></div><div class="heading-mark">${icon('shield-check')}<span>LESS TRUST.<br/>MORE EVIDENCE.</span></div></div>
  <div class="steps">${['Identify wallet','Find access paths',verified&&!transactions.length?'No revocations needed':'Revoke permissions','Verify on chain'].map((label,i)=>`<div class="step ${stage===i+1?'current':stage>i+1?'done':''}"><span>${stage>i+1?icon('check'):String(i+1).padStart(2,'0')}</span>${label}${i<3?'<div class="step-line"></div>':''}</div>`).join('')}</div>
  <section class="setup-card"><div class="section-heading"><div><h2>${icon('wallet')} Who is leaving?</h2><p>Scan the departing wallet against your workspace’s assets.</p></div><span class="chip">LIVE CHAIN READS</span></div><div class="wallet-fields"><label>Asset owner <span>YOUR TEAM WALLET</span><input id="owner" placeholder="0x… owner wallet address" value="${esc(config.owner)}" ${busy?'disabled':''}/></label><div class="field-arrow">${icon('arrow-right')}</div><label>Departing wallet <span>ACCESS TO REMOVE</span><input id="subject" placeholder="0x… teammate or agent address" value="${esc(config.subject)}" ${busy?'disabled':''}/></label><button class="button primary scan-button" id="scan" ${busy?'disabled':''}>${icon(busy?'loader-circle':'scan-line',busy?'spin':'')}Scan access paths</button></div><div class="setup-foot"><span>${icon('layers')}${config.targets.length?`${config.targets.length} ENSv2 resources`:'ENSv2 not configured'} <label class="protocol-toggle"><input id="include-uniswap" type="checkbox" ${config.scanUniswap!==false?'checked':''} ${busy?'disabled':''}/> Include Uniswap v3</label></span><button class="text-button" data-view="settings">Manage scope ${icon('arrow-up-right')}</button></div></section>
  <div class="results-layout"><div class="results-main"><div class="results-title"><h2>Access paths ${current?`<span>${count}</span>`:''}</h2><span>${current?`Block ${current.block.toLocaleString()}`:'Awaiting your first scan'}</span></div>
  ${current?resultsView():`<section class="empty-state"><div class="orbit"><span></span>${icon('scan-line')}</div><h3>Know what access really remains.</h3><p>Enter two wallets to inspect operator approvals<br/>and your configured ENS permissions.</p><div class="empty-protocols"><span><b class="protocol-dot uni"><img src="/brands/uniswap.svg" alt=""/></b>Uniswap v3</span><span><b class="protocol-dot ens"><img src="/brands/ens.svg" alt=""/></b>ENSv2</span></div><div class="empty-foot">No sample findings. Your report starts with live data.</div></section>`}
  </div><aside class="summary-card"><div class="summary-heading">${icon('shield-check')} OFFBOARDING SUMMARY</div><div class="summary-metric">${current&&!current.complete?'—':count??'—'}<span>surviving access paths</span></div><div class="summary-rows"><div><span>Positions checked</span><b>${current?(current.config.scanUniswap===false?'Excluded':`${current.positions.length} / ${current.positionCount}`):'—'}</b></div><div><span>ENS resources checked</span><b>${current?`${current.ens.length} / ${config.targets.length}`:'—'}</b></div><div><span>Coverage</span><b class="${current&&!current.complete?'amber':''}">${current?(current.complete?'Configured scope':'Incomplete'):'Not scanned'}</b></div><div><span>Owner permissions</span><b>${verified?(ownerProblems.length?'Changed':current?.complete?'Retained':'Incomplete'):'Not rechecked'}</b></div></div><div class="scope-note">${icon('circle')}<p>A report covers the listed contracts and resources at the recorded block. It does not establish universal loss of access.</p></div>${current?`<button class="button export-button" id="export">${icon('download')}Export evidence</button>`:''}<div class="summary-bottom">${icon('lock-keyhole')}Review. Sign. Verify.</div></aside></div>
  ${transactions.length?`<section class="transactions"><h2>Transaction activity</h2>${transactions.map(t=>`<a href="https://sepolia.etherscan.io/tx/${t.hash}" target="_blank" rel="noreferrer"><span class="tx-status ${t.status}">${icon(t.status==='confirmed'?'check':t.status==='failed'?'x':t.status==='unverified'?'circle-alert':'loader-circle')}</span><span>${esc(t.label)}<small>${short(t.hash)}</small></span><b>${t.status}</b>${icon('external-link')}</a>`).join('')}</section>`:''}`;
}
function resultsView(){
  if(!current)return '';
  return `${current.errors.length?`<div class="coverage-error"><b>Some reads could not be completed</b>${current.errors.map(e=>`<p>${esc(e)}</p>`).join('')}</div>`:''}
  ${verified?`<div class="verification ${current.findings.length||!current.complete||ownerProblems.length?'partial':'passed'}">${icon(current.findings.length||!current.complete||ownerProblems.length?'alert-triangle':'shield-check')}<div><h3>${current.complete&&!current.findings.length&&!ownerProblems.length?'Configured permissions absent':'Verification needs attention'}</h3><p>${current.findings.length} paths remain. ${ownerProblems.length?esc(ownerProblems.join(' ')):'Owner ownership, recorded role checks and captured identity values retained.'} Permission-state verification at block ${current.block}.</p></div></div>`:''}
  ${accessEvidence(current,verified?before:undefined)}
  ${current.guarded?.length?`<section class="ens-state-checks"><h3>Protected LP coverage · block ${current.block}</h3>${current.guarded.map(({state:v})=>`<div><a href="https://sepolia.etherscan.io/address/${v.address}" target="_blank" rel="noreferrer">Position #${esc(v.tokenId)} · ${short(v.address)} ↗</a><b>Departing operator: ${v.subjectCanCollect?'can collect':'denied'}</b><b>Epoch ${esc(v.epoch)} · ${v.paused?'paused':'unpaused'}</b></div>`).join('')}<p>Vault custody and position economics are included in the before/after checks.</p></section>`:''}
  ${current.ens.some(e=>e.target.recordType)?`<section class="ens-state-checks"><h3>Live ENS authorization · block ${current.block}</h3>${current.ens.filter(e=>e.target.recordType).map(e=>`<div><span>${esc(e.target.label)}</span><b>Departing wallet: ${e.subjectCanWrite===true?'role active':e.subjectCanWrite===false?'role absent':'unknown'}</b><b>Owner: ${e.ownerCanWrite===true?'role active':e.ownerCanWrite===false?'role absent':'unknown'}</b></div>`).join('')}<p>Read through hasRoles on the live resolver. This checks authorization state, not a simulated record write.</p></section>`:''}
  ${current.findings.map(f=>`<article class="finding"><div class="finding-top"><span class="protocol-label"><b class="protocol-dot ${f.protocol==='Uniswap v3'?'uni':'ens'}"><img src="/brands/${f.protocol==='Uniswap v3'?'uniswap':'ens'}.svg" alt=""/></b>${f.protocol}</span><span class="severity ${f.broad?'broad':''}">${f.broad?'BROAD ACCESS':'DIRECT ACCESS'}</span></div><div class="finding-body"><div><h3>${esc(f.title)}</h3><p>${esc(f.detail)}</p></div><label class="select-path" title="Include in revocation"><input type="checkbox" data-select="${esc(f.id)}" ${selected.has(f.id)?'checked':''} ${!f.executable||busy?'disabled':''}/><span class="sr-only">Select ${esc(f.title)}</span></label></div><div class="finding-foot"><span>${icon('layers')}${esc(f.scope)}</span><a href="https://sepolia.etherscan.io/address/${f.address}" target="_blank" rel="noreferrer">${short(f.address)} ${icon('arrow-up-right')}</a></div>${!f.executable?`<p class="blocked">${icon('alert-triangle')}${esc(f.blockedReason)}</p>`:''}</article>`).join('')}
  ${!current.findings.length?`<div class="clean-state">${icon('shield-check')}<h3>${current.complete?'No access paths found in this scope':'No findings from completed reads'}</h3><p>${current.complete?'No operator approvals or configured ENS roles were found for this wallet.':'Resolve the read errors before drawing a conclusion.'}</p></div>`:''}
  ${current.findings.length?`<section class="review-card"><div><h3>Review revocation plan</h3><p>Broad approvals first, followed by individual permissions. Each transaction is signed separately.</p></div><div class="plan-list">${current.findings.filter(f=>selected.has(f.id)).map((f,i)=>`<details><summary><span>${i+1}</span><code>${f.fn}()</code><small>${f.protocol}</small></summary><code class="calldata">To: ${f.address}<br/>Data: ${f.data}</code></details>`).join('')||'<p>Select access paths to prepare a plan.</p>'}</div><label class="review-check"><input id="review" type="checkbox" ${reviewed?'checked':''}/><span>I reviewed these ${selected.size} revocations for ${short(config.subject)}. My wallet will ask me to sign each transaction.</span></label><button class="button primary" id="revoke" ${busy||!reviewed||!selected.size||!current.complete?'disabled':''}>${icon('key-round')}Revoke ${selected.size} selected paths ${icon('arrow-right')}</button>${!current.complete?'<p class="blocked">Resolve incomplete reads before executing this plan.</p>':''}</section>`:''}
  <button class="button recheck" id="verify" ${busy?'disabled':''}>${icon('refresh-cw')}Recheck live permissions</button>`;
}
function settingsView(){return `<div class="simple-heading"><div class="eyebrow">SEPOLIA CONNECTION</div><h1>Your wallet and network<span>.</span></h1><p>Use the owner wallet for setup and activation. Use the operator wallet for collection.</p></div><section class="settings-card"><h2>Wallets</h2><div class="ens-input-row"><label>Owner<input id="owner" value="${esc(config.owner)}"/></label><label>Operator<input id="subject" value="${esc(config.subject)}"/></label></div><p>Signatures stay in MetaMask. No private keys are entered here.</p><details><summary>RPC connection</summary><label>Sepolia RPC URL<input id="rpc" type="url" value="${esc(config.rpc)}"/></label><p>RPC credentials remain in this browser and are excluded from evidence.</p></details><button class="button primary" id="save-settings" ${busy?'disabled':''}>Save & return to workflow</button></section>`;}
function historyView(){const reports=storedReports();return `<div class="simple-heading"><div class="eyebrow">A RECORD OF WHAT CHANGED</div><h1>Activity & reports<span>.</span></h1><p>Permission-state evidence saved in this browser. Export a report to keep a copy.</p></div><section class="history-card">${reports.length?reports.map((r,i)=>`<div class="history-row">${icon('shield-check')}<div><h3>${short(r.after?.subject||'Unknown wallet')}</h3><p>${esc(new Date(r.createdAt).toLocaleString())} · Block ${esc(r.after?.block)} · ${r.after?.findings?.length??'?'} remaining paths</p></div><span class="chip">${r.verified&&!r.ownerProblems?.length&&!r.after?.findings?.length&&r.after?.complete?'SCOPE CLOSED':'RECHECK RECORDED'}</span><button class="button" data-report="${i}" aria-label="Download report">${icon('download')}</button></div>`).join(''):`<div class="clean-state">${icon('history')}<h3>Your evidence trail starts here.</h3><p>Run a scan and recheck permissions to save your first report.</p><button class="button" data-view="offboard">Open offboarding ${icon('arrow-right')}</button></div>`}</section>`;}
function capture(){const owner=document.querySelector<HTMLInputElement>('#owner'),subject=document.querySelector<HTMLInputElement>('#subject');if(owner)config.owner=owner.value.trim();if(subject)config.subject=subject.value.trim();const rpc=document.querySelector<HTMLInputElement>('#rpc');if(rpc)config.rpc=rpc.value.trim();document.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-target]').forEach(el=>{const i=Number(el.dataset.target);(config.targets[i] as any)[el.dataset.field!]=el.value.trim();});persist();}
async function task(label:string,action:()=>Promise<void>){if(busy)return;busy=true;busyText=label;error='';notice='';render();try{await action();}catch(e){error=errorText(e);}finally{busy=false;render();}}
async function connect(){
  const choice=await selectWallet(wallets);if(!choice)return;
  const accounts=await choice.provider.request({method:'eth_requestAccounts'});
  if(!accounts[0])throw new Error('No wallet account selected.');
  const connected=getAddress(accounts[0]);
  unbindWallet();selectedWallet=choice;account=connected;reviewed=false;
  const accountsChanged=(accounts:string[])=>{if(selectedWallet?.provider!==choice.provider)return;account=accounts[0]?getAddress(accounts[0]):undefined;reviewed=false;if(!busy)render();};
  const chainChanged=()=>{if(selectedWallet?.provider!==choice.provider)return;reviewed=false;if(!busy)render();};
  choice.provider.on?.('accountsChanged',accountsChanged);choice.provider.on?.('chainChanged',chainChanged);
  unbindWallet=()=>{choice.provider.removeListener?.('accountsChanged',accountsChanged);choice.provider.removeListener?.('chainChanged',chainChanged);};
  if(!config.owner)config.owner=account;persist();
}
function walletProvider(){if(!selectedWallet)throw new Error('Choose and connect a wallet first.');return selectedWallet.provider;}

async function ensureSigner(expected=config.owner){if(!account)await connect();if(!account)throw new Error('Wallet selection cancelled.');if(!same(account,expected))throw new Error(`Switch your wallet to the reviewed signer ${short(expected)} before signing.`);const provider=walletProvider();const accounts=await provider.request({method:'eth_accounts'});if(!accounts[0]||!same(accounts[0],expected))throw new Error('The active wallet account differs from the reviewed signer. Reconnect that account.');const chain=Number(await provider.request({method:'eth_chainId'}));if(chain!==sepolia.id)await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0xaa36a7'}]});if(Number(await provider.request({method:'eth_chainId'}))!==sepolia.id)throw new Error('Select Ethereum Sepolia in your wallet.');return createWalletClient({chain:sepolia,transport:custom(provider),account:getAddress(expected)});}
async function confirmReviewedCall(tx:EvidenceTransaction,expected:ReviewedCall){
  tx.submittedHash=tx.hash;
  const receipt=await waitForReviewedReceipt(clientFor(config.rpc),tx.hash,expected,mined=>{
    tx.hash=mined.transactionHash;tx.blockNumber=mined.blockNumber;tx.blockHash=mined.blockHash;
    tx.status=mined.status==='success'?'unverified':'failed';tx.intentVerified=false;
  });
  tx.from=expected.from;tx.to=expected.to;tx.data=expected.data;tx.value=expected.value??0n;
  tx.intentVerified=true;tx.status='confirmed';
  return receipt;
}
async function execute(){
  capture();
  const signer=await ensureSigner();
  const latest=await scan(config);
  if(!latest.complete)throw new Error('A fresh scan is incomplete. Resolve RPC or target errors before revoking.');
  const planned=current!.findings.filter(f=>selected.has(f.id));
  const fresh=latest.findings.filter(f=>selected.has(f.id));
  if(planned.length!==fresh.length||planned.some(f=>!fresh.some(g=>g.id===f.id&&g.data===f.data&&g.executable))) {current=latest;reviewed=false;selected=new Set(latest.findings.filter(f=>f.executable).map(f=>f.id));throw new Error('Permissions changed since your review. Review the refreshed plan before signing.');}
  before=latest;verified=false;
  for(const reviewedFinding of fresh){
    const liveStep=await scan(config);
    if(!liveStep.complete)throw new Error('Fresh permission reads are incomplete. Execution stopped.');
    const finding=liveStep.findings.find(f=>f.id===reviewedFinding.id);
    if(!finding)continue; // An inherited role may disappear after its operator approval is removed.
    if(finding.data!==reviewedFinding.data||!finding.executable){current=liveStep;reviewed=false;throw new Error('Permissions changed between transactions. Review the remaining plan again.');}

    busyText=`Awaiting signature: ${finding.title}`;render();
    const accounts=await walletProvider().request({method:'eth_accounts'});
    if(!accounts[0]||!same(accounts[0],config.owner)||Number(await walletProvider().request({method:'eth_chainId'}))!==sepolia.id)throw new Error('Wallet account or network changed. Execution stopped.');
    // Send the reviewed calldata directly. No simulateContract or privileged-call probing.
    const hash=await signer.sendTransaction({to:finding.address,data:finding.data,account:getAddress(config.owner),chain:sepolia});
    const tx:EvidenceTransaction={label:finding.title,hash,status:'pending',to:finding.address,functionName:finding.fn};transactions.push(tx);busyText=`Waiting for confirmation: ${finding.title}`;render();
    await confirmReviewedCall(tx,{from:getAddress(config.owner),to:finding.address,data:finding.data});
    const checkpoint=await scan(config);
    const changed=compareOwner(before,checkpoint);
    if(!checkpoint.complete||changed.length){current=checkpoint;ownerProblems=changed;throw new Error(`Execution stopped after confirmation: ${changed.join(' ')||'permission reads incomplete'}`);}
  }
  await verify();notice='Confirmed transactions recorded. The final permission check is ready.';
}
async function verify(){capture();const baseline=before||current;current=await scan(config);ownerProblems=baseline?compareOwner(baseline,current):[];verified=Boolean(baseline);reviewed=false;selected=new Set(current.findings.filter(f=>f.executable).map(f=>f.id));if(baseline){const reports=storedReports();reports.unshift(JSON.parse(serialize(report())));try{localStorage.setItem('afterkey.reports.v1',JSON.stringify(reports.slice(0,20)));}catch{notice='Evidence is ready. Browser storage is full; export the report to keep it.';}}}
function bind(){
  const includeUniswap=document.querySelector<HTMLInputElement>('#include-uniswap');if(includeUniswap)includeUniswap.onchange=()=>{capture();config.scanUniswap=includeUniswap.checked;clearScan();persist();render();};
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>{if(busy)return;capture();view=b.dataset.view as typeof view;render();});
  document.querySelectorAll<HTMLButtonElement>('[data-dismiss]').forEach(b=>b.onclick=()=>{if(b.dataset.dismiss==='error')error='';else notice='';render();});
  ['connect','connect-side','setup-connect'].forEach(id=>{const b=document.getElementById(id);if(b)b.onclick=()=>{capture();void task('Connecting your wallet',connect);};});
  const scanButton=document.getElementById('scan');if(scanButton)scanButton.onclick=()=>{capture();clearScan();void task('Reading live permissions on Sepolia',async()=>{current=await scan(config);before=current;selected=new Set(current.findings.filter(f=>f.executable).map(f=>f.id));});};
  ['owner','subject'].forEach(id=>{const el=document.getElementById(id);if(el)el.onchange=()=>{capture();clearScan();render();};});
  document.querySelectorAll<HTMLInputElement>('[data-select]').forEach(b=>b.onchange=()=>{if(b.checked)selected.add(b.dataset.select!);else selected.delete(b.dataset.select!);reviewed=false;render();});
  const review=document.querySelector<HTMLInputElement>('#review');if(review)review.onchange=()=>{reviewed=review.checked;render();};
  const revoke=document.getElementById('revoke');if(revoke)revoke.onclick=()=>void task('Refreshing the reviewed revocation plan',execute);
  const recheck=document.getElementById('verify');if(recheck)recheck.onclick=()=>void task('Rechecking live permission state',verify);
  const exportButton=document.getElementById('export');if(exportButton)exportButton.onclick=()=>download(`afterkey-evidence-${Date.now()}.json`,{...report(),before:before?{...before,config:{...before.config,rpc:'[not exported]'}}:undefined,after:current?{...current,config:{...current.config,rpc:'[not exported]'}}:undefined});
  const add=document.getElementById('add-target');if(add)add.onclick=()=>{capture();config.targets.push({label:'',address:'' as Address,resource:'',kind:'registry'});clearScan();render();};
  document.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(b=>b.onclick=()=>{capture();config.targets.splice(Number(b.dataset.remove),1);persist();clearScan();render();});
  const save=document.getElementById('save-settings');if(save)save.onclick=()=>{capture();clearScan();notice='Connection saved.';view='releases';render();};
  const exportConfig=document.getElementById('export-config');if(exportConfig)exportConfig.onclick=()=>{capture();download('afterkey-scope.json',{owner:config.owner,subject:config.subject,targets:config.targets});};
  const exportCre=document.getElementById('export-cre');if(exportCre)exportCre.onclick=()=>{capture();if(!isAddress(config.owner)||same(config.owner,zeroAddress)){error='Connect or enter the owner wallet on Offboarding before exporting CRE configuration.';render();return;}download('config.production.json',{owner:config.owner,authorizedEVMAddress:config.owner,ensTargets:config.targets,subject:config.subject,maxPositions:10,scanUniswap:config.scanUniswap!==false,monitorSchedule:"0 */5 * * * *",watchApprovals:true,github:{repository:"Lakshmikanth-3/AfterKey",approver:"Lakshmikanth-3"}});};
  const importConfig=document.querySelector<HTMLInputElement>('#import-config');if(importConfig)importConfig.onchange=()=>void task('Importing your scope',async()=>{const file=importConfig.files?.[0];if(!file)return;if(file.size>100000)throw new Error('Configuration file is too large.');const data=JSON.parse(await file.text());if(!Array.isArray(data.targets)||data.targets.length>100||typeof data.owner!=='string'||typeof data.subject!=='string')throw new Error('Invalid scope file.');for(const t of data.targets)if(typeof t.label!=='string'||typeof t.address!=='string'||typeof t.resource!=='string'||!['registry','resolver'].includes(t.kind))throw new Error('Invalid ENS target.');config={...config,owner:data.owner,subject:data.subject,targets:data.targets};persist();clearScan();notice='Scope imported. Review it before scanning.';});
  document.querySelectorAll<HTMLButtonElement>('[data-report]').forEach(b=>b.onclick=()=>{const r=storedReports()[Number(b.dataset.report)];if(r){if(r.before?.config)r.before.config.rpc='[not exported]';if(r.after?.config)r.after.config.rpc='[not exported]';download(`afterkey-report-${b.dataset.report}.json`,r);}});
}
function ensContext(){return {config,busy,task,render,setTargets:(targets:Config['targets'])=>{config.targets=targets;persist();clearScan();},offboard:()=>{view='offboard';render();},send:sendEnsAction,sendRecord};}
function uniswapContext(){return {config,busy,task,render,send:sendPositionAction,offboard:()=>{config.scanUniswap=true;persist();clearScan();view='offboard';render();}};}
function creContext(){return {config,busy,task,render,sign:async(message:string,expected:string)=>{const signer=await ensureSigner(expected);return signer.signMessage({message,account:getAddress(expected)});},offboard:()=>{view='offboard';render();}};}
function guardedContext(){return {config,busy,task,render,deployVault,sendVault,trackVault:(address:string)=>{config.guardedVaults=[...new Set([...(config.guardedVaults??[]).map(a=>a.toLowerCase()),address.toLowerCase()])];persist();clearScan();}};}
async function deployVault(name:string,id:string,reviewedArgs:string){
  const deployment=await prepareVaultDeployment(config,name,id);
  if(serialize(deployment.args)!==reviewedArgs)throw new Error('Deployment bindings changed; check and review again.');
  const data=encodeDeployData({abi:vaultArtifact.abi,bytecode:vaultArtifact.bytecode as `0x${string}`,args:deployment.args});
  const signer=await ensureSigner(config.owner),c=clientFor(config.rpc);
  await c.estimateGas({account:getAddress(config.owner),data});
  const hash=await signer.sendTransaction({account:getAddress(config.owner),chain:sepolia,data});
  notice=`Vault deployment submitted: ${hash}`;render();
  const receipt=await c.waitForTransactionReceipt({hash,confirmations:1});
  const [tx,header]=await Promise.all([c.getTransaction({hash:receipt.transactionHash}),c.getBlock({blockNumber:receipt.blockNumber})]);
  if(receipt.status!=='success'||!receipt.contractAddress||tx.to!==null||!same(tx.from,config.owner)||tx.input!==data||tx.value!==0n||tx.blockHash!==receipt.blockHash||header.hash!==receipt.blockHash)throw new Error('Deployment receipt does not match the reviewed constructor.');
  await readVault(config,receipt.contractAddress);
  notice=`Vault deployed: ${receipt.contractAddress}`;return receipt;
}
async function sendVault(request:VaultRequest,reviewed:{to:string;actor:string;data:string}){
  const fresh=await prepareVaultAction(config,request.address,request.operation,request.operator,request.expiry);
  if(fresh.data!==reviewed.data||!same(fresh.to,reviewed.to)||!same(fresh.actor,reviewed.actor))throw new Error('Operation, destination or signer changed; review again.');
  const c=clientFor(config.rpc);await c.call({account:getAddress(fresh.actor),to:fresh.to,data:fresh.data});
  return sendEnsAction(fresh,fresh.actor);
}
async function sendPositionAction(action:PositionAction){
  await ensureSigner(action.actor);
  const fresh=await preparePositionAction(config,action.request);
  if(!samePositionAction(action,fresh))throw new Error('Position state or operation changed. Prepare and review it again.');
  // Revalidate the selected provider after RPC reads and immediately before opening its signature prompt.
  const signer=await ensureSigner(action.actor);clearScan();
  busyText=`Awaiting signature: ${action.label}`;render();
  const hash=await signer.sendTransaction({to:fresh.to,data:fresh.data,account:fresh.actor,chain:sepolia});
  const tx:EvidenceTransaction={label:fresh.label,hash,to:fresh.to,status:'pending'};transactions.push(tx);
  busyText='Waiting for Uniswap confirmation';render();
  const receipt=await confirmReviewedCall(tx,{from:fresh.actor,to:fresh.to,data:fresh.data});
  return receipt;
}
async function sendRecord(reviewed:RecordWrite){
  if(!same(reviewed.actor,config.owner)&&!same(reviewed.actor,config.subject))throw new Error('Record signer must be the configured owner or departing operator.');
  await ensureSigner(reviewed.actor);
  const fresh=await prepareRecordWrite(reviewed,config.rpc);
  if(!sameRecordWrite(reviewed,fresh))throw new Error('Resolver or record action changed. Prepare and review the update again.');
  clearScan();
  return sendEnsAction(fresh,reviewed.actor);
}
async function sendEnsAction(action:SetupAction,expected=config.owner){
  const signer=await ensureSigner(expected);busyText=`Awaiting signature: ${action.label}`;render();
  const hash=await signer.sendTransaction({to:action.to,data:action.data,account:getAddress(expected),chain:sepolia});
  const tx:EvidenceTransaction={label:action.label,hash,status:'pending'};transactions.push(tx);
  busyText=`Waiting for confirmation: ${action.label}`;render();
  const receipt=await confirmReviewedCall(tx,{from:getAddress(expected),to:action.to,data:action.data});
  return receipt;
}
render();

window.addEventListener('scroll',()=>document.querySelector('.topnav')?.classList.toggle('scrolled',window.scrollY>50),{passive:true});

function releaseContext(){return {config,busy,render,task,send:sendEnsAction,deploy:deployRelease,sign:async(message:string,expected:string)=>{const signer=await ensureSigner(expected);return signer.signMessage({message,account:getAddress(expected)});}};}
async function deployRelease(kind:'gate'|'consumer',args:unknown[]){
  const artifact=kind==='gate'?releaseGateArtifact:releaseConsumerArtifact;
  const data=encodeDeployData({abi:artifact.abi,bytecode:artifact.bytecode as `0x${string}`,args});
  const signer=await ensureSigner(config.owner),c=clientFor(config.rpc);
  await c.estimateGas({account:getAddress(config.owner),data});
  const hash=await signer.sendTransaction({account:getAddress(config.owner),chain:sepolia,data});
  const receipt=await c.waitForTransactionReceipt({hash,confirmations:1});
  const tx=await c.getTransaction({hash:receipt.transactionHash});
  const header=await c.getBlock({blockNumber:receipt.blockNumber});
  if(receipt.status!=='success'||!receipt.contractAddress||tx.to!==null||!same(tx.from,config.owner)||tx.input!==data||tx.value!==0n||header.hash!==receipt.blockHash||tx.blockHash!==receipt.blockHash)throw new Error('Deployment differs from reviewed contract.');
  download(`afterkey-release-${kind}-${receipt.blockNumber}.json`,{kind,address:receipt.contractAddress,transactionHash:receipt.transactionHash,block:receipt.blockNumber,args});
  return receipt;
}

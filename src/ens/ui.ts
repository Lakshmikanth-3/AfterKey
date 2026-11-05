import { getAddress, encodeFunctionData, type Address, type TransactionReceipt } from 'viem';
import { normalize } from 'viem/ens';
import type { Config, Target } from '../engine';
import { clientFor, eacAbi, errorText, short, serialize, validateConfig } from '../engine';
import { ensAbi } from './abi';
import { SET_TEXT, describeRoles, resolverResource } from './roles';
import { inspectName, mergeTargets, nextSetupAction, recordSetupReceipt, delegationAction, verifyDeployments, equal, type NameInspection, type SetupAction, type SetupState } from './protocol';

type Context={config:Config;busy:boolean;task:(label:string,action:()=>Promise<void>)=>Promise<void>;render:()=>void;setTargets:(targets:Target[])=>void;offboard:()=>void;send:(action:SetupAction)=>Promise<TransactionReceipt>};
const esc=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const fresh=():SetupState=>({parent:'',label:'treasury-agent',key:'description',transactions:[]});
let setup:SetupState=fresh();
try{const saved=localStorage.getItem('afterkey.ensSetup.v1');if(saved)setup={...setup,...JSON.parse(saved)};}catch{}
let nameInput='',keyInput='description',inspection:NameInspection|undefined,action:SetupAction|null|undefined;
let authority:{root:bigint;local:bigint;effective:boolean;owner:boolean}|undefined;
let reviewed=false,testAccepted=false,message='';
const persist=()=>localStorage.setItem('afterkey.ensSetup.v1',serialize(setup));
const explorer=(address:string)=>`<a class="contract-link" href="https://sepolia.etherscan.io/address/${address}" target="_blank" rel="noreferrer">${esc(address)} ↗</a>`;
function readFields(){
  const field=(id:string)=>document.querySelector<HTMLInputElement>(`#${id}`)?.value.trim();
  nameInput=field('ens-name')??nameInput;keyInput=field('ens-key')??keyInput;
  const parent=field('ens-parent')??setup.parent,label=field('ens-label')??setup.label,key=field('ens-setup-key')??setup.key;
  if(parent!==setup.parent||label!==setup.label||key!==setup.key){action=undefined;reviewed=false;}
  setup.parent=parent;setup.label=label;setup.key=key;persist();
}
async function audit(ctx:Context,name=nameInput,key=keyInput){
  inspection=await inspectName(name,ctx.config.rpc,key);authority=undefined;
  if(inspection.resolverVerified){
    const c=clientFor(ctx.config.rpc),address=inspection.resolver,resource=resolverResource('text',key);
    const opts={address,abi:eacAbi,blockNumber:inspection.block};
    const [root,local,effective,owner]=await Promise.all([
      c.readContract({...opts,functionName:'roles',args:[0n,getAddress(ctx.config.subject)]}),
      c.readContract({...opts,functionName:'roles',args:[resource,getAddress(ctx.config.subject)]}),
      c.readContract({...opts,functionName:'hasRoles',args:[resource,SET_TEXT,getAddress(ctx.config.subject)]}),
      c.readContract({...opts,functionName:'hasRoles',args:[resource,SET_TEXT,getAddress(ctx.config.owner)]}),
    ]);
    authority={root,local,effective,owner};
  }
}
export function ensWorkspace(ctx:Context):string{
  const locked=Boolean(setup.registry||setup.resolver);
  return `<div class="simple-heading"><div class="eyebrow">ENSv2 / PERMISSIONS ARE THE PRODUCT</div><h1>Offboard the operator.<br/>Keep the identity<span>.</span></h1><p>Inspect the name’s registry hierarchy and record permissions. Close surviving access while preserving the owner’s name and profile.</p></div>
  <section class="ens-purpose"><div><span class="chip">BEST USE OF ENSv2</span><h2>One key removed. Another still works.</h2><p>An editor’s permission for one text key can be removed while a resolver-wide role still authorizes the same edits. AfterKey checks both scopes through ENSv2 EAC.</p></div><div class="ens-path"><span>Text key</span><b>+</b><span>Resolver root</span><b>→</b><strong>Effective permission</strong></div></section>
  <section class="settings-card"><div class="section-number">01 / DISCOVER FROM A REAL NAME</div><h2>Audit an ENS namespace</h2><p>Enter a registered Sepolia name. Addresses, current registry resources and the nearest resolver are read from the live hierarchy.</p><div class="ens-input-row"><label>ENS name<input id="ens-name" placeholder="treasury-agent.your-team.eth" value="${esc(nameInput)}" ${ctx.busy?'disabled':''}/></label><label>Text key<input id="ens-key" value="${esc(keyInput)}" ${ctx.busy?'disabled':''}/></label><button class="button primary" id="ens-discover" ${ctx.busy?'disabled':''}>Discover live ENS paths →</button></div>
  ${inspection?inspectionView(ctx):'<p class="muted-note">No prefilled name is claimed to exist. Discovery only reports live contract state. Resolver permissions can affect multiple names served by the same instance.</p>'}</section>
  <section class="settings-card ens-bootstrap"><div class="section-number">02 / CREATE A REAL ENSv2 WORKSPACE</div><h2>Set up a team or agent identity</h2><p>Use a Sepolia .eth name you own. This flow creates an official Permissioned Resolver and, if needed, a User Registry, connects the registry hierarchy, and registers your operator’s subname. Every change requires your wallet signature.</p>
  <div class="settings-links"><a href="https://sepolia.app.ens.domains/" target="_blank" rel="noreferrer">Register a Sepolia .eth name ↗</a><a href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" target="_blank" rel="noreferrer">Get test ETH ↗</a></div>
  <div class="ens-input-row"><label>Your owned parent<input id="ens-parent" placeholder="your-team.eth" value="${esc(setup.parent)}" ${locked?'readonly':''}/></label><label>Operator subname label<input id="ens-label" value="${esc(setup.label)}" ${locked?'readonly':''}/></label><label>Delegated text key<input id="ens-setup-key" value="${esc(setup.key)}" ${locked?'readonly':''}/></label></div>
  <div class="ens-setup-status">${setup.resolver?`<div><span>Permissioned Resolver</span>${explorer(setup.resolver)}</div>`:''}${setup.registry?`<div><span>Subname registry</span>${explorer(setup.registry)}</div>`:''}${setup.registered?`<div class="ens-ready">✓ Namespace setup checked: ${esc(setup.label)}.${esc(setup.parent)}</div>`:''}</div>
  <div class="ens-controls"><button class="button" id="ens-prepare" ${ctx.busy?'disabled':''}>${setup.registered?'Recheck namespace setup':'Prepare next setup transaction'}</button>${locked?'<button class="text-button" id="ens-reset">Start another setup</button>':''}</div>
  ${action?`<div class="ens-action"><h3>${esc(action.label)}</h3><p>${esc(action.explanation)}</p><details><summary>Review transaction destination and calldata</summary><code class="calldata">To: ${action.to}<br/>Data: ${action.data}</code></details><label class="review-check"><input type="checkbox" id="ens-review" ${reviewed?'checked':''}/><span>I reviewed this Sepolia change. The owner remains ${short(ctx.config.owner)}.</span></label><button class="button primary" id="ens-execute" ${ctx.busy||!reviewed?'disabled':''}>Sign this setup transaction</button></div>`:''}
  ${message?`<p class="muted-note" role="status">${esc(message)}</p>`:''}
  ${setup.transactions.length?`<details class="ens-tx-history"><summary>Setup transaction evidence (${setup.transactions.length})</summary>${setup.transactions.map(t=>`<a href="https://sepolia.etherscan.io/tx/${t.hash}" target="_blank" rel="noreferrer">${esc(t.label)} · ${short(t.hash)} ↗</a>`).join('')}</details>`:''}
  ${setup.registered?`<div class="ens-demo"><div class="section-number">03 / DELEGATION & OFFBOARDING DEMO</div><h3>Show the surviving permission</h3><p>Start with scoped delegation. The optional broad role creates a real residual-access case in this test resolver. Revoking only the key role leaves the root role active.</p><label class="review-check"><input type="checkbox" id="ens-test-accept" ${testAccepted?'checked':''}/><span>I intend to use this Sepolia namespace for the delegation demo. Grants give ${short(ctx.config.subject)} editing rights on this resolver; each grant is reviewed in my wallet.</span></label><div class="ens-controls"><button class="button" data-ens-demo="scoped" ${ctx.busy||!testAccepted?'disabled':''}>1. Delegate this text key</button><button class="button" data-ens-demo="broad" ${ctx.busy||!testAccepted?'disabled':''}>2. Add broad test editor role</button><button class="button" data-ens-demo="narrow" ${ctx.busy||!testAccepted?'disabled':''}>3. Revoke only the key role</button><button class="button primary" id="ens-use-setup" ${ctx.busy?'disabled':''}>Audit this identity →</button></div><p class="muted-note">No admin rights are granted to the departing wallet. AfterKey’s actual offboarding plan removes root permissions first, then remaining scoped roles. This demo uses live transactions and permission reads; no privileged calls are simulated.</p></div>`:''}</section>
  <section class="ens-qualification"><h2>Submission readiness</h2><div class="ens-readiness"><span>✓ ENSv2-specific EAC reads & revocations</span><span>✓ Official Sepolia factory setup</span><span>${ctx.config.targets.length?'✓':'○'} ENS scopes configured: ${ctx.config.targets.length}</span><span>○ Live grant/revoke evidence requires wallet signatures</span><span>○ Public repository access must be verified</span><span>○ Judge-accessible demo sharing must be configured</span></div><p>Classic / From Scratch: target “Best Use of ENSv2.” The existing-project prize is a separate Continuity track and requires a mainnet integration.</p><a href="https://docs.ens.domains/ensv2/permissioned-resolver/" target="_blank" rel="noreferrer">ENSv2 resolver permission model ↗</a></section>`;
}
function inspectionView(ctx:Context):string{
  const x=inspection!;
  return `<div class="ens-inspection"><div class="ens-identity"><div><span class="eyebrow">LIVE ENS IDENTITY · BLOCK ${x.block}</span><h2>${esc(x.name)}</h2><p>${esc(x.text||'No value for this text key.')}</p></div><span class="chip">${x.resolverVerified?'PERMISSIONED RESOLVER':'UNSUPPORTED / NO RESOLVER'}</span></div>
  ${x.entries.map(e=>`<div class="ens-chain-row"><div><strong>${esc(e.name)}</strong><small>Owner ${short(e.owner)} · ${e.expiry===((1n<<64n)-1n)?'no expiry':e.expiry===0n?'unregistered':`expires ${new Date(Number(e.expiry)*1000).toLocaleDateString()}`}</small></div><div><a href="https://sepolia.etherscan.io/address/${e.registry}" target="_blank" rel="noreferrer">${short(e.registry)} ↗</a><small>Current resource ${short(String(e.resource))}</small></div></div>`).join('')}
  ${x.resolverVerified?`<div class="ens-authority-grid"><div><span>Resolver-wide roles</span><strong>${authority?esc(describeRoles(authority.root,'resolver').join(', ')||'None'):'Not read'}</strong></div><div><span>Key: ${esc(x.key)}</span><strong>${authority?esc(describeRoles(authority.local,'resolver').join(', ')||'None'):'Not read'}</strong></div><div class="${authority?.effective?'ens-active':'ens-closed'}"><span>Departing wallet can edit this key</span><strong>${authority?(authority.effective?'YES · effective permission survives':'NO · permission absent'):'Unknown'}</strong></div><div><span>Owner can edit this key</span><strong>${authority?(authority.owner?'YES':'NO'):'Unknown'}</strong></div></div><div class="ens-profile-meta"><span>Resolved ETH address: ${x.address?esc(x.address):'Unavailable'}</span><span>Record bundle: ${x.recordId===null?'Unavailable':x.recordId}</span></div>`:''}
  ${x.notes.map(n=>`<p class="muted-note">${esc(n)}</p>`).join('')}<div class="ens-controls"><button class="button primary" id="ens-add-scope" ${ctx.busy?'disabled':''}>Add discovered scopes & review offboarding →</button><button class="button" id="ens-export" ${ctx.busy?'disabled':''}>Export live identity evidence</button></div></div>`;
}
export function bindEnsWorkspace(ctx:Context):void{
  const on=(id:string,fn:()=>void)=>{const e=document.getElementById(id);if(e)e.onclick=fn;};
  on('ens-discover',()=>{readFields();void ctx.task('Discovering the ENSv2 hierarchy and permissions',async()=>{validateConfig(ctx.config);await audit(ctx);});});
  on('ens-add-scope',()=>{if(!inspection)return;ctx.setTargets(mergeTargets(ctx.config.targets,inspection.targets));ctx.offboard();});
  on('ens-export',()=>{if(!inspection)return;const url=URL.createObjectURL(new Blob([serialize({chainId:11155111,sourceCommit:'07e55a056f5b6a9c90119f501bdd05714e67dddd',method:'Live hierarchy/profile/permission reads',owner:ctx.config.owner,subject:ctx.config.subject,inspection,authority})],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='afterkey-ens-identity-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  on('ens-prepare',()=>{readFields();reviewed=false;void ctx.task('Checking the parent name and official ENS deployments',async()=>{validateConfig(ctx.config);await verifyDeployments(ctx.config.rpc);action=await nextSetupAction(setup,getAddress(ctx.config.owner),ctx.config.rpc);persist();message=action?'Review the next transaction below. No transaction has been submitted.':'The live namespace setup is complete. You can delegate a text key or audit the identity.';});});
  on('ens-reset',()=>{setup=fresh();action=undefined;reviewed=false;testAccepted=false;message='A new setup was started. Existing deployed contracts and permissions were not changed.';persist();ctx.render();});
  const review=document.querySelector<HTMLInputElement>('#ens-review');if(review)review.onchange=()=>{reviewed=review.checked;ctx.render();};
  const accept=document.querySelector<HTMLInputElement>('#ens-test-accept');if(accept)accept.onchange=()=>{testAccepted=accept.checked;ctx.render();};
  on('ens-execute',()=>{readFields();if(!action||!reviewed)return;const selectedAction=action;void ctx.task('Submitting the reviewed ENS setup step',async()=>{
    await verifyDeployments(ctx.config.rpc);const freshAction=await nextSetupAction(setup,getAddress(ctx.config.owner),ctx.config.rpc);
    if(!freshAction||freshAction.id!==selectedAction.id||freshAction.data!==selectedAction.data||!equal(freshAction.to,selectedAction.to)){action=freshAction;reviewed=false;throw new Error('The setup state changed. Review the updated next step before signing.');}
    const receipt=await ctx.send(freshAction);recordSetupReceipt(setup,freshAction,receipt,getAddress(ctx.config.owner));persist();reviewed=false;
    action=await nextSetupAction(setup,getAddress(ctx.config.owner),ctx.config.rpc);persist();message=action?'Transaction confirmed. Review the next step.':'Namespace setup confirmed. The identity is ready for scoped delegation.';
  });});
  on('ens-use-setup',()=>{nameInput=`${setup.label}.${setup.parent}`;keyInput=setup.key;void ctx.task('Auditing the new ENS identity',async()=>{validateConfig(ctx.config);await audit(ctx,nameInput,keyInput);});});
  document.querySelectorAll<HTMLButtonElement>('[data-ens-demo]').forEach(button=>button.onclick=()=>{
    if(!testAccepted)return;const type=button.dataset.ensDemo;
    void ctx.task('Checking and submitting the selected delegation change',async()=>{
      validateConfig(ctx.config);await verifyDeployments(ctx.config.rpc);
      if(await nextSetupAction(setup,getAddress(ctx.config.owner),ctx.config.rpc))throw new Error('Finish the pending namespace setup first.');
      if(!setup.resolver)throw new Error('Resolver not configured.');
      const c=clientFor(ctx.config.rpc);
      if(!await c.readContract({address:setup.resolver,abi:ensAbi,functionName:'hasRootRoles',args:[SET_TEXT<<128n,getAddress(ctx.config.owner)]}))throw new Error('Owner lacks the text admin role on this resolver.');
      const change=type==='narrow'?{id:'naive-revoke',label:'Remove only the text-key role',explanation:'This intentionally leaves any root text role in place for the residual-access demo.',to:setup.resolver,data:encodeFunctionData({abi:ensAbi,functionName:'revokeRoles',args:[resolverResource('text',setup.key),SET_TEXT,getAddress(ctx.config.subject)]})}:delegationAction(setup,getAddress(ctx.config.subject),type==='broad');
      const receipt=await ctx.send(change);recordSetupReceipt(setup,change,receipt,getAddress(ctx.config.owner));persist();
      nameInput=`${setup.label}.${setup.parent}`;keyInput=setup.key;await audit(ctx,nameInput,keyInput);message=`${change.label}: confirmed. Effective permission was read again from live chain state.`;
    });
  });
}

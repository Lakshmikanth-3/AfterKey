import {releaseView,type ReleaseReceipt} from './view';
import {encodeFunctionData,getAddress,isAddress,type Hex,type TransactionReceipt} from 'viem';
import {type Config,errorText,serialize,clientFor} from '../engine';
import {type SetupAction,type SetupState,nextSetupAction,recordSetupReceipt,resolverProxySalt} from '../ens/protocol';
import deployment from '../../cre/deployment.json';
import production from '../../cre/config.production.json';
import {triggerSigningRequest,submitTrigger} from '../cre/auth';
import {releaseDeployment,readRelease,prepareReleaseAction,inspectImpact,gateAbi,type ReleaseState,type ReleaseAction} from './client';
import {type ReleaseConfiguration} from './model';
import {verifyReleaseCollectionLogs} from '../uniswap/collection-proof';
import {POSITION_MANAGER,positionAbi} from '../uniswap/contracts';

type Context={config:Config;busy:boolean;render:()=>void;task:(label:string,fn:()=>Promise<void>)=>Promise<void>;send:(action:SetupAction,actor:string)=>Promise<TransactionReceipt>;deploy:(kind:'gate'|'consumer',args:unknown[])=>Promise<TransactionReceipt>;sign:(message:string,actor:string)=>Promise<Hex>};
let tab='setup',gate='',name='treasury-agent.manager.eth',consumer='',token='',forwarder='0xF8344CFd5c43616a4366C34E3EEE75af79a74482',author=deployment.registryOwner,workflow='0x'+deployment.workflowId,operator='',treasury='',expiry='',names='',message='',reviewed=false;
let state:ReleaseState|undefined,impact:Awaited<ReturnType<typeof inspectImpact>>|undefined;
let pending:{label:string;detail:string;run:()=>Promise<void>}|undefined;
try{const saved=JSON.parse(localStorage.getItem('afterkey.release.v1')||'{}');gate=saved.gate||'';names=saved.names||'';consumer=saved.consumer||'';name=saved.name||name;token=saved.token||'';}catch{}
let repair:SetupState;
try{repair=JSON.parse(localStorage.getItem('afterkey.release.repair.v1')||'null');}catch{}
repair??={parent:'manager.eth',label:'afterkey-release',key:'description',textValue:'Owner-reviewed configuration releases for treasury workflows.',resolverSalt:String(resolverProxySalt(getAddress(deployment.assetOwner),2n)),transactions:[]};
const persistRepair=()=>localStorage.setItem('afterkey.release.repair.v1',JSON.stringify(repair));
let receipts:ReleaseReceipt[]=[],accepted:{executionId:string;status:string}|undefined;
try{const saved=JSON.parse(localStorage.getItem('afterkey.release.proof.v1')||'{}');receipts=saved.receipts||[];accepted=saved.accepted;}catch{}
const persistProof=()=>localStorage.setItem('afterkey.release.proof.v1',JSON.stringify({receipts,accepted}));
function saveReceipt(label:string,r:TransactionReceipt,actor:string,scope=gate){receipts.unshift({label,hash:r.transactionHash,block:String(r.blockNumber),actor,gate:scope});persistProof();}
const persist=()=>localStorage.setItem('afterkey.release.v1',JSON.stringify({gate,names,consumer,name,token}));
export function releaseWorkspace(ctx:Context){
  const target=(production as {releases?:{gate:string;consumers:string[]}[]}).releases?.find(r=>r.gate.toLowerCase()===gate.toLowerCase());
  const workflowReady=!!state&&!!target&&state.workflowId.toLowerCase()==='0x'+deployment.workflowId.toLowerCase()&&target.consumers.length===state.consumers.length&&target.consumers.every((c,i)=>c.toLowerCase()===state!.consumers[i].address.toLowerCase());
  return releaseView({config:ctx.config,busy:ctx.busy,tab,gate,name,consumer,token,forwarder,author,workflow,operator,expiry,names,message,reviewed,state,pending,receipts,accepted,workflowReady,impact});
}
export function bindReleaseWorkspace(ctx:Context){
  const capture=()=>{const value=(id:string,old:string)=>document.querySelector<HTMLInputElement>(`#rel-${id}`)?.value.trim()??old;gate=value('gate',gate);name=value('name',name);consumer=value('consumer',consumer);token=value('token',token);forwarder=value('forwarder',forwarder);author=value('author',author);workflow=value('workflow',workflow);operator=value('operator',operator||ctx.config.subject);treasury=value('treasury',treasury||ctx.config.owner);expiry=value('expiry',expiry);names=value('names',names);persist();};
  const task=(label:string,fn:()=>Promise<void>)=>void ctx.task(label,async()=>{try{await fn();}catch(e){message=errorText(e);throw e;}});
  const on=(id:string,fn:()=>void)=>{const el=document.getElementById(id);if(el)el.onclick=fn;};
  const queue=(label:string,detail:string,run:()=>Promise<void>)=>{pending={label,detail,run};reviewed=false;};
  const refresh=async()=>{state=await readRelease(ctx.config,gate);if(!consumer&&state.consumers.length){consumer=state.consumers[0].address;persist();}};
  const send=async(action:SetupAction,actor:string)=>{const r=await ctx.send(action,actor);saveReceipt(action.label,r,actor);return r;};
  document.querySelectorAll<HTMLButtonElement>('[data-release-tab], [data-release-next]').forEach(b=>b.onclick=()=>{capture();tab=b.dataset.releaseTab||b.dataset.releaseNext!;pending=undefined;reviewed=false;ctx.render();});
  // Only editable fields invalidate a prepared request. A checkbox change bubbles
  // through #rel-pending; binding its container would discard the reviewed action.
  document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>('input[id^="rel-"]:not(#rel-review), textarea[id^="rel-"], select#rel-consumer').forEach(el=>el.addEventListener('change',event=>{if(event.target!==el)return;const previous=gate;capture();if(previous!==gate){state=undefined;document.getElementById('rel-live')?.remove();}pending=undefined;reviewed=false;document.getElementById('rel-pending')?.remove();if(el.tagName==='SELECT')ctx.render();}));
  on('rel-read',()=>{capture();task('Reading release state',refresh);});
  on('rel-repair',()=>{capture();task('Preparing release namespace repair',async()=>{
    await refresh();
    if(state!.consumers.some(c=>!c.custodian||c.custodian.toLowerCase()!==ctx.config.owner.toLowerCase()))throw new Error('Recover every position to the owner before starting repair.');
    const action=await nextSetupAction(repair,getAddress(ctx.config.owner),ctx.config.rpc);persistRepair();
    if(!action){name=`${repair.label}.${repair.parent}`;gate='';consumer='';token='';state=undefined;persist();message='Release namespace ready. Review deployment to create the replacement gate.';return;}
    queue(action.label,serialize(action),async()=>{const r=await send(action,ctx.config.owner);recordSetupReceipt(repair,action,r,getAddress(ctx.config.owner));persistRepair();message=`Repair confirmed at block ${r.blockNumber}. Click Prepare namespace repair again for the next step.`;});
  });});

  on('rel-deploy-gate',()=>{capture();task('Checking release deployment',async()=>{const d=await releaseDeployment(ctx.config,name,forwarder,author,workflow);queue('Deploy ENS release gate',serialize(d),async()=>{const fresh=await releaseDeployment(ctx.config,name,forwarder,author,workflow);if(serialize(fresh)!==serialize(d))throw new Error('Deployment changed. Review again.');const r=await ctx.deploy('gate',d.args);saveReceipt('Deploy release gate',r,ctx.config.owner,r.contractAddress!);gate=r.contractAddress!;persist();await refresh();message=`Gate deployed at block ${r.blockNumber}.`;});});});
  on('rel-deploy-consumer',()=>{capture();task('Checking LP consumer',async()=>{
    await refresh();if(!/^\d+$/.test(token)||BigInt(token)>=2n**256n)throw new Error('Enter a position token ID.');
    if(state!.consumers.some(c=>c.tokenId===BigInt(token)))throw new Error('This position already has a registered consumer. Select it from the list.');
    const holder=await clientFor(ctx.config.rpc).readContract({address:POSITION_MANAGER,abi:positionAbi,functionName:'ownerOf',args:[BigInt(token)],blockNumber:state!.block});
    if(holder.toLowerCase()!==ctx.config.owner.toLowerCase())throw new Error('Position must belong to the configured owner before consumer deployment.');
    const args=[getAddress(gate),BigInt(token)];queue('Deploy LP consumer',serialize(args),async()=>{const r=await ctx.deploy('consumer',args);saveReceipt('Deploy LP consumer',r,ctx.config.owner);consumer=r.contractAddress!;persist();message=`Consumer deployed at block ${r.blockNumber}. Register it, then deposit its position.`;});
  });});
  document.querySelectorAll<HTMLButtonElement>('[data-release-action]').forEach(b=>b.onclick=()=>{capture();task('Checking release operation',async()=>{
    const candidate:ReleaseConfiguration={operator:getAddress(operator||ctx.config.subject),treasury:getAddress(treasury||ctx.config.owner),manager:POSITION_MANAGER,expiry:expiry?BigInt(Math.floor(new Date(expiry).getTime()/1000)):0n};
    const request:ReleaseAction={gate,consumer,candidate,operation:b.dataset.releaseAction as ReleaseAction['operation']};
    const prepared=await prepareReleaseAction(ctx.config,request);
    queue(prepared.label,serialize(prepared),async()=>{const fresh=await prepareReleaseAction(ctx.config,request);if(serialize(fresh)!==serialize(prepared))throw new Error('Live operation changed. Review again.');const before=state;const r=await send(fresh,fresh.actor);let collection;
      if(request.operation==='collect'){
        if(!before)throw new Error('Missing reviewed collection state.');
        const selected=before.consumers.find(c=>c.address.toLowerCase()===request.consumer.toLowerCase());if(!selected)throw new Error('Missing reviewed consumer.');
        collection=verifyReleaseCollectionLogs(r.logs,{consumer:selected.address,tokenId:selected.tokenId,recipient:getAddress(ctx.config.owner),digest:before.activeDigest,epoch:before.epoch});
      }
      await refresh();message=collection?`Collection verified at block ${r.blockNumber}. Token amounts: ${collection.amount0} / ${collection.amount1} (raw units), sent to the owner.${collection.zeroCollection?' No tokens were owed; this proves execution, not earned fees.':''}`:`Confirmed at block ${r.blockNumber}. Live state refreshed.`;});
  });});
  on('rel-bind',()=>{capture();task('Preparing workflow binding',async()=>{await refresh();if(!/^0x[\da-f]{64}$/i.test(workflow))throw new Error('Enter updated 0x workflow ID.');const action={id:'release:bind',to:getAddress(gate),data:encodeFunctionData({abi:gateAbi,functionName:'bindWorkflow',args:[workflow]}),label:'Bind CRE workflow',explanation:'Invalidates pending reports and increments the release version.'};queue(action.label,serialize(action),async()=>{const receipt=await send(action,ctx.config.owner);message=`Workflow binding confirmed at block ${receipt.blockNumber}. Refreshing live state...`;await refresh();message=`Workflow binding confirmed at block ${receipt.blockNumber}. Continue to review change.`;});});});
  on('rel-impact',()=>{capture();task('Reading ENS dependencies',async()=>{impact=await inspectImpact(ctx.config,names.split(/\r?\n/).map(n=>n.trim()).filter(Boolean));});});
  on('rel-cre',()=>{capture();task('Preparing CRE release verification',async()=>{
    await refresh();const targets=(production as {releases?:{gate:string}[]}).releases;
    if(!targets?.some(t=>t.gate.toLowerCase()===gate.toLowerCase())||state!.workflowId.toLowerCase()!=='0x'+deployment.workflowId.toLowerCase())throw new Error('Export coverage, deploy CRE with that configuration, update deployment.json and bind its workflow ID first.');
    const request=triggerSigningRequest(deployment.workflowId,{eventId:crypto.randomUUID(),event:'release',subject:production.subject,gate},production.authorizedEVMAddress);
    queue('Trigger CRE configuration verification',request.body,async()=>{const signature=await ctx.sign(request.signingInput,production.authorizedEVMAddress);const r=await submitTrigger(request,signature,deployment.workflowId);accepted=r;persistProof();message=`CRE accepted ${r.executionId}. Wait for report delivery, then read live configuration. Acceptance is not completion.`;});
  });});
  on('rel-export',()=>{if(!state)return;const text=serialize({releases:[{gate:state.gate,consumers:state.consumers.map(c=>c.address)}]});const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='afterkey-release-coverage.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  on('rel-import-consumer',()=>{const address=document.querySelector<HTMLInputElement>('#rel-import-consumer')?.value.trim()||'';if(!isAddress(address)){message='Enter a valid consumer address.';ctx.render();return;}consumer=address;persist();pending=undefined;reviewed=false;ctx.render();});
  on('rel-cancel',()=>{pending=undefined;reviewed=false;ctx.render();});
  on('rel-evidence',()=>{const output={schemaVersion:1,chainId:11155111,gate,receipts,acceptedRequest:accepted??null,liveState:state??null,scope:'Saved browser references and current reads; acceptance alone is not CRE completion.'};const url=URL.createObjectURL(new Blob([serialize(output)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='afterkey-release-evidence.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  const review=document.querySelector<HTMLInputElement>('#rel-review');if(review)review.onchange=()=>{reviewed=review.checked;ctx.render();};
  on('rel-send',()=>{if(!reviewed||!pending)return;const p=pending;pending=undefined;reviewed=false;task(p.label,p.run);});
}

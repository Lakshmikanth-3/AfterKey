import { getAddress, type TransactionReceipt } from 'viem';
import { prepareRecordWrite, type RecordWrite } from './operator';
import { inspectName, type NameInspection } from './protocol';
import { serialize, short, errorText, type Config } from '../engine';
import { withReadDeadline } from './read-deadline';

type Context={config:Config;busy:boolean;render:()=>void;task:(label:string,action:()=>Promise<void>)=>Promise<void>;sendRecord:(write:RecordWrite)=>Promise<TransactionReceipt>;setOperatorScope:(name:string,key:string)=>void};
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
let name='treasury-agent.manager.eth',key='agent-context',value='',actor:'owner'|'operator'='operator';
let prepared:RecordWrite|undefined,result:NameInspection|undefined,reviewed=false;
let feedback:{kind:'working'|'success'|'error'|'info';text:string}|undefined;
const receipts:{name:string;key:string;actor:string;hash:string;block:string;value:string}[]=[];
export function operatorWorkspace(ctx:Context):string{
  return `<section class="settings-card"><div class="section-number">OPERATE / DELEGATE / OFFBOARD</div><h2>Maintain an ENS identity</h2><p>Let a teammate maintain a context record or service endpoint. Remove their permissions when they leave, while the identity stays with your team.</p><div class="ens-input-row"><label>ENS name<input id="op-name" value="${esc(name)}" ${ctx.busy?'disabled':''}/></label><label>Text key<input id="op-key" value="${esc(key)}" ${ctx.busy?'disabled':''}/></label><label>Signing wallet<select id="op-actor" ${ctx.busy?'disabled':''}><option value="operator" ${actor==='operator'?'selected':''}>Departing operator · ${short(ctx.config.subject)}</option><option value="owner" ${actor==='owner'?'selected':''}>Workspace owner · ${short(ctx.config.owner)}</option></select></label></div><label class="initial-record">New record value<textarea id="op-value" rows="3" placeholder="Enter your actual agent context or endpoint URL" ${ctx.busy?'disabled':''}>${esc(value)}</textarea></label><div class="ens-controls"><button class="button" id="op-read" ${ctx.busy?'disabled':''}>Read current record</button><button class="button primary" id="op-prepare" ${ctx.busy?'disabled':''}>Check permission & prepare update</button></div>
  ${feedback?`<div id="op-feedback" class="operator-feedback ${feedback.kind}" role="${feedback.kind==='error'?'alert':'status'}">${esc(feedback.text)}</div>`:''}
  ${result?`<div class="agent-result"><h3>${esc(result.name)}</h3><p>Read at Sepolia block ${result.block}</p><pre>${esc(result.text||'No text value published')}</pre><p class="muted-note">Resolver ${esc(result.resolver)}. ${result.resolverVerified?'Supported Permissioned Resolver.':'No supported resolver found.'}</p></div>`:''}
  ${prepared?`<div class="ens-action"><h3>Review record update</h3><p>${esc(prepared.explanation)}</p><p>Signer: ${esc(prepared.actor)}</p><pre>${esc(prepared.value)}</pre><details><summary>Destination and calldata</summary><code class="calldata">${prepared.to}<br/>${prepared.data}</code></details><label class="review-check"><input id="op-review" type="checkbox" ${reviewed?'checked':''}/><span>I reviewed this record update and its signing wallet.</span></label><button class="button primary" id="op-send" ${ctx.busy||!reviewed?'disabled':''}>Sign record update</button></div>`:''}
  <p class="muted-note">After offboarding, prepare the same operator update again: a live permission check should deny it before any transaction is sent. This is authorization evidence. A mined update is separate transaction evidence.</p><button class="button" id="op-audit" ${ctx.busy?'disabled':''}>Audit this name & key →</button>
  ${receipts.length?`<div class="agent-result"><h3>Confirmed record updates</h3>${receipts.map(r=>`<p><a href="https://sepolia.etherscan.io/tx/${r.hash}" target="_blank" rel="noreferrer">${esc(r.name)} · ${esc(r.key)} · ${short(r.hash)} ↗</a><br/>Signer ${short(r.actor)} · block ${r.block}</p>`).join('')}<button class="button" id="op-export">Export update evidence</button></div>`:''}</section>`;
}
export function bindOperatorWorkspace(ctx:Context):void{
  const capture=()=>{name=document.querySelector<HTMLInputElement>('#op-name')?.value.trim()??name;key=document.querySelector<HTMLInputElement>('#op-key')?.value.trim()??key;value=document.querySelector<HTMLTextAreaElement>('#op-value')?.value??value;actor=document.querySelector<HTMLSelectElement>('#op-actor')?.value==='owner'?'owner':'operator';};
  const on=(id:string,fn:()=>void)=>{const el=document.getElementById(id);if(el)el.onclick=fn;};
  const readTask=async(label:string,success:string,action:()=>Promise<void>)=>{
    if(ctx.busy)return;
    feedback={kind:'working',text:`${label}. This only reads Sepolia; MetaMask will not open yet. Allow up to 45 seconds.`};
    await ctx.task(label,async()=>{
      try{await action();feedback={kind:'success',text:success};}
      catch(error){feedback={kind:'error',text:errorText(error)};throw error;}
    });
    document.getElementById('op-feedback')?.scrollIntoView({behavior:'smooth',block:'center'});
  };
  ['op-name','op-key','op-value','op-actor'].forEach(id=>{const field=document.getElementById(id);field?.addEventListener('input',()=>{capture();prepared=undefined;reviewed=false;feedback={kind:'info',text:'Inputs changed. Prepare the update again.'};const status=document.getElementById('op-feedback');if(status){status.className='operator-feedback';status.textContent=feedback.text;}const send=document.querySelector<HTMLButtonElement>('#op-send');if(send)send.disabled=true;});});
  on('op-read',()=>{capture();result=undefined;void readTask('Reading the current ENS text record','Current record loaded below.',async()=>{result=await withReadDeadline(inspectName(name,ctx.config.rpc,key));});});
  on('op-prepare',()=>{capture();prepared=undefined;reviewed=false;void readTask('Checking live record-edit authorization','Permission confirmed. Review the update below, tick its review checkbox, then click Sign record update to open MetaMask.',async()=>{if(!value.trim())throw new Error('Enter a New record value before preparing an update.');prepared=await withReadDeadline(prepareRecordWrite({name,key,value,actor:getAddress(actor==='owner'?ctx.config.owner:ctx.config.subject)},ctx.config.rpc));});});
  document.querySelector<HTMLInputElement>('#op-review')?.addEventListener('change',event=>{reviewed=(event.target as HTMLInputElement).checked;ctx.render();});
  on('op-send',()=>{if(!prepared||!reviewed)return;const write=prepared;void ctx.task('Submitting the reviewed ENS record update',async()=>{const receipt=await ctx.sendRecord(write);receipts.push({name:write.name,key:write.key,actor:write.actor,hash:receipt.transactionHash,block:String(receipt.blockNumber),value:write.value});prepared=undefined;reviewed=false;result=await inspectName(write.name,ctx.config.rpc,write.key);if(result.text!==write.value)throw new Error('Transaction confirmed but the subsequent record differs. Inspect the receipt and current record.');});});
  on('op-audit',()=>{capture();ctx.setOperatorScope(name,key);});
  on('op-export',()=>{const url=URL.createObjectURL(new Blob([serialize({chainId:11155111,method:'Confirmed real record updates',receipts})],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='afterkey-record-updates.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
}

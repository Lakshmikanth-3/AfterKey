import { short, type Snapshot } from '../engine';
import { describeRoles } from './roles';
import { identityChanges } from './preservation';

const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function accessEvidence(snapshot:Snapshot,baseline?:Snapshot):string{
  if(!snapshot.ens.length)return '';
  const identities=snapshot.ens.filter(e=>e.identity);
  const bundles=new Map<string,Set<string>>();
  for(const e of identities)if(e.identity?.kind==='resolver'){
    const key=`${e.target.address.toLowerCase()}:${e.identity.recordId}`;
    if(!bundles.has(key))bundles.set(key,new Set());bundles.get(key)!.add(e.identity.name);
  }
  const shared=[...bundles.values()].filter(names=>names.size>1);
  return `<section class="access-evidence"><div class="section-number">LIVE PERMISSION PATHS / BLOCK ${snapshot.block}</div><h3>Why access survives</h3><p>Departing wallet <code>${short(snapshot.subject)}</code>. Each row is an independent scope read from the configured contracts.</p>
  <div class="permission-paths">${snapshot.ens.map(e=>`<article class="permission-path"><div class="path-target"><b>${esc(e.target.name||e.target.label)}</b><small>${e.target.kind==='resolver'?`${esc(e.target.recordType||'Resource')} · ${esc(e.target.argument??e.target.resource)}`:'Registry permissions'}</small></div><div class="path-sources"><span class="${e.root?'path-active':''}"><b>Contract-wide</b>${esc(describeRoles(e.root,e.target.kind).join(', ')||'No roles')}</span><span class="${e.local?'path-active':''}"><b>Resource roles</b>${esc(describeRoles(e.local,e.target.kind).join(', ')||'No roles')}</span>${e.operator===null?'':`<span class="${e.operator?'path-active':''}"><b>Owner’s operator approval</b>${e.operator?'Active':'Absent'}</span>`}</div><div class="path-outcome ${e.subjectCanWrite?'path-active':''}">${e.subjectCanWrite===undefined?'Roles reported above':e.subjectCanWrite?'Can edit selected key':'Cannot edit selected key'}</div></article>`).join('')}</div>
  <p class="muted-note">Resource roles may include contract-defined inheritance. This view does not enumerate arbitrary team memberships, undeclared keys, or every name sharing a resolver. Unexplained effective text authority blocks a complete report.</p>
  ${shared.length?`<p class="blocked">Shared bundles among configured names: ${shared.map(names=>esc([...names].join(', '))).join('; ')}. Changes to a bundle affect every name linked to it.</p>`:''}
  <h3 class="preservation-title">${baseline?'Identity preservation':'Identity baseline'}</h3><p>${baseline?'Compared with the baseline snapshot.':'Captured with the permission scan. Recheck after revocation to compare.'} Only the listed records and pointers are covered.</p>
  <div class="preservation-list">${snapshot.ens.map(e=>{
    const old=baseline?.ens.find(x=>x.target.address.toLowerCase()===e.target.address.toLowerCase()&&BigInt(x.target.resource)===BigInt(e.target.resource));
    const changes=old?.identity?identityChanges(old.identity,e.identity):[];
    const status=!e.identity?'Not captured':!baseline?'Baseline captured':!old?.identity?'No comparable baseline':changes.length?'Changed':'Retained';
    const detail=e.identity?.kind==='resolver'?`ETH address, text:${e.identity.textKey}, record bundle ${e.identity.recordId}`:e.identity?'Resolver and subregistry pointers':'Add ENS name and text-key metadata to capture values.';
    return `<div><span><b>${esc(e.target.name||e.target.label)}</b><small>${esc(detail)}</small>${changes.length?`<small class="amber">${esc(changes.join(' · '))}</small>`:''}</span><strong class="${changes.length?'amber':''}">${status}</strong></div>`;
  }).join('')}</div><p class="muted-note">Permission snapshots record ownership and expiry separately. Preserved values do not imply that an endpoint service is safe or that every possible access path is closed.</p></section>`;
}

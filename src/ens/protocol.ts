import { validAgentUrl } from './agent-records';
import { encodeFunctionData, decodeFunctionResult, getAddress, keccak256, stringToHex, namehash, toHex, zeroAddress, parseEventLogs, type Address, type Hash, type Hex, type TransactionReceipt } from 'viem';
import { normalize, packetToBytes } from 'viem/ens';
import deployments from './deployments.json';
import { ensAbi, factoryAbi, profileAbi, registryInitAbi, resolverInitAbi } from './abi';
import { EAC_INTERFACE, REGISTRY_INTERFACE, RESOLVER_INTERFACE, REGISTRY_OWNER_ROLES, RESOLVER_OWNER_ROLES, NAME_OWNER_ROLES, SET_TEXT, SET_SUBREGISTRY, SET_PARENT, REGISTRAR, resolverResource } from './roles';
import { clientFor, type Target } from '../engine';

export { deployments };
type Client=ReturnType<typeof clientFor>;
export const contract=(name:keyof typeof deployments.contracts)=>getAddress(deployments.contracts[name].address);
export const equal=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
export const dns=(name:string)=>toHex(packetToBytes(normalize(name)));
export const labelId=(label:string)=>BigInt(keccak256(stringToHex(label)));
export type NameEntry={name:string;label:string;registry:Address;resource:bigint;tokenId:bigint;owner:Address;expiry:bigint;subregistry:Address;resolver:Address};
export type NameInspection={name:string;key:string;block:bigint;entries:NameEntry[];resolver:Address;resolverVerified:boolean;targets:Target[];text:string;address:Address|null;recordId:bigint|null;notes:string[]};
export type SetupState={parent:string;label:string;key:string;textValue?:string;owner?:Address;registry?:Address;resolver?:Address;resolverSalt?:string;registrySalt?:string;registrationExpiry?:string;attached?:boolean;registered?:boolean;transactions:{label:string;hash:Hash}[]};
export type SetupAction={id:string;label:string;explanation:string;to:Address;data:Hex;implementation?:Address};

async function read(client:Client,address:Address,functionName:string,args:readonly unknown[],block:bigint):Promise<any>{
  return client.readContract({address,abi:ensAbi,functionName,args,blockNumber:block} as never);
}
export async function checkNetwork(rpc:string){const c=clientFor(rpc);if(await c.getChainId()!==11155111)throw new Error('Use an Ethereum Sepolia RPC.');return c;}
export async function verifyDeployments(rpc:string):Promise<bigint>{
  const c=await checkNetwork(rpc),block=await c.getBlockNumber({cacheTime:0});
  await Promise.all(Object.values(deployments.contracts).map(async item=>{
    const code=await c.getCode({address:getAddress(item.address),blockNumber:block});
    if(!code||keccak256(code)!==item.codeHash)throw new Error(`Protocol deployment code changed at ${item.address}. Review the pinned ENS deployment before signing.`);
  }));
  return block;
}
export async function inspectName(input:string,rpc:string,key='description'):Promise<NameInspection>{
  const name=normalize(input.trim());
  if(!name||name.split('.').length>12)throw new Error('Enter an ENS name with at most 12 labels.');
  const client=await checkNetwork(rpc),block=await client.getBlockNumber({cacheTime:0});
  let registry=contract('RootRegistry'),resolver=zeroAddress as Address;
  const entries:NameEntry[]=[],targets:Target[]=[],notes:string[]=[];
  const labels=name.split('.').reverse();
  for(let i=0;i<labels.length;i++){
    const label=labels[i],currentName=labels.slice(0,i+1).reverse().join('.');
    const supported=await read(client,registry,'supportsInterface',[REGISTRY_INTERFACE],block);
    if(!supported){notes.push(`Registry for ${currentName} is not the supported ENSv2 Permissioned Registry. Traversal stopped.`);break;}
    const id=labelId(label);
    const [resource,tokenId,owner,expiry,subregistry,ownResolver]=await Promise.all([
      read(client,registry,'getResource',[id],block),read(client,registry,'getTokenId',[id],block),read(client,registry,'getOwner',[id],block),read(client,registry,'getExpiry',[id],block),read(client,registry,'getSubregistry',[label],block),read(client,registry,'getResolver',[label],block),
    ]);
    const entry={name:currentName,label,registry,resource,tokenId,owner:getAddress(owner),expiry,subregistry:getAddress(subregistry),resolver:getAddress(ownResolver)};
    entries.push(entry);
    targets.push({label:`${currentName} · registry`,address:registry,resource:String(resource),kind:'registry',name:currentName});
    if(!equal(ownResolver,zeroAddress))resolver=getAddress(ownResolver);
    if(i<labels.length-1){if(equal(subregistry,zeroAddress)){notes.push(`No subregistry beneath ${currentName}; any resolver use below it is inherited/wildcard.`);break;}registry=getAddress(subregistry);}
  }
  let resolverVerified=false,text='',address:Address|null=null,recordId:bigint|null=null;
  if(!equal(resolver,zeroAddress)){
    try{resolverVerified=await read(client,resolver,'supportsInterface',[RESOLVER_INTERFACE],block);}catch{notes.push('The effective resolver does not expose a supported ENSv2 Permissioned Resolver interface.');}
    if(resolverVerified){
      const dnsName=dns(name),node=namehash(name);
      const [,liveResource,liveRole]=await read(client,resolver,'decodeSetter',[encodeFunctionData({abi:ensAbi,functionName:'setText',args:[dnsName,key,'']})],block);
      if(liveResource!==resolverResource('text',key)||liveRole!==SET_TEXT)throw new Error('The resolver uses a different setter/resource model. This version cannot safely audit it.');
      targets.push({label:`${name} · text:${key}`,address:resolver,resource:String(liveResource),kind:'resolver',name,recordType:'text',argument:key});
      try{
        const [textResult,addressResult,id]=await Promise.all([
          read(client,resolver,'resolve',[dnsName,encodeFunctionData({abi:profileAbi,functionName:'text',args:[node,key]})],block),
          read(client,resolver,'resolve',[dnsName,encodeFunctionData({abi:profileAbi,functionName:'addr',args:[node]})],block),
          read(client,resolver,'getRecordId',[node],block),
        ]);
        text=decodeFunctionResult({abi:profileAbi,functionName:'text',data:textResult});
        address=decodeFunctionResult({abi:profileAbi,functionName:'addr',data:addressResult});recordId=id;
      }catch{notes.push('Permission scope was found, but one or more profile reads were unavailable.');}
      notes.push(`Text-key permissions apply across ALL names served by ${resolver}, not just ${name}.`);
    }
  }else notes.push('No resolver found in the traversed hierarchy.');
  return {name,key,block,entries,resolver,resolverVerified,targets,text,address,recordId,notes};
}
export function mergeTargets(existing:Target[],added:Target[]):Target[]{
  const map=new Map(existing.map(t=>[`${t.address.toLowerCase()}:${BigInt(t.resource)}`,t]));
  for(const t of added)map.set(`${t.address.toLowerCase()}:${BigInt(t.resource)}`,t);
  return [...map.values()];
}
export function setupRecordValue(state:Pick<SetupState,'key'|'textValue'>):string{
  const value=state.textValue??(state.key==='description'?'Managed by AfterKey. Access is delegated through ENSv2 EAC.':'');
  if(!state.key.trim()||!value.trim())throw new Error('Enter the text key and an actual initial record value.');
  if(/^agent-endpoint\[.*\]$/.test(state.key)&&!validAgentUrl(value))throw new Error('Agent endpoint records require an HTTP, HTTPS, or IPFS URL.');
  return value;
}
export function makeProxyAction(kind:'resolver'|'registry',owner:Address,state:SetupState,salt:bigint):SetupAction{
  const childName=normalize(`${state.label}.${state.parent}`);
  let data:Hex;
  if(kind==='resolver'){
    const calls=[
      encodeFunctionData({abi:ensAbi,functionName:'setAddress',args:[dns(childName),60n,owner]}),
      encodeFunctionData({abi:ensAbi,functionName:'setText',args:[dns(childName),state.key,setupRecordValue(state)]}),
    ];
    data=encodeFunctionData({abi:resolverInitAbi,functionName:'initialize',args:[[{account:owner,roleBitmap:RESOLVER_OWNER_ROLES}],calls]});
  }else data=encodeFunctionData({abi:registryInitAbi,functionName:'initialize',args:[[{account:owner,roleBitmap:REGISTRY_OWNER_ROLES}]]});
  const implementation=contract(kind==='resolver'?'PermissionedResolverImpl':'UserRegistryImpl');
  return {id:`deploy-${kind}`,label:`Deploy ENSv2 ${kind}`,explanation:`Create a new owner-controlled proxy using the official ENS factory and pinned implementation. The departing wallet receives no access.`,to:contract('VerifiableFactory'),data:encodeFunctionData({abi:factoryAbi,functionName:'deployProxy',args:[implementation,salt,data]}),implementation};
}
export async function nextSetupAction(state:SetupState,owner:Address,rpc:string):Promise<SetupAction|null>{
  if(state.owner&&!equal(state.owner,owner))throw new Error('This setup belongs to a different owner. Start a new setup for this wallet.');
  state.owner=owner;
  state.parent=normalize(state.parent.trim());state.label=normalize(state.label.trim());
  if(!state.parent.endsWith('.eth')||state.label.includes('.')||!state.label)throw new Error('Use an owned Sepolia .eth parent and one subname label.');
  const parent=await inspectName(state.parent,rpc,state.key);
  const entry=parent.entries.find(e=>e.name===parent.name);
  if(!entry||!equal(entry.owner,owner))throw new Error('The selected owner must own the registered, unexpired parent name on ENSv2 Sepolia. Register a name through the official ENS Sepolia app first.');
  const client=await checkNetwork(rpc),block=await client.getBlockNumber({cacheTime:0});
  if(!state.registry&&!equal(entry.subregistry,zeroAddress))state.registry=entry.subregistry;
  if(state.registry){
    if(!await read(client,state.registry,'supportsInterface',[REGISTRY_INTERFACE],block))throw new Error('The existing subregistry does not implement the supported ENSv2 registry interface.');
    const existingOwner=await read(client,state.registry,'getOwner',[labelId(state.label)],block);
    if(!equal(existingOwner,zeroAddress)&&!equal(existingOwner,owner))throw new Error('This subname belongs to another wallet. Pick a different label.');
    if(equal(existingOwner,owner)&&!state.resolver){
      const existingResolver=await read(client,state.registry,'getResolver',[state.label],block);
      if(equal(existingResolver,zeroAddress))throw new Error('This existing subname has no resolver. Configure it through ENS before using this setup.');
      if(!await read(client,existingResolver,'supportsInterface',[RESOLVER_INTERFACE],block))throw new Error('This existing name does not use a supported Permissioned Resolver.');
      if(!await read(client,existingResolver,'hasRootRoles',[SET_TEXT|(SET_TEXT<<128n),owner],block))throw new Error('The owner does not manage text permissions on the existing resolver. AfterKey will not replace it.');
      state.resolver=getAddress(existingResolver);
    }
  }
  const newSalt=()=>String(BigInt(keccak256(stringToHex(`AfterKey:${owner}:${state.parent}:${state.label}:${crypto.randomUUID()}`))));
  if(!state.resolver){state.resolverSalt??=newSalt();return makeProxyAction('resolver',owner,state,BigInt(state.resolverSalt));}
  if(!state.registry){state.registrySalt??=newSalt();return makeProxyAction('registry',owner,state,BigInt(state.registrySalt));}
  if(!await read(client,state.registry,'supportsInterface',[REGISTRY_INTERFACE],block))throw new Error('The subregistry does not implement the supported ENSv2 registry interface.');
  if(!await read(client,state.resolver,'supportsInterface',[RESOLVER_INTERFACE],block))throw new Error('The resolver does not implement the supported ENSv2 resolver interface.');
  if(equal(entry.subregistry,zeroAddress)){
    if(!await read(client,entry.registry,'hasRoles',[entry.resource,SET_SUBREGISTRY,owner],block))throw new Error('Owner does not have SET_SUBREGISTRY on the parent name.');
    return {id:'attach',label:'Attach the subname registry',explanation:'Connect the new registry to your owned parent. Existing nonzero subregistry pointers are never replaced.',to:entry.registry,data:encodeFunctionData({abi:ensAbi,functionName:'setSubregistry',args:[entry.resource,state.registry]})};
  }
  if(!equal(entry.subregistry,state.registry))throw new Error('The parent now points at a different subregistry. Setup stopped without replacing it.');
  const [actualParent,parentLabel]=await read(client,state.registry,'getParent',[],block);
  if(!equal(actualParent,entry.registry)||parentLabel!==entry.label){
    if(!equal(actualParent,zeroAddress))throw new Error('The subregistry has a different canonical parent. Setup stopped.');
    if(!await read(client,state.registry,'hasRootRoles',[SET_PARENT,owner],block))throw new Error('Owner lacks SET_PARENT on the existing subregistry.');
    return {id:'parent',label:'Set the canonical parent',explanation:'Link the child registry back to the parent so the hierarchy can be verified in both directions.',to:state.registry,data:encodeFunctionData({abi:ensAbi,functionName:'setParent',args:[entry.registry,entry.label]})};
  }
  const childId=labelId(state.label),childOwner=await read(client,state.registry,'getOwner',[childId],block);
  if(equal(childOwner,zeroAddress)){
    if(!await read(client,state.registry,'hasRootRoles',[REGISTRAR,owner],block))throw new Error('Owner lacks the registrar role on this subregistry.');
    state.registrationExpiry??=String(Math.floor(Date.now()/1000)+365*86400);
    return {id:'register',label:`Register ${state.label}.${state.parent}`,explanation:'Create an owner-controlled ENS subname linked to the dedicated resolver, with a one-year expiry. No token-transfer permission is given to the departing wallet.',to:state.registry,data:encodeFunctionData({abi:ensAbi,functionName:'register',args:[state.label,owner,zeroAddress,state.resolver,NAME_OWNER_ROLES,BigInt(state.registrationExpiry)]})};
  }
  if(!equal(childOwner,owner))throw new Error('This subname belongs to another wallet. Pick a different label.');
  const resolver=await read(client,state.registry,'getResolver',[state.label],block);
  if(!equal(resolver,state.resolver))throw new Error('This existing subname uses another resolver. Setup will not replace it.');
  state.registered=true;return null;
}
export function recordSetupReceipt(state:SetupState,action:SetupAction,receipt:TransactionReceipt,owner:Address):void{
  if(receipt.status!=='success')throw new Error('Setup transaction reverted.');
  if(action.implementation){
    const logs=parseEventLogs({abi:factoryAbi,eventName:'ProxyDeployed',logs:receipt.logs});
    const found=logs.find(l=>equal(l.address,contract('VerifiableFactory'))&&equal(l.args.sender,owner)&&equal(l.args.implementation,action.implementation!));
    if(!found)throw new Error('No matching official factory deployment event found.');
    if(action.id==='deploy-resolver')state.resolver=getAddress(found.args.proxyAddress);else state.registry=getAddress(found.args.proxyAddress);
  }
  state.transactions.push({label:action.label,hash:receipt.transactionHash});
}
export function delegationAction(state:SetupState,subject:Address,broad:boolean):SetupAction{
  if(!state.resolver||!state.registered)throw new Error('Finish the owner-controlled ENS namespace first.');
  const name=normalize(`${state.label}.${state.parent}`);
  return broad?{id:'grant-broad',label:'Grant broad test editor access',explanation:'Sepolia demo only: this intentionally gives the departing wallet SET_TEXT across every name/key served by this resolver. It does not grant admin rights.',to:state.resolver,data:encodeFunctionData({abi:ensAbi,functionName:'grantRootRoles',args:[SET_TEXT,subject]})}:
    {id:'grant-scoped',label:`Delegate only text:${state.key}`,explanation:`Give the departing wallet only the ${state.key} text-key role across names served by this dedicated resolver. No root/admin role is granted.`,to:state.resolver,data:encodeFunctionData({abi:ensAbi,functionName:'grantSetterRoles',args:[encodeFunctionData({abi:ensAbi,functionName:'setText',args:[dns(name),state.key,'']}),subject]})};
}

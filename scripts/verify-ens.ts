import fs from 'node:fs';
import { encodeFunctionData } from 'viem';
import { verifyDeployments, verifyFactoryProxy, inspectName, contract } from '../src/ens/protocol';
import { resolverResource, SET_TEXT } from '../src/ens/roles';
import { ensAbi } from '../src/ens/abi';
import { scan, clientFor, DEFAULT_RPC } from '../src/engine';
import { WORKSPACE_OWNER, WORKSPACE_SUBJECT } from '../src/workspace';

const rpc=process.env.SEPOLIA_RPC_URL||DEFAULT_RPC;
let stage='deployment code checks';
try{
  const deploymentBlock=await verifyDeployments(rpc);
  stage='live registry hierarchy';
  const inspection=await inspectName(process.argv[2]||'eth',rpc);
  let resolverImplementation:string|null=null,registryImplementation:string|null=null;
  if(process.argv[2]){
    stage='official factory provenance';
    if(!inspection.resolverVerified)throw new Error('The requested name does not resolve through a supported Permissioned Resolver.');
    resolverImplementation=await verifyFactoryProxy(clientFor(rpc),inspection.resolver,contract('PermissionedResolverImpl'),inspection.block);
    const leaf=inspection.entries.at(-1);
    if(!leaf)throw new Error('No leaf registry was discovered.');
    registryImplementation=await verifyFactoryProxy(clientFor(rpc),leaf.registry,contract('UserRegistryImpl'),inspection.block);
  }
  stage='deployed resolver resource calculation';
  const setter=encodeFunctionData({abi:ensAbi,functionName:'setText',args:['0x00','description','']});
  const [,resource,role]=await clientFor(rpc).readContract({address:contract('PermissionedResolverImpl'),abi:ensAbi,functionName:'decodeSetter',args:[setter]});
  if(resource!==resolverResource('text','description')||role!==SET_TEXT)throw new Error('Live resolver resource/role calculation mismatch.');
  stage='permission scanner';
  const snapshot=await scan({owner:WORKSPACE_OWNER,subject:WORKSPACE_SUBJECT,rpc,targets:inspection.targets,scanUniswap:false});
  const result={method:'Read-only live Sepolia checks; no writes or privileged-call simulations',deploymentCodeCheckedAt:String(deploymentBlock),name:inspection.name,hierarchyEntries:inspection.entries.length,factoryProvenanceChecked:Boolean(process.argv[2]),resolverImplementation,registryImplementation,resourceVerified:String(resource),roleVerified:String(role),scanBlock:String(snapshot.block),ensTargets:snapshot.ens.length,scanComplete:snapshot.complete,findings:snapshot.findings.length,errors:snapshot.errors,qualification:'This checks real protocol integration, not a wallet-signed offboarding demo.'};
  fs.writeFileSync('docs/ens-live-read-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
  if(!snapshot.complete)process.exitCode=1;
}catch(error){console.error({stage,message:error&&typeof error==='object'&&'shortMessage'in error?error.shortMessage:String(error)});process.exitCode=1;}

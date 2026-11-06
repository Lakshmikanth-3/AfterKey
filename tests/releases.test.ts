import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createServer } from 'node:net';
import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem';
import { encodeAbiParameters, encodePacked, keccak256, toHex } from 'viem';
import { encodeConfiguration, reportParams, configurationProblems, consumerCoverage, affectedNames } from '../src/releases/model';
// The compiler is shared with the browser deployment artifact.
// @ts-expect-error Plain JavaScript build utility.
import { compileRelease } from '../scripts/compile-release.mjs';

test('release gate binds CRE approval, ENS candidate, consumers and LP execution',async()=>{
  const require=createRequire(import.meta.url),toolRequire=createRequire(require.resolve('@afterkey/evm-tests/package.json'));
  const platform=process.platform==='win32'?'win32':process.platform;
  const arch=process.arch==='x64'?'amd64':process.arch;
  const binary=join(dirname(toolRequire.resolve(`@foundry-rs/anvil-${platform}-${arch}/package.json`)),'bin',process.platform==='win32'?'anvil.exe':'anvil');
  const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=(server.address() as {port:number}).port;await new Promise<void>(resolve=>server.close(()=>resolve()));
  const processNode=spawn(binary,['--host','127.0.0.1','--port',String(port),'--hardfork','shanghai','--silent'],{windowsHide:true,stdio:'ignore'});
  let launchError:Error|undefined;processNode.on('error',e=>{launchError=e;});
  try {
    const transport=http(`http://127.0.0.1:${port}`,{retryCount:0,timeout:1000}),publicClient=createPublicClient({transport,cacheTime:0});
    let ready=false;
    for(let attempt=0;attempt<50;attempt++){if(launchError)throw launchError;try{await publicClient.getChainId();ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
    assert.ok(ready,'Local Anvil EVM did not start');
    const accounts=await publicClient.request({method:'eth_accounts' as any}) as Address[];
    const [owner,old,next,outsider]=accounts;
    const wallets=accounts.map(account=>createWalletClient({transport,account}));
    const contracts=compileRelease({'contracts/test/VaultFixtures.sol':{content:fs.readFileSync('contracts/test/VaultFixtures.sol','utf8')},'contracts/test/ReleaseFixtures.sol':{content:fs.readFileSync('contracts/test/ReleaseFixtures.sol','utf8')}});
    const fixture=(name:string)=>contracts['contracts/test/VaultFixtures.sol'][name];
    const deploy=async(c:any,args:any[]=[])=>{
      const hash=await wallets[0].deployContract({abi:c.abi,bytecode:('0x'+c.evm.bytecode.object) as Hex,args,chain:null,gas:6000000n});
      const receipt=await publicClient.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');return receipt.contractAddress!;
    };

    const release=(name:string)=>contracts['contracts/ENSReleaseGate.sol'][name];
    const support=(name:string)=>contracts['contracts/test/ReleaseFixtures.sol'][name];
    const resolver=await deploy(support('CandidateResolverFixture')),manager=await deploy(fixture('PositionFixture'));
    const registry=await deploy(fixture('RegistryFixture'),[owner,resolver]),forwarder=await deploy(support('ForwarderFixture'));
    const workflowId=keccak256(toHex('release-workflow'));
    const gate=await deploy(release('ENSReleaseGate'),[owner,manager,registry,resolver,'agent','0x056167656e740365746800',forwarder,owner,workflowId]);
    const first=await deploy(release('ReleaseLPVault'),[gate,7n]),second=await deploy(release('ReleaseLPVault'),[gate,8n]);
    const write=async(index:number,address:Address,c:any,functionName:string,args:any[]=[])=>{
      const {request}=await publicClient.simulateContract({address,abi:c.abi,functionName,args,account:accounts[index]});
      const hash=await wallets[index].writeContract({...request,chain:null,gas:6000000n} as any);
      const receipt=await publicClient.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');
    };
    const read=(address:Address,c:any,functionName:string,args:any[]=[])=>publicClient.readContract({address,abi:c.abi,functionName,args});
    const denied=(index:number,address:Address,c:any,fn:string,args:any[]=[])=>assert.rejects(publicClient.simulateContract({address,abi:c.abi,functionName:fn,args,account:accounts[index]}));
    const g=release('ENSReleaseGate'),v=release('ReleaseLPVault'),r=support('CandidateResolverFixture'),f=support('ForwarderFixture');
    for(const [vault,id] of [[first,7n],[second,8n]] as const){
      await write(0,manager,fixture('PositionFixture'),'mint',[owner,id]);
      await write(0,gate,g,'registerConsumer',[vault]);
      await write(0,manager,fixture('PositionFixture'),'safeTransferFrom',[owner,vault,id]);
    }
    const now=(await publicClient.getBlock()).timestamp,chain=BigInt(await publicClient.getChainId());
    const config={operator:old,treasury:owner,manager,expiry:now+3600n};
    const set=async(c:typeof config)=>{const payload=encodeConfiguration(c);await write(0,resolver,r,'setData',['0x','afterkey.release',payload]);return keccak256(payload);};
    const metadata=encodePacked(['bytes32','bytes10','address','bytes2'],[workflowId,'0x00000000000000000000',owner,'0x0000']);
    const report=(digest:Hex,epoch:bigint,passed=true,coverage=consumerCoverage([first,second]),until=now+600n)=>encodeAbiParameters(reportParams,[chain,gate,digest,epoch,coverage,until,passed]);
    const digest=await set(config);
    await denied(1,gate,g,'activate',[digest,0n]);await denied(0,gate,g,'activate',[digest,0n]);
    await denied(0,gate,g,'onReport',[metadata,report(digest,0n)]);
    const badMeta=encodePacked(['bytes32','bytes10','address','bytes2'],[keccak256(toHex('wrong')),'0x00000000000000000000',owner,'0x0000']);
    await denied(0,forwarder,f,'deliver',[gate,badMeta,report(digest,0n)]);
    await denied(0,forwarder,f,'deliver',[gate,metadata,report(digest,0n,true,consumerCoverage([first]))]);
    await denied(0,forwarder,f,'deliver',[gate,metadata,report(digest,0n,true,consumerCoverage([first,second]),now-1n)]);
    await write(0,forwarder,f,'deliver',[gate,metadata,report(digest,0n,false)]);await denied(0,gate,g,'activate',[digest,0n]);
    await write(0,forwarder,f,'deliver',[gate,metadata,report(digest,0n)]);
    const changed=await set({...config,operator:next});await denied(0,gate,g,'activate',[digest,0n]);
    await set(config);await write(0,gate,g,'activate',[digest,0n]);
    await write(1,first,v,'collect',[digest,1n]);await write(1,second,v,'collect',[digest,1n]);
    assert.equal(String(await read(manager,fixture('PositionFixture'),'lastRecipient')).toLowerCase(),owner.toLowerCase());
    await denied(2,first,v,'collect',[digest,1n]);await denied(1,first,v,'release');
    // Staging a candidate does not mutate the active treasury configuration.
    await set({...config,operator:next});await write(1,first,v,'collect',[digest,1n]);
    await write(0,forwarder,f,'deliver',[gate,metadata,report(changed,1n)]);await write(0,gate,g,'activate',[changed,1n]);
    await denied(1,first,v,'collect',[digest,1n]);await denied(2,first,v,'collect',[changed,1n]);
    await write(2,first,v,'collect',[changed,2n]);
    await denied(0,forwarder,f,'deliver',[gate,metadata,report(changed,1n)]);
    const invalid=await set({...config,treasury:outsider});
    await write(0,forwarder,f,'deliver',[gate,metadata,report(invalid,2n)]);await denied(0,gate,g,'activate',[invalid,2n]);
    // Registering another dependency invalidates coverage, even for an active release.
    const third=await deploy(v,[gate,9n]);await write(0,manager,fixture('PositionFixture'),'mint',[owner,9n]);await write(0,gate,g,'registerConsumer',[third]);
    await denied(2,first,v,'collect',[changed,2n]);
    await denied(0,forwarder,f,'deliver',[gate,metadata,report(invalid,2n)]);
    await denied(1,gate,g,'bindWorkflow',[workflowId]);
    await write(0,gate,g,'bindWorkflow',[workflowId]);
    assert.equal(await read(gate,g,'epoch'),3n);
    await write(0,gate,g,'setPaused',[true]);await denied(2,first,v,'collect',[changed,2n]);
    await write(0,first,v,'release');assert.equal(String(await read(manager,fixture('PositionFixture'),'ownerOf',[7n])).toLowerCase(),owner.toLowerCase());
  } finally {processNode.kill();}
});
test('configuration policy and shared-bundle impact are explicit',()=>{
  const owner='0x1111111111111111111111111111111111111111',manager='0x2222222222222222222222222222222222222222';
  const c={operator:manager,treasury:owner,manager,expiry:5000n} as any;
  assert.deepEqual(configurationProblems(c,owner,manager,1000n),[]);
  assert.equal(configurationProblems({...c,treasury:manager},owner,manager,1000n).length,1);
  const source={name:'one.eth',resolver:owner,recordId:'1'};
  assert.deepEqual(affectedNames(source,[source,{...source,name:'two.eth'},{...source,name:'three.eth',recordId:'2'}]),['one.eth','two.eth']);
  assert.deepEqual(affectedNames({...source,recordId:'0'},[{...source,recordId:'0'}]),[]);
});

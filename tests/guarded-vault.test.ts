import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createServer } from 'node:net';
import { createPublicClient, createWalletClient, http, type Address, type Hex } from 'viem';
import { matchesVaultCode } from '../src/guarded/client';
// The compiler is shared with the browser deployment artifact.
// @ts-expect-error Plain JavaScript build utility.
import { compileVault } from '../scripts/compile-vault.mjs';

test('vault enforces ENS revocation, replacement, fixed recipient and owner recovery on an EVM',async()=>{
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
    const contracts=compileVault({'contracts/test/VaultFixtures.sol':{content:fs.readFileSync('contracts/test/VaultFixtures.sol','utf8')}});
    const fixture=(name:string)=>contracts['contracts/test/VaultFixtures.sol'][name];
    const deploy=async(c:any,args:any[]=[])=>{
      const hash=await wallets[0].deployContract({abi:c.abi,bytecode:('0x'+c.evm.bytecode.object) as Hex,args,chain:null,gas:6000000n});
      const receipt=await publicClient.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');return receipt.contractAddress!;
    };
    const resolver=await deploy(fixture('ResolverFixture')),manager=await deploy(fixture('PositionFixture'));
    const registry=await deploy(fixture('RegistryFixture'),[owner,resolver]);
    const v=contracts['contracts/ENSPositionVault.sol'].ENSPositionVault;
    const vault=await deploy(v,[owner,owner,manager,registry,resolver,7n,'agent','afterkey.lp.collect.7']);
    const code=await publicClient.getCode({address:vault});assert.ok(code&&matchesVaultCode(code));
    assert.equal(matchesVaultCode((code!.slice(0,-2)+'00') as Hex),false);
    const write=async(index:number,address:Address,c:any,functionName:string,args:any[]=[])=>{
      const {request}=await publicClient.simulateContract({address,abi:c.abi,functionName,args,account:accounts[index]});
      const gas=await publicClient.estimateContractGas({address,abi:c.abi,functionName,args,account:accounts[index]});
      const hash=await wallets[index].writeContract({...request,chain:null,gas:gas*120n/100n} as any);
      const receipt=await publicClient.waitForTransactionReceipt({hash});assert.equal(receipt.status,'success');
    };
    const read=(address:Address,c:any,functionName:string,args:any[]=[])=>publicClient.readContract({address,abi:c.abi,functionName,args});
    const denied=async(index:number,fn:string,args:any[]=[])=>assert.rejects(publicClient.simulateContract({address:vault,abi:v.abi,functionName:fn,args,account:accounts[index]}));
    await write(0,manager,fixture('PositionFixture'),'mint',[owner,7n]);
    await write(0,manager,fixture('PositionFixture'),'safeTransferFrom',[owner,vault,7n]);
    const now=(await publicClient.getBlock()).timestamp;
    await write(0,vault,v,'setOperator',[old,now+3600n]);
    await denied(1,'collect'); // Selecting an operator does not grant ENS authority.
    await write(0,resolver,fixture('ResolverFixture'),'grant',[old,true]);
    await write(1,vault,v,'collect');
    assert.equal(String(await read(manager,fixture('PositionFixture'),'lastRecipient')).toLowerCase(),owner.toLowerCase());
    await denied(1,'release');await denied(1,'setOperator',[outsider,now+3600n]);await denied(1,'setPaused',[false]);
    await write(0,resolver,fixture('ResolverFixture'),'grant',[old,false]);await denied(1,'collect');
    await write(0,resolver,fixture('ResolverFixture'),'grant',[old,true]);
    await write(0,resolver,fixture('ResolverFixture'),'grant',[next,true]);
    await write(0,vault,v,'setOperator',[next,now+3600n]);await denied(1,'collect');await write(2,vault,v,'collect');
    await write(0,vault,v,'setPaused',[true]);await denied(2,'collect');await write(0,vault,v,'setPaused',[false]);
    // A changed ownership, resolver, expiry or registration version invalidates the mandate.
    for(const args of [[outsider,resolver,now+3600n,0n],[owner,outsider,now+3600n,0n],[owner,resolver,1n,0n],[owner,resolver,now+3600n,1n]]){
      await write(0,registry,fixture('RegistryFixture'),'change',args);await denied(2,'collect');
    }
    await write(0,registry,fixture('RegistryFixture'),'change',[owner,resolver,now+3600n,0n]);
    await write(0,vault,v,'setOperator',[next,(await publicClient.getBlock({blockTag:'latest'})).timestamp+2n]);
    await publicClient.request({method:'evm_increaseTime' as any,params:[10] as any});await publicClient.request({method:'evm_mine' as any,params:[] as any});await denied(2,'collect');
    await write(0,vault,v,'release');
    assert.equal(String(await read(manager,fixture('PositionFixture'),'ownerOf',[7n])).toLowerCase(),owner.toLowerCase());
    assert.equal(await read(vault,v,'paused'),true);
  } finally { processNode.kill(); }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addWallet, availableWallets, walletDiscovery, type WalletChoice, type WalletProvider } from '../src/wallet';

test('announced MetaMask is selectable independently of a MathWallet default provider',async()=>{
  const calls:string[]=[];
  const math:WalletProvider={request:async()=>{calls.push('math');return [];}};
  const metamask:WalletProvider={request:async()=>{calls.push('metamask');return [];}};
  const choices:WalletChoice[]=[];
  addWallet(choices,{info:{uuid:'math',name:'MathWallet',rdns:'io.mathwallet'},provider:math});
  addWallet(choices,{info:{uuid:'meta',name:'MetaMask',rdns:'io.metamask'},provider:metamask});
  const selected=availableWallets(choices,math).find(w=>w.name==='MetaMask')!;
  await selected.provider.request({method:'eth_accounts'});
  assert.deepEqual(calls,['metamask']);
  assert.equal(selected.provider,metamask);
});

test('repeated or conflicting announcements do not replace an existing provider',()=>{
  const choices:WalletChoice[]=[];
  const provider:WalletProvider={request:async()=>[]};
  const detail={info:{uuid:'same',name:'MetaMask',rdns:'io.metamask'},provider};
  assert.ok(addWallet(choices,detail));
  assert.equal(addWallet(choices,detail),false);
  assert.equal(addWallet(choices,{...detail,provider:{request:async()=>[]}}),false);
  assert.equal(addWallet(choices,{info:{uuid:'bad',name:'Invalid',rdns:'x'},provider:{}}),false);
  assert.equal(choices.length,1);assert.equal(choices[0].provider,provider);
  assert.equal(availableWallets([],provider)[0].name,'Browser default wallet');
});

test('discovery keeps listening for late announcements and never requests wallet accounts',()=>{
  const surface=new EventTarget(),provider:WalletProvider={request:async()=>{throw new Error('Discovery must not request accounts');}};
  const discovery=walletDiscovery(surface as unknown as Window,()=>undefined);
  assert.deepEqual(discovery.list(),[]);
  let updates=0;const stop=discovery.subscribe(()=>updates++);
  surface.addEventListener('eip6963:requestProvider',()=>surface.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'late',name:'MetaMask',rdns:'io.metamask'},provider}})));
  discovery.request();discovery.request();
  assert.equal(updates,1);assert.equal(discovery.list()[0].provider,provider);
  stop();
});

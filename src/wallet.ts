export type WalletProvider={
  request(args:{method:string;params?:unknown[]}):Promise<any>;
  on?(event:string,listener:(...args:any[])=>void):void;
  removeListener?(event:string,listener:(...args:any[])=>void):void;
  providers?:WalletProvider[];
};
export type WalletChoice={id:string;name:string;rdns:string;provider:WalletProvider};
type Announcement={info:{uuid:string;name:string;rdns:string};provider:WalletProvider};

export function addWallet(wallets:WalletChoice[],input:unknown):boolean{
  const detail=input as Partial<Announcement>|null;
  if(!detail?.info||typeof detail.info.uuid!=='string'||!detail.info.uuid||typeof detail.info.name!=='string'||!detail.info.name.trim()||typeof detail.info.rdns!=='string'||typeof detail.provider?.request!=='function')return false;
  if(wallets.some(w=>w.id===detail.info!.uuid||w.provider===detail.provider))return false;
  wallets.push({id:detail.info.uuid,name:detail.info.name.slice(0,80),rdns:detail.info.rdns.slice(0,120),provider:detail.provider});
  return true;
}

export function availableWallets(announced:WalletChoice[],fallback?:WalletProvider):WalletChoice[]{
  if(announced.length)return [...announced];
  const providers=fallback?.providers?.length?fallback.providers:fallback?[fallback]:[];
  return [...new Set(providers)].filter(p=>typeof p?.request==='function').map((provider,i)=>({id:`legacy-${i}`,name:providers.length===1?'Browser default wallet':`Injected wallet ${i+1}`,rdns:'Legacy provider · identity not identified',provider}));
}

export function walletDiscovery(surface:Window,fallback:()=>WalletProvider|undefined){
  const wallets:WalletChoice[]=[];
  const listeners=new Set<()=>void>();
  surface.addEventListener('eip6963:announceProvider',event=>{if(addWallet(wallets,(event as CustomEvent).detail))listeners.forEach(listener=>listener());});
  const request=()=>surface.dispatchEvent(new Event('eip6963:requestProvider'));
  request();
  return {request,list:()=>availableWallets(wallets,fallback()),subscribe:(listener:()=>void)=>{listeners.add(listener);return ()=>listeners.delete(listener);}};
}

// A wallet choice never authorizes a transaction; it only selects an EIP-1193 provider.
export function selectWallet(discovery:ReturnType<typeof walletDiscovery>):Promise<WalletChoice|null>{
  return new Promise(resolve=>{
    const dialog=document.createElement('dialog');dialog.className='wallet-dialog';dialog.setAttribute('aria-label','Choose your wallet');
    const heading=document.createElement('h2');heading.textContent='Choose your wallet';
    const note=document.createElement('p');note.textContent='Select MetaMask to use your registered ENS owner account.';
    const list=document.createElement('div');list.className='wallet-choices';
    const help=document.createElement('p');help.className='muted-note';help.textContent='Missing MetaMask? Unlock the extension, cancel any other wallet prompt, then refresh this list. Wallet names are reported by the extensions.';
    const controls=document.createElement('div');controls.className='ens-controls';
    const refresh=document.createElement('button');refresh.className='button';refresh.textContent='Refresh wallets';refresh.onclick=()=>{discovery.request();paint();};
    const cancel=document.createElement('button');cancel.className='button';cancel.textContent='Cancel';cancel.onclick=()=>finish(null);
    controls.append(refresh,cancel);dialog.append(heading,note,list,help,controls);
    const finish=(choice:WalletChoice|null)=>{unsubscribe();dialog.close();dialog.remove();resolve(choice);};
    const paint=()=>{
      list.replaceChildren();
      const choices=discovery.list();
      if(!choices.length){const empty=document.createElement('p');empty.textContent='No browser wallet detected. Open this app in Chrome with MetaMask enabled.';list.append(empty);}
      for(const choice of choices){
        const button=document.createElement('button');button.className='wallet-choice';
        const name=document.createElement('strong');name.textContent=choice.name;
        const origin=document.createElement('small');origin.textContent=choice.rdns;
        button.append(name,origin);button.onclick=()=>finish(choice);list.append(button);
      }
    };
    const unsubscribe=discovery.subscribe(paint);
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
    document.body.append(dialog);paint();dialog.showModal();discovery.request();cancel.focus();
  });
}

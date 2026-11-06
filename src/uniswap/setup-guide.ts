export const SEPOLIA_USDC='0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

export function positionSetupGuide():string {
  return `<aside class="uni-setup" aria-label="Sepolia position setup"><h3>Select the network first</h3><p>In Uniswap’s token picker, clear the search and use the network dropdown beside the network icon. Searching “Sepolia” finds token names.</p><dl class="protocol-metrics"><div><dt>Network</dt><dd>Sepolia · 11155111</dd></div><div><dt>First token</dt><dd>Native ETH</dd></div><div><dt>Second token</dt><dd>Circle test USDC</dd></div><div><dt>Fee tier</dt><dd>0.3%</dd></div></dl><p class="muted-note">Tokens named SETH, SEP or “Sepolia ETH” are not a substitute for selecting the Sepolia network. Choose the native ETH entry.</p><details><summary>Get and verify test USDC</summary><p>Open Circle’s faucet, choose Ethereum Sepolia and enter your owner wallet. In Uniswap, find USDC using its full address:</p><code class="calldata">${SEPOLIA_USDC}</code><div class="ens-controls"><button type="button" class="button" id="uni-copy-usdc">Copy USDC address</button><a class="button" href="https://faucet.circle.com/" target="_blank" rel="noreferrer">Get test USDC ↗</a><a class="button" href="https://developers.circle.com/stablecoins/usdc-contract-addresses" target="_blank" rel="noreferrer">Verify with Circle ↗</a></div><p id="uni-copy-status" role="status"></p></details></aside>`;
}
export function bindPositionSetupGuide(){
  const button=document.querySelector<HTMLButtonElement>('#uni-copy-usdc');
  if(button)button.onclick=async()=>{
    const status=document.getElementById('uni-copy-status');
    try{await navigator.clipboard.writeText(SEPOLIA_USDC);if(status)status.textContent='Sepolia USDC address copied.';}
    catch{if(status)status.textContent='Clipboard unavailable. Select and copy the address above.';}
  };
}

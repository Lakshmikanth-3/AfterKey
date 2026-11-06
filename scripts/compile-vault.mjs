import fs from 'node:fs';
import solc from 'solc';
const path='contracts/ENSPositionVault.sol';
export function compileVault(extra={}) {
  const sources={[path]:{content:fs.readFileSync(path,'utf8')},...extra};
  const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','evm.deployedBytecode.immutableReferences']}}}})));
  const errors=(output.errors??[]).filter(e=>e.severity==='error');
  if(errors.length)throw new Error(errors.map(e=>e.formattedMessage).join('\n'));
  return output.contracts;
}
if(process.argv[1]?.endsWith('compile-vault.mjs')) {
  const c=compileVault()[path].ENSPositionVault;
  fs.mkdirSync('src/guarded',{recursive:true});
  fs.writeFileSync('src/guarded/artifact.json',JSON.stringify({compiler:solc.version(),abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,runtime:'0x'+c.evm.deployedBytecode.object,immutableReferences:c.evm.deployedBytecode.immutableReferences},null,2)+'\n');
  console.log('Compiled ENSPositionVault');
}

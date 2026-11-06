import fs from 'node:fs';
import {compileVault} from './compile-vault.mjs';
export function compileRelease(extra={}){
  return compileVault({'contracts/ENSReleaseGate.sol':{content:fs.readFileSync('contracts/ENSReleaseGate.sol','utf8')},...extra});
}
if(process.argv[1]?.endsWith('compile-release.mjs')){
  const contracts=compileRelease()['contracts/ENSReleaseGate.sol'];fs.mkdirSync('src/releases',{recursive:true});
  for(const name of ['ENSReleaseGate','ReleaseLPVault']){
    const c=contracts[name];fs.writeFileSync(`src/releases/${name}.json`,JSON.stringify({abi:c.abi,bytecode:'0x'+c.evm.bytecode.object,runtime:'0x'+c.evm.deployedBytecode.object,immutableReferences:c.evm.deployedBytecode.immutableReferences})+'\n');
  }
  console.log('Compiled ENS release gate and LP consumer');
}

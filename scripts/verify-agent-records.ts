import { writeFile } from 'node:fs/promises';
import { readAgentProfile } from '../src/ens/agent-records';
import { inspectName } from '../src/ens/protocol';
import { DEFAULT_RPC, serialize } from '../src/engine';

const name=process.argv[2]||'sepolia-testnet.eth';
const expected=name==='sepolia-testnet.eth'?'0x99920488E2cA7EDDFc8dC127Dd8067284dFA4a83':undefined;
const [mainnet,sepolia,namespace]=await Promise.all([
  readAgentProfile(name,'mainnet',DEFAULT_RPC,expected),
  readAgentProfile(name,'sepolia',DEFAULT_RPC,expected),
  inspectName(name,DEFAULT_RPC,'agent-context'),
]);
const result={checkedAt:new Date().toISOString(),method:'Live read-only Universal Resolver and ENSv2 hierarchy calls',mainnet,sepolia,sepoliaNamespace:namespace};
await writeFile('docs/ens-agent-live-read-check.json',serialize(result)+'\n');
console.log(serialize(result));
if(!mainnet.complete||!sepolia.complete)process.exitCode=1;

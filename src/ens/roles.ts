import { encodeAbiParameters, keccak256, stringToHex, type Hex } from 'viem';

// Current Sepolia deployment, ENS source commit 07e55a0. Each role uses one nybble.
export const EAC_INTERFACE = '0x0132e43d' as Hex;
export const REGISTRY_INTERFACE = '0xc18bd555' as Hex;
export const RESOLVER_INTERFACE = '0x8c2427cc' as Hex;
export const SET_TEXT = 1n << 4n;
export const SET_ADDRESS = 1n;
export const SET_DATA = 1n << 24n;
export const SET_SUBREGISTRY = 1n << 20n;
export const SET_RESOLVER = 1n << 24n;
export const SET_PARENT = 1n << 8n;
export const REGISTRAR = 1n;
export const withAdmins = (mask: bigint) => mask | (mask << 128n);
export const RESOLVER_OWNER_ROLES = withAdmins(SET_TEXT | SET_ADDRESS | SET_DATA | (1n << 28n));
export const REGISTRY_OWNER_ROLES = withAdmins(REGISTRAR | SET_PARENT | SET_SUBREGISTRY | SET_RESOLVER | (1n << 16n));
export const NAME_OWNER_ROLES = withAdmins(SET_SUBREGISTRY | SET_RESOLVER) | (1n << 156n);
export const recordRole=(type:'text'|'data'|'coin'|'abi'|'interface')=>({text:SET_TEXT,data:1n<<24n,coin:SET_ADDRESS,abi:1n<<12n,interface:1n<<16n}[type]);
const names = {
  registry: ['REGISTER','REGISTER_RESERVED','SET_PARENT','UNREGISTER','RENEW','SET_SUBREGISTRY','SET_RESOLVER','CAN_TRANSFER',undefined,'SET_URI'],
  resolver: ['SET_ADDRESS','SET_TEXT','SET_CONTENTHASH','SET_ABI','SET_INTERFACE','SET_NAME','SET_DATA','LINK_RECORDS'],
};
export function describeRoles(bitmap: bigint, kind: 'registry' | 'resolver'): string[] {
  const result: string[] = [];
  for(let slot=0;slot<64;slot++) {
    if((bitmap & (1n << BigInt(slot*4)))===0n)continue;
    const index=slot%32;
    const label=index===30?'CAN_NAME':index===31?'UPGRADE':names[kind][index]||`ROLE_${index}`;
    result.push(label+(slot>=32?'_ADMIN':''));
  }
  return result;
}
export function resolverResource(type: 'text'|'data'|'coin'|'abi'|'interface', argument: string): bigint {
  if(type==='text'||type==='data') {
    if(!argument.length)throw new Error('A record key is required.');
    return BigInt(keccak256(stringToHex(argument)));
  }
  if(type==='interface') {
    if(!/^0x[0-9a-fA-F]{8}$/.test(argument))throw new Error('Interface ID must be exactly four bytes.');
    return BigInt(keccak256(argument as Hex));
  }
  const value=BigInt(argument);
  if(value<0n||value>=2n**256n)throw new Error('Argument must fit uint256.');
  return BigInt(keccak256(encodeAbiParameters([{type:'uint256'}],[value])));
}

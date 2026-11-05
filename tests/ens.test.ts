import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeFunctionData, encodeAbiParameters, getAddress, keccak256, stringToHex, zeroAddress, type Address } from 'viem';
import { describeRoles, resolverResource, SET_TEXT, RESOLVER_OWNER_ROLES } from '../src/ens/roles';
import { makeProxyAction, delegationAction, mergeTargets, dns, contract, recordSetupReceipt, type SetupState } from '../src/ens/protocol';
import { factoryAbi, resolverInitAbi, ensAbi } from '../src/ens/abi';
import { compareOwner, validateConfig, type Snapshot } from '../src/engine';

const owner=getAddress('0x2cE812CF03d1F252C940aFf954E15D5E49bBedd5');
const subject=getAddress('0x22225204824EdF00b3c8c32A43f1C04246e2d1b4');
const state=():SetupState=>({parent:'team.eth',label:'treasury-agent',key:'description',transactions:[]});
test('resolver scopes use the setter argument alone, not the namehash',()=>{
  assert.equal(resolverResource('text','description'),BigInt(keccak256(stringToHex('description'))));
  assert.equal(resolverResource('data','description'),resolverResource('text','description'));
  assert.equal(resolverResource('coin','60'),BigInt(keccak256(encodeAbiParameters([{type:'uint256'}],[60n]))));
  assert.equal(resolverResource('interface','0x12345678'),BigInt(keccak256('0x12345678')));
  assert.throws(()=>resolverResource('interface','0x1234567890'),/four bytes/);
  assert.throws(()=>resolverResource('coin','-1'),/uint256/);
});
test('admin roles are distinguished from ordinary editor roles',()=>{
  assert.deepEqual(describeRoles(SET_TEXT,'resolver'),['SET_TEXT']);
  assert.deepEqual(describeRoles(SET_TEXT|(SET_TEXT<<128n),'resolver'),['SET_TEXT','SET_TEXT_ADMIN']);
  assert.deepEqual(describeRoles(1n<<156n,'registry'),['CAN_TRANSFER_ADMIN']);
});
test('official proxy initialization grants only the owner and establishes actual record calldata',()=>{
  const action=makeProxyAction('resolver',owner,state(),19n);
  assert.equal(action.to,contract('VerifiableFactory'));
  const deployed=decodeFunctionData({abi:factoryAbi,data:action.data});
  assert.equal(deployed.functionName,'deployProxy');
  const [implementation,salt,initializer]=deployed.args!;
  assert.equal(getAddress(implementation),contract('PermissionedResolverImpl'));assert.equal(salt,19n);
  const init=decodeFunctionData({abi:resolverInitAbi,data:initializer});
  const [grants,calls]=init.args!;
  assert.equal(grants.length,1);assert.equal(getAddress(grants[0].account),owner);assert.equal(grants[0].roleBitmap,RESOLVER_OWNER_ROLES);
  const addressCall=decodeFunctionData({abi:ensAbi,data:calls[0]});
  assert.equal(addressCall.functionName,'setAddress');assert.deepEqual(addressCall.args,[dns('treasury-agent.team.eth'),60n,owner.toLowerCase()]);
});
test('scoped delegation uses grantSetterRoles; broad demo does not grant ADMIN',()=>{
  const s={...state(),resolver:contract('PermissionedResolverImpl'),registered:true};
  const scoped=decodeFunctionData({abi:ensAbi,data:delegationAction(s,subject,false).data});
  assert.equal(scoped.functionName,'grantSetterRoles');assert.equal(getAddress(scoped.args![1] as Address),subject);
  const broad=decodeFunctionData({abi:ensAbi,data:delegationAction(s,subject,true).data});
  assert.equal(broad.functionName,'grantRootRoles');assert.equal(broad.args![0],SET_TEXT);
  assert.throws(()=>delegationAction(state(),subject,true),/Finish/);
});
test('scope discovery deduplicates identical canonical contract/resource pairs',()=>{
  const target={label:'profile',address:owner,resource:'1',kind:'resolver' as const};
  assert.equal(mergeTargets([target],[{...target,resource:'0x01'}]).length,1);
  assert.equal(mergeTargets([target],[{...target,resource:'2'}]).length,2);
});
test('ENS ownership loss is detected even when owner EAC roles remain unchanged',()=>{
  const before={owner,subject,positionCount:0n,positions:[],ens:[{target:{label:'name',address:owner,resource:'1',kind:'registry'},root:0n,local:0n,ownerRoot:1n,ownerLocal:1n,operator:false,registryOwner:owner}]} as unknown as Snapshot;
  const after=structuredClone(before);after.ens[0].registryOwner=subject;
  assert.match(compareOwner(before,after).join(' '),/ownership changed/);
});
test('a successful receipt without a matching factory event is not a deployment',()=>{
  const action=makeProxyAction('resolver',owner,state(),1n);
  assert.throws(()=>recordSetupReceipt(state(),action,{status:'success',logs:[]} as any,owner),/No matching/);
});
test('incorrect text-key metadata cannot silently audit a different resource',()=>{
  assert.throws(()=>validateConfig({owner,subject,rpc:'https://example.com',targets:[{label:'description',address:owner,kind:'resolver',resource:'1',recordType:'text',argument:'description'}]}),/does not match/);
});
test('owner effective record authorization must be retained independently of bitmap comparisons',()=>{
  const before={owner,subject,positionCount:0n,positions:[],ens:[{target:{label:'description',address:owner,resource:'1',kind:'resolver'},root:0n,local:0n,ownerRoot:0n,ownerLocal:0n,ownerCanWrite:true,operator:null}]} as unknown as Snapshot;
  const after=structuredClone(before);after.ens[0].ownerCanWrite=false;
  assert.match(compareOwner(before,after).join(' '),/record permission changed/);
});

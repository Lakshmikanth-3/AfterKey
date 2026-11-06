import { parseAbi } from 'viem';

export const ensAbi = parseAbi([
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  'function roles(uint256 resource,address account) view returns (uint256)',
  'function hasRoles(uint256 resource,uint256 roleBitmap,address account) view returns (bool)',
  'function hasRootRoles(uint256 roleBitmap,address account) view returns (bool)',
  'function grantRootRoles(uint256 roleBitmap,address account) returns (bool)',
  'function grantSetterRoles(bytes setter,address account) returns (bool)',
  'function revokeRootRoles(uint256 roleBitmap,address account) returns (bool)',
  'function revokeRoles(uint256 resource,uint256 roleBitmap,address account) returns (bool)',
  'function isApprovedForAll(address owner,address operator) view returns (bool)',
  'function setApprovalForAll(address operator,bool approved)',
  'function getSubregistry(string label) view returns (address)',
  'function getResolver(string label) view returns (address)',
  'function getParent() view returns (address parent,string label)',
  'function getResource(uint256 anyId) view returns (uint256)',
  'function getTokenId(uint256 anyId) view returns (uint256)',
  'function getOwner(uint256 anyId) view returns (address)',
  'function getExpiry(uint256 anyId) view returns (uint64)',
  'function setSubregistry(uint256 anyId,address registry)',
  'function setResolver(uint256 anyId,address resolver)',
  'function setParent(address parent,string label)',
  'function register(string label,address owner,address registry,address resolver,uint256 roleBitmap,uint64 expiry) returns (uint256)',
  'function setText(bytes name,string key,string value)',
  'function setAddress(bytes name,uint256 coinType,bytes addressBytes)',
  'function resolve(bytes name,bytes data) view returns (bytes)',
  'function decodeSetter(bytes setter) pure returns (bytes arg,uint256 resource,uint256 roleBitmap)',
  'function getRecordId(bytes32 node) view returns (uint256)',
]);
export const resolverInitAbi=parseAbi(['function initialize((address account,uint256 roleBitmap)[] grants,bytes[] calls)']);
export const registryInitAbi=parseAbi(['function initialize((address account,uint256 roleBitmap)[] grants)']);
export const factoryAbi=parseAbi([
  'function proxyLogic() view returns (address)',
  'function predictProxyAddress(address deployer,uint256 salt) view returns (address)',
  'function verifyContract(address proxy) view returns (address implementation)',
  'function deployProxy(address implementation,uint256 salt,bytes data) returns (address)',
  'event ProxyDeployed(address indexed sender,address indexed proxyAddress,uint256 salt,address implementation)',
]);
export const profileAbi=parseAbi(['function text(bytes32 node,string key) view returns (string)','function addr(bytes32 node) view returns (address)']);

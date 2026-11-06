import { parseAbi, type Address } from 'viem';

// Official Ethereum Sepolia v3 deployment, not a project-owned position manager.
export const POSITION_MANAGER:Address='0x1238536071E1c677A632429e3655c799b22cDA52';
export const positionAbi=parseAbi([
  'function ownerOf(uint256) view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function tokenOfOwnerByIndex(address,uint256) view returns (uint256)',
  'function getApproved(uint256) view returns (address)',
  'function isApprovedForAll(address,address) view returns (bool)',
  'function approve(address,uint256)',
  'function setApprovalForAll(address,bool)',
  'function positions(uint256) view returns (uint96 nonce,address operator,address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint128 liquidity,uint256 feeGrowthInside0LastX128,uint256 feeGrowthInside1LastX128,uint128 tokensOwed0,uint128 tokensOwed1)',
  'function collect((uint256 tokenId,address recipient,uint128 amount0Max,uint128 amount1Max)) payable returns (uint256 amount0,uint256 amount1)',
  'function decreaseLiquidity((uint256 tokenId,uint128 liquidity,uint256 amount0Min,uint256 amount1Min,uint256 deadline)) payable returns (uint256 amount0,uint256 amount1)',
  'function multicall(bytes[] data) payable returns (bytes[] results)',
  'event Collect(uint256 indexed tokenId,address recipient,uint256 amount0,uint256 amount1)',
  'event DecreaseLiquidity(uint256 indexed tokenId,uint128 liquidity,uint256 amount0,uint256 amount1)',
]);
export const tokenAbi=parseAbi(['function symbol() view returns (string)','function decimals() view returns (uint8)']);
export type PositionEconomics={token0:Address;token1:Address;fee:number;tickLower:number;tickUpper:number;liquidity:bigint;tokensOwed0:bigint;tokensOwed1:bigint};
export function positionEconomics(p:readonly unknown[]):PositionEconomics {
  return {token0:p[2] as Address,token1:p[3] as Address,fee:p[4] as number,tickLower:p[5] as number,tickUpper:p[6] as number,liquidity:p[7] as bigint,tokensOwed0:p[10] as bigint,tokensOwed1:p[11] as bigint};
}
export function economicChanges(a:PositionEconomics,b:PositionEconomics|undefined):string[]{
  if(!b)return ['Position financial state was not read'];
  return (['token0','token1','fee','tickLower','tickUpper','liquidity','tokensOwed0','tokensOwed1'] as const).filter(k=>String(a[k]).toLowerCase()!==String(b[k]).toLowerCase()).map(k=>`Position ${k} changed`);
}

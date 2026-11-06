// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import '../ENSPositionVault.sol';
contract RegistryFixture {
    address public holder; address public resolver; uint64 public expiry; uint256 public version;
    constructor(address holder_,address resolver_) { holder=holder_;resolver=resolver_;expiry=type(uint64).max; }
    function getResource(uint256) external view returns(uint256) { return 1+version; }
    function getOwner(uint256) external view returns(address) { return holder; }
    function getExpiry(uint256) external view returns(uint64) { return expiry; }
    function getResolver(string calldata) external view returns(address) { return resolver; }
    function change(address holder_,address resolver_,uint64 expiry_,uint256 version_) external { holder=holder_;resolver=resolver_;expiry=expiry_;version=version_; }
}
contract ResolverFixture {
    mapping(address=>bool) public allowed;
    function grant(address who,bool value) external { allowed[who]=value; }
    function hasRoles(uint256,uint256,address who) external view returns(bool) { return allowed[who]; }
}
contract PositionFixture {
    mapping(uint256=>address) public ownerOf; address public lastRecipient; uint256 public collections;
    function mint(address who,uint256 id) external { ownerOf[id]=who; }
    function safeTransferFrom(address from,address to,uint256 id) external {
        require(ownerOf[id]==from && msg.sender==from,'owner'); ownerOf[id]=to;
        if(to.code.length>0)require(ENSPositionVault(to).onERC721Received(msg.sender,from,id,'')==0x150b7a02);
    }
    function collect(IPositionManager.CollectParams calldata p) external payable returns(uint256,uint256) {
        require(ownerOf[p.tokenId]==msg.sender,'owner'); lastRecipient=p.recipient;collections++;return (5,7);
    }
}

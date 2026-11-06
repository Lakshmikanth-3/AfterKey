// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface INameRegistry {
    function getResource(uint256 id) external view returns (uint256);
    function getOwner(uint256 id) external view returns (address);
    function getExpiry(uint256 id) external view returns (uint64);
    function getResolver(string calldata label) external view returns (address);
}
interface IPermissionedResolver {
    function hasRoles(uint256 resource, uint256 roles, address account) external view returns (bool);
}
interface IPositionManager {
    struct CollectParams { uint256 tokenId; address recipient; uint128 amount0Max; uint128 amount1Max; }
    function ownerOf(uint256 id) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 id) external;
    function collect(CollectParams calldata params) external payable returns (uint256, uint256);
}

/// @notice One LP position, fixed treasury recipient, live ENSv2 authorization.
/// @dev No arbitrary calls, NFT approvals, operator withdrawals, signatures or upgrade path.
/// Name ownership/resource/resolver changes fail closed; owner recovery remains available.
contract ENSPositionVault {
    address public immutable owner;
    address public immutable treasury;
    IPositionManager public immutable manager;
    INameRegistry public immutable registry;
    IPermissionedResolver public immutable resolver;
    uint256 public immutable tokenId;
    uint256 public immutable nameResource;
    uint256 public immutable capabilityResource;
    string public label;
    string public capabilityKey;
    address public operator;
    uint64 public mandateExpiry;
    uint256 public epoch = 1;
    bool public paused;
    bool private entered;

    error Unauthorized();
    error InvalidConfiguration();
    error InvalidDeposit();
    error Reentrant();
    event OperatorChanged(address indexed previousOperator, address indexed operator, uint256 epoch, uint64 expiry);
    event Paused(bool paused, uint256 epoch);
    event PositionDeposited(uint256 indexed tokenId);
    event Collected(address indexed operator, address indexed treasury, uint256 amount0, uint256 amount1, uint256 epoch);
    event PositionReleased(address indexed owner, uint256 indexed tokenId, uint256 epoch);

    constructor(address owner_, address treasury_, address manager_, address registry_, address resolver_,
        uint256 tokenId_, string memory label_, string memory capabilityKey_) {
        if(owner_ == address(0) || treasury_ == address(0) || manager_.code.length == 0 || registry_.code.length == 0
            || resolver_.code.length == 0 || bytes(label_).length == 0 || bytes(capabilityKey_).length == 0) revert InvalidConfiguration();
        owner = owner_; treasury = treasury_; manager = IPositionManager(manager_);
        registry = INameRegistry(registry_); resolver = IPermissionedResolver(resolver_);
        tokenId = tokenId_; label = label_; capabilityKey = capabilityKey_;
        nameResource = INameRegistry(registry_).getResource(uint256(keccak256(bytes(label_))));
        capabilityResource = uint256(keccak256(bytes(capabilityKey_)));
        if(!_identityValid()) revert InvalidConfiguration();
    }
    modifier onlyOwner() { if(msg.sender != owner) revert Unauthorized(); _; }
    modifier nonReentrant() { if(entered) revert Reentrant(); entered = true; _; entered = false; }

    function _identityValid() internal view returns(bool) {
        return registry.getResource(uint256(keccak256(bytes(label)))) == nameResource
            && registry.getOwner(nameResource) == owner
            && block.timestamp < registry.getExpiry(nameResource)
            && registry.getResolver(label) == address(resolver);
    }
    /// @notice Reverts on unreadable ENS state. Callers must classify a failed read as unknown.
    function canCollect(address account) public view returns(bool) {
        return !paused && account != address(0) && account == operator && block.timestamp < mandateExpiry
            && _identityValid() && manager.ownerOf(tokenId) == address(this)
            && resolver.hasRoles(capabilityResource, 1 << 4, account);
    }
    function setOperator(address next, uint64 expiry) external onlyOwner {
        if(next == address(0) || next == owner || expiry <= block.timestamp || expiry > block.timestamp + 30 days) revert InvalidConfiguration();
        address previous = operator; operator = next; mandateExpiry = expiry; ++epoch;
        emit OperatorChanged(previous, next, epoch, expiry);
    }
    function setPaused(bool value) external onlyOwner {
        paused = value; ++epoch; emit Paused(value, epoch);
    }
    function collect() external nonReentrant returns(uint256 amount0, uint256 amount1) {
        if(!canCollect(msg.sender)) revert Unauthorized();
        (amount0, amount1) = manager.collect(IPositionManager.CollectParams(tokenId, treasury, type(uint128).max, type(uint128).max));
        emit Collected(msg.sender, treasury, amount0, amount1, epoch);
    }
    /// @notice Recovery is independent of ENS health, expiry and operator authorization.
    function release() external onlyOwner nonReentrant {
        paused = true; operator = address(0); mandateExpiry = 0; ++epoch;
        manager.safeTransferFrom(address(this), owner, tokenId);
        emit PositionReleased(owner, tokenId, epoch);
    }
    function onERC721Received(address, address from, uint256 id, bytes calldata) external returns(bytes4) {
        if(msg.sender != address(manager) || from != owner || id != tokenId) revert InvalidDeposit();
        emit PositionDeposited(id);
        return this.onERC721Received.selector;
    }
}

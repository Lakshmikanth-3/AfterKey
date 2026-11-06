// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import './ENSPositionVault.sol';

interface IReleaseResolver {
    function resolve(bytes calldata name, bytes calldata data) external view returns(bytes memory);
}
interface IReleaseConsumer {
    function gate() external view returns(address);
    function manager() external view returns(address);
    function tokenId() external view returns(uint256);
}

/// @notice Owner-promoted configuration, checked by a specific CRE workflow.
/// @dev ENS stores the candidate, not automatically the active configuration.
contract ENSReleaseGate {
    struct Configuration { address operator; address treasury; address manager; uint64 expiry; }
    address public immutable owner;
    address public immutable treasury;
    address public immutable manager;
    address public immutable forwarder;
    address public immutable workflowOwner;
    bytes32 public workflowId;
    INameRegistry public immutable registry;
    address public immutable resolver;
    uint256 public immutable nameResource;
    bytes public dnsName;
    string public label;
    string public constant RECORD_KEY = 'afterkey.release';
    uint256 public epoch;
    bytes32 public activeDigest;
    bytes32 public activeCoverage;
    Configuration public active;
    address[] public consumers;
    mapping(address=>bool) public registered;
    mapping(uint256=>bool) public registeredToken;
    bytes32 public coverageHash;
    bytes32 public checkedDigest;
    uint256 public checkedEpoch;
    bytes32 public checkedCoverage;
    uint64 public checkedUntil;
    bool public checkedPassed;
    bool public paused;
    error Denied();
    error Invalid();
    event ConsumerRegistered(address indexed consumer, bytes32 coverageHash);
    event Checked(bytes32 indexed digest, uint256 epoch, bool passed, uint64 until);
    event Activated(bytes32 indexed digest, uint256 epoch, address operator);
    event PauseChanged(bool paused);
    event WorkflowBound(bytes32 indexed workflowId,uint256 epoch);

    constructor(address owner_,address manager_,address registry_,address resolver_,string memory label_,bytes memory dnsName_,address forwarder_,address workflowOwner_,bytes32 workflowId_) {
        if(owner_==address(0)||manager_.code.length==0||registry_.code.length==0||resolver_.code.length==0||forwarder_.code.length==0||workflowOwner_==address(0)||workflowId_==bytes32(0)||dnsName_.length==0) revert Invalid();
        owner=owner_;treasury=owner_;manager=manager_;registry=INameRegistry(registry_);resolver=resolver_;label=label_;dnsName=dnsName_;
        forwarder=forwarder_;workflowOwner=workflowOwner_;workflowId=workflowId_;
        uint256 length=uint8(dnsName_[0]);
        if(length==0||length!=bytes(label_).length||dnsName_.length<=length+1)revert Invalid();
        bytes memory firstLabel=new bytes(length);
        for(uint256 i;i<length;++i)firstLabel[i]=dnsName_[i+1];
        if(keccak256(firstLabel)!=keccak256(bytes(label_)))revert Invalid();
        nameResource=registry.getResource(uint256(keccak256(bytes(label_))));
        if(!identityValid()) revert Invalid();
    }
    modifier onlyOwner(){if(msg.sender!=owner)revert Denied();_;}
    function bindWorkflow(bytes32 id) external onlyOwner {
        if(id==bytes32(0))revert Invalid();workflowId=id;checkedUntil=0;++epoch;
        emit WorkflowBound(id,epoch);
    }
    function identityValid() public view returns(bool){
        return registry.getResource(uint256(keccak256(bytes(label))))==nameResource && registry.getOwner(nameResource)==owner
            && registry.getExpiry(nameResource)>block.timestamp && registry.getResolver(label)==resolver;
    }
    function candidate() public view returns(Configuration memory config,bytes32 digest){
        // Permissioned Resolver derives the node from DNS name, not the profile node argument.
        bytes memory response=IReleaseResolver(resolver).resolve(dnsName,abi.encodeWithSignature('data(bytes32,string)',bytes32(0),RECORD_KEY));
        bytes memory payload=abi.decode(response,(bytes));
        if(payload.length!=128)revert Invalid();
        config=abi.decode(payload,(Configuration));digest=keccak256(payload);
    }
    function consumerCount() external view returns(uint256){return consumers.length;}
    function registerConsumer(address consumer) external onlyOwner {
        if(consumers.length>=16||registered[consumer]||IReleaseConsumer(consumer).gate()!=address(this)||IReleaseConsumer(consumer).manager()!=manager)revert Invalid();
        uint256 id=IReleaseConsumer(consumer).tokenId();
        address custodian=IPositionManager(manager).ownerOf(id);
        if(registeredToken[id]||(custodian!=owner&&custodian!=consumer))revert Invalid();
        registeredToken[id]=true;
        registered[consumer]=true;consumers.push(consumer);coverageHash=keccak256(abi.encode(consumers));
        checkedUntil=0;emit ConsumerRegistered(consumer,coverageHash);
    }
    function supportsInterface(bytes4 id) external pure returns(bool){return id==0x01ffc9a7||id==this.onReport.selector;}
    function onReport(bytes calldata metadata,bytes calldata report) external {
        if(msg.sender!=forwarder||(metadata.length!=62&&metadata.length!=64))revert Denied();
        bytes32 id=bytes32(metadata[0:32]);address author=address(bytes20(metadata[42:62]));
        if(id!=workflowId||author!=workflowOwner)revert Denied();
        (uint256 chain,address gate_,bytes32 digest,uint256 baseEpoch,bytes32 coverage,uint64 until,bool passed)=abi.decode(report,(uint256,address,bytes32,uint256,bytes32,uint64,bool));
        if(chain!=block.chainid||gate_!=address(this)||baseEpoch!=epoch||coverage!=coverageHash||consumers.length==0||until<=block.timestamp||until>block.timestamp+15 minutes)revert Invalid();
        (,bytes32 current)=candidate();if(digest!=current)revert Invalid();
        checkedDigest=digest;checkedEpoch=baseEpoch;checkedCoverage=coverage;checkedUntil=until;checkedPassed=passed;
        emit Checked(digest,baseEpoch,passed,until);
    }
    function activate(bytes32 expectedDigest,uint256 expectedEpoch) external onlyOwner {
        (Configuration memory config,bytes32 digest)=candidate();
        if(!identityValid()||digest!=expectedDigest||epoch!=expectedEpoch||!checkedPassed||checkedDigest!=digest||checkedEpoch!=epoch||checkedCoverage!=coverageHash||checkedUntil<=block.timestamp)revert Invalid();
        if(config.operator==address(0)||config.operator==owner||config.treasury!=treasury||config.manager!=manager||config.expiry<=block.timestamp||config.expiry>block.timestamp+30 days)revert Invalid();
        active=config;activeDigest=digest;activeCoverage=coverageHash;++epoch;checkedUntil=0;
        emit Activated(digest,epoch,config.operator);
    }
    function setPaused(bool value) external onlyOwner {paused=value;emit PauseChanged(value);}
    function authorize(address operator_,bytes32 digest,uint256 expectedEpoch) external view returns(address){
        if(!registered[msg.sender]||paused||!identityValid()||activeCoverage!=coverageHash||digest!=activeDigest||expectedEpoch!=epoch||epoch==0||operator_!=active.operator||block.timestamp>=active.expiry)revert Denied();
        return active.treasury;
    }
}

/// @notice Uniswap v3 consumer. Operators collect only; custody recovery stays with owner.
contract ReleaseLPVault {
    ENSReleaseGate public immutable gate;
    IPositionManager public immutable manager;
    uint256 public immutable tokenId;
    bool private entered;
    error Denied();
    event Collected(bytes32 indexed digest,uint256 epoch,uint256 amount0,uint256 amount1);
    constructor(address gate_,uint256 tokenId_){gate=ENSReleaseGate(gate_);manager=IPositionManager(gate.manager());tokenId=tokenId_;}
    function collect(bytes32 expectedDigest,uint256 expectedEpoch) external returns(uint256 a,uint256 b){
        if(entered)revert Denied();entered=true;
        address recipient=gate.authorize(msg.sender,expectedDigest,expectedEpoch);
        (a,b)=manager.collect(IPositionManager.CollectParams(tokenId,recipient,type(uint128).max,type(uint128).max));
        emit Collected(expectedDigest,expectedEpoch,a,b);entered=false;
    }
    function release() external {if(msg.sender!=gate.owner()||entered)revert Denied();entered=true;manager.safeTransferFrom(address(this),msg.sender,tokenId);entered=false;}
    function onERC721Received(address,address from,uint256 id,bytes calldata) external view returns(bytes4){
        if(msg.sender!=address(manager)||from!=gate.owner()||id!=tokenId)revert Denied();return this.onERC721Received.selector;
    }
}

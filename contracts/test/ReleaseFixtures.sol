// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import '../ENSReleaseGate.sol';
contract CandidateResolverFixture {
    bytes public payload;
    function setData(bytes calldata, string calldata, bytes calldata value) external {payload=value;}
    function resolve(bytes calldata,bytes calldata) external view returns(bytes memory){return abi.encode(payload);}
}
contract ForwarderFixture {
    function deliver(address gate,bytes calldata metadata,bytes calldata report) external {ENSReleaseGate(gate).onReport(metadata,report);}
}

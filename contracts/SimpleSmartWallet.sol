// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "./ERC1271.sol";
import "./VerifySignature.sol";

contract SimpleSmartWallet is ERC1271, VerifySignature {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Sets a new owner for the wallet.
     * @param newOwner The address of the new owner.
     * @dev Only the current owner can set a new owner.
     */
    function setOwner(address payable newOwner) public {
        require(
            msg.sender == owner,
            "Only the current owner can set a new owner."
        );
        require(
            newOwner != address(0),
            "New owner address cannot be the zero address."
        );

        owner = newOwner;
    }

    /**
     * @notice Verifies that the signer is the owner of the signing contract.
     */
    function isValidSignature(
        bytes32 _hash,
        bytes memory _signature
    ) public view override returns (bytes4) {
        bytes32 ethSignedMessageHash = getEthSignedMessageHash(_hash);
        address signer = recoverSigner(ethSignedMessageHash, _signature);
        if (signer == owner) {
            return 0x1626ba7e;
        } else {
            return 0xffffffff;
        }
    }
}

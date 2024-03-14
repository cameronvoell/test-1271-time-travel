import {
  time,
  loadFixture,
  mine,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";
import { boolean } from "hardhat/internal/core/params/argumentTypes";
import { SimpleSmartWallet } from "../typechain-types"

describe("SimpleSmartWallet", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployOneYearLockFixture() {
    // const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    // const ONE_GWEI = 1_000_000_000;

    // const lockedAmount = ONE_GWEI;
    // const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

    // Contracts are deployed using the first signer/account by default
    const [addressA, addressB, addressC] = await hre.ethers.getSigners();

    const SimpleSmartWallet = await hre.ethers.getContractFactory("SimpleSmartWallet", addressA);
    const simpleSmartWallet = await SimpleSmartWallet.deploy();

    return { simpleSmartWallet, addressA, addressB, addressC };
  }

  describe("All Tests", function () {
    // it("Deployment should have expected initial Owner", async function () {
    //   const { simpleSmartWallet, addressA, addressB } = await loadFixture(deployOneYearLockFixture);

    //   expect(await simpleSmartWallet.owner()).to.equal(addressA.address);
    // });

    // it("Should be able to verify a signature", async function () {
    //   const { simpleSmartWallet, addressA, addressB, addressC } = await loadFixture(deployOneYearLockFixture);

    //   // Step 1: Prepare the message and hash it
    //   const message = "Hello, world!";
    //   const messageHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(message)); 

    //   // Step 2: Sign the hashed message with addressA. The signMessage method expects a string,
    //   const signature = await addressA.signMessage(hre.ethers.getBytes(messageHash));

    //   // Step 3: Call isValidSignature with the hashed message and signature.
    //   const response = await simpleSmartWallet.isValidSignature(messageHash, signature);

    //   expect(response).to.equal('0x1626ba7e');
    // });

    // it("Signature verification should fail after updating signer", async function () {
    //   const { simpleSmartWallet, addressA, addressB, addressC } = await loadFixture(deployOneYearLockFixture);

    //   // Step 1: Verify signature with initial signer
    //   const message = "Hello, world!";
    //   const messageHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(message)); 
    //   const signature = await addressA.signMessage(hre.ethers.getBytes(messageHash));
    //   const response = await simpleSmartWallet.isValidSignature(messageHash, signature);
    //   expect(response).to.equal('0x1626ba7e');

    //   // Step 2: Set owner to addressB
    //   await simpleSmartWallet.setOwner(addressB.address);

    //   // Step 3: Attempt same call to verify signature
    //   const response2 = await simpleSmartWallet.isValidSignature(messageHash, signature);
    //   expect(response2).to.equal('0xffffffff');
    // });

    it("Signature verification of past block should still pass after updating signer", async function () {
      const { simpleSmartWallet, addressA, addressB, addressC } = await loadFixture(deployOneYearLockFixture);
      const deploymentBlockNumber = simpleSmartWallet.deploymentTransaction()?.blockNumber ?? 0;
      const latestBlock = await hre.ethers.provider.getBlock("latest")
      const deploymentTimestamp = (await hre.ethers.provider.getBlock("latest"))?.timestamp ?? 0;
      expect(deploymentBlockNumber).to.equal(latestBlock?.number);

      // Step 1: Verify signature with initial signer
      await time.increaseTo(deploymentTimestamp + 1000);
      let latestBlockNumber = (await hre.ethers.provider.getBlock("latest"))?.number ?? 0;
      let latestTimestamp = (await hre.ethers.provider.getBlock("latest"))?.timestamp ?? 0;
      expect(deploymentBlockNumber + 1).to.equal(latestBlockNumber);
      expect(deploymentTimestamp + 1000).to.equal(latestTimestamp);
      const message = "Hello, world!";
      const messageHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(message)); 
      const signature = await addressA.signMessage(hre.ethers.getBytes(messageHash));
      // Signature is Verified at block deployment + 1 and timestamp deployment + 1000
      const response = await simpleSmartWallet.isValidSignature(messageHash, signature);
      expect(response).to.equal('0x1626ba7e');
      

      // Step 2: Owner is updated, signature verification at latest block fails
      const tx = await simpleSmartWallet.setOwner(addressB.address);
      const updatedOwnerBlockNumber = tx.blockNumber ?? 0;
      const updatedOwnerTimestamp = (await hre.ethers.provider.getBlock(tx.blockNumber ?? 0))?.timestamp ?? 0;
      expect(tx.blockNumber).to.equal(deploymentBlockNumber + 2);
      const response2 = await simpleSmartWallet.isValidSignature(messageHash, signature);
      expect(response2).to.equal('0xffffffff');

      // Step 3: Verify Signature at the deployment block, or the block where we previously
      // verified the signature should still pass
      let blockTagResponse = await hre.ethers.provider.call({
        to: simpleSmartWallet,
        data: simpleSmartWallet.interface.encodeFunctionData('isValidSignature', [messageHash, signature]),
        blockTag: updatedOwnerBlockNumber
      });
      expect(blockTagResponse).to.equal('0xffffffff00000000000000000000000000000000000000000000000000000000');
      
      blockTagResponse = await hre.ethers.provider.call({
        to: simpleSmartWallet,
        data: simpleSmartWallet.interface.encodeFunctionData('isValidSignature', [messageHash, signature]),
        blockTag: deploymentBlockNumber
      });
      expect(blockTagResponse).to.equal('0x1626ba7e00000000000000000000000000000000000000000000000000000000');

      blockTagResponse = await hre.ethers.provider.call({
        to: simpleSmartWallet,
        data: simpleSmartWallet.interface.encodeFunctionData('isValidSignature', [messageHash, signature]),
        blockTag: deploymentBlockNumber + 1
      });
      expect(blockTagResponse).to.equal('0x1626ba7e00000000000000000000000000000000000000000000000000000000');

      blockTagResponse = await hre.ethers.provider.call({
        to: simpleSmartWallet,
        data: simpleSmartWallet.interface.encodeFunctionData('isValidSignature', [messageHash, signature]),
        blockTag: deploymentBlockNumber + 2
      });
      expect(blockTagResponse).to.equal('0xffffffff00000000000000000000000000000000000000000000000000000000');
      
    });

  });

});

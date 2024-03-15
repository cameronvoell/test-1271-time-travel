import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { vars } from "hardhat/config";

const ALCHEMY_API_KEY = vars.get("ALCHEMY_API_KEY");
const SEPOLIA_PRIVATE_KEY = vars.get("SEPOLIA_PRIVATE_KEY")


describe("SimpleSmartWallet", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployOneYearLockFixture() {

    // Contracts are deployed using the first signer/account by default
    const [addressA, addressB, addressC] = await hre.ethers.getSigners();

    const SimpleSmartWallet = await hre.ethers.getContractFactory("SimpleSmartWallet", addressA);
    const simpleSmartWallet = await SimpleSmartWallet.deploy();

    return { simpleSmartWallet, addressA, addressB, addressC };
  }

  describe("Local Network Tests", function () {
    it("Deployment should have expected initial Owner", async function () {
      const { simpleSmartWallet, addressA, addressB } = await loadFixture(deployOneYearLockFixture);

      expect(await simpleSmartWallet.owner()).to.equal(addressA.address);
    });

    it("Should be able to verify a signature", async function () {
      const { simpleSmartWallet, addressA, addressB, addressC } = await loadFixture(deployOneYearLockFixture);

      // Step 1: Prepare the message and hash it
      const message = "Hello, world!";
      const messageHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(message));

      // Step 2: Sign the hashed message with addressA. The signMessage method expects a string,
      const signature = await addressA.signMessage(hre.ethers.getBytes(messageHash));

      // Step 3: Call isValidSignature with the hashed message and signature.
      const response = await simpleSmartWallet.isValidSignature(messageHash, signature);

      expect(response).to.equal('0x1626ba7e');
    });

    it("Signature verification should fail after updating signer", async function () {
      const { simpleSmartWallet, addressA, addressB, addressC } = await loadFixture(deployOneYearLockFixture);

      // Step 1: Verify signature with initial signer
      const message = "Hello, world!";
      const messageHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(message));
      const signature = await addressA.signMessage(hre.ethers.getBytes(messageHash));
      const response = await simpleSmartWallet.isValidSignature(messageHash, signature);
      expect(response).to.equal('0x1626ba7e');

      // Step 2: Set owner to addressB
      await simpleSmartWallet.setOwner(addressB.address);

      // Step 3: Attempt same call to verify signature
      const response2 = await simpleSmartWallet.isValidSignature(messageHash, signature);
      expect(response2).to.equal('0xffffffff');
    });

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

  describe("Live Network Tests (Sepolia, Base Sepolia)", function () {

    // Seplia Deployment: https://sepolia.etherscan.io/address/0xFcFFa08959c8A0Bc9463938C056A3680b52d3eeb
    it("Can call contract function on live Sepolia deployment at past block", async function () {
      const addressA = new hre.ethers.Wallet(SEPOLIA_PRIVATE_KEY, hre.ethers.provider);
      const message = "Hello, world!";
      const messageHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(message));
      const signature = await addressA.signMessage(hre.ethers.getBytes(messageHash));

      const provider = new hre.ethers.JsonRpcProvider(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`);
      const sepoliaContractAddress = "0xFcFFa08959c8A0Bc9463938C056A3680b52d3eeb";
      const ContractABI = [{ "inputs": [], "stateMutability": "nonpayable", "type": "constructor" }, { "inputs": [{ "internalType": "bytes32", "name": "_messageHash", "type": "bytes32" }], "name": "getEthSignedMessageHash", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "pure", "type": "function" }, { "inputs": [{ "internalType": "bytes32", "name": "_hash", "type": "bytes32" }, { "internalType": "bytes", "name": "_signature", "type": "bytes" }], "name": "isValidSignature", "outputs": [{ "internalType": "bytes4", "name": "", "type": "bytes4" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "bytes32", "name": "_ethSignedMessageHash", "type": "bytes32" }, { "internalType": "bytes", "name": "_signature", "type": "bytes" }], "name": "recoverSigner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "pure", "type": "function" }, { "inputs": [{ "internalType": "address payable", "name": "newOwner", "type": "address" }], "name": "setOwner", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "bytes", "name": "sig", "type": "bytes" }], "name": "splitSignature", "outputs": [{ "internalType": "bytes32", "name": "r", "type": "bytes32" }, { "internalType": "bytes32", "name": "s", "type": "bytes32" }, { "internalType": "uint8", "name": "v", "type": "uint8" }], "stateMutability": "pure", "type": "function" }];
      const simpleSmartWallet = await hre.ethers.getContractAt(ContractABI, sepoliaContractAddress);
      let blockTagResponse = await provider.call({
        to: simpleSmartWallet,
        data: simpleSmartWallet.interface.encodeFunctionData('isValidSignature', [messageHash, signature]),
        blockTag: 5486340
      });
      expect(blockTagResponse).to.equal('0xffffffff00000000000000000000000000000000000000000000000000000000');

      blockTagResponse = await provider.call({
        to: simpleSmartWallet,
        data: simpleSmartWallet.interface.encodeFunctionData('isValidSignature', [messageHash, signature]),
        blockTag: 5486339
      });
      expect(blockTagResponse).to.equal('0x1626ba7e00000000000000000000000000000000000000000000000000000000');
    });

    // Base Seplia Deployment: https://sepolia.basescan.org/address/0xfcffa08959c8a0bc9463938c056a3680b52d3eeb
    it("Can call contract function on live Base Sepolia deployment at past block", async function () {
      const addressA = new hre.ethers.Wallet(SEPOLIA_PRIVATE_KEY, hre.ethers.provider);
      const message = "Hello, world!";
      const messageHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(message));
      const signature = await addressA.signMessage(hre.ethers.getBytes(messageHash));
      const provider = new hre.ethers.JsonRpcProvider(`https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`);
      const sepoliaContractAddress = "0xFcFFa08959c8A0Bc9463938C056A3680b52d3eeb";
      const ContractABI = [{ "inputs": [], "stateMutability": "nonpayable", "type": "constructor" }, { "inputs": [{ "internalType": "bytes32", "name": "_messageHash", "type": "bytes32" }], "name": "getEthSignedMessageHash", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "pure", "type": "function" }, { "inputs": [{ "internalType": "bytes32", "name": "_hash", "type": "bytes32" }, { "internalType": "bytes", "name": "_signature", "type": "bytes" }], "name": "isValidSignature", "outputs": [{ "internalType": "bytes4", "name": "", "type": "bytes4" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "bytes32", "name": "_ethSignedMessageHash", "type": "bytes32" }, { "internalType": "bytes", "name": "_signature", "type": "bytes" }], "name": "recoverSigner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "pure", "type": "function" }, { "inputs": [{ "internalType": "address payable", "name": "newOwner", "type": "address" }], "name": "setOwner", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "bytes", "name": "sig", "type": "bytes" }], "name": "splitSignature", "outputs": [{ "internalType": "bytes32", "name": "r", "type": "bytes32" }, { "internalType": "bytes32", "name": "s", "type": "bytes32" }, { "internalType": "uint8", "name": "v", "type": "uint8" }], "stateMutability": "pure", "type": "function" }];
      const simpleSmartWallet = await hre.ethers.getContractAt(ContractABI, sepoliaContractAddress);
      let blockTagResponse = await provider.call({
        to: simpleSmartWallet,
        data: simpleSmartWallet.interface.encodeFunctionData('isValidSignature', [messageHash, signature]),
        blockTag: 7348580
      });
      expect(blockTagResponse).to.equal('0xffffffff00000000000000000000000000000000000000000000000000000000');

      blockTagResponse = await provider.call({
        to: simpleSmartWallet,
        data: simpleSmartWallet.interface.encodeFunctionData('isValidSignature', [messageHash, signature]),
        blockTag: 7348579
      });
      expect(blockTagResponse).to.equal('0x1626ba7e00000000000000000000000000000000000000000000000000000000');
    });

  });

});

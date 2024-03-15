# test-1271-time-travel

To run tests:

1. `npm install`
2. `npx hardhat test`

You should see the following:

```
  SimpleSmartWallet
    Local Network Tests
      ✔ Deployment should have expected initial Owner (309ms)
      ✔ Should be able to verify a signature
      ✔ Signature verification should fail after updating signer
      ✔ Signature verification of past block should still pass after updating signer
    Live Network Tests (Sepolia, Base Sepolia)
      ✔ Can call contract function on live Sepolia deployment at past block (381ms)
      ✔ Can call contract function on live Base Sepolia deployment at past block (337ms)


  6 passing (1s)
```
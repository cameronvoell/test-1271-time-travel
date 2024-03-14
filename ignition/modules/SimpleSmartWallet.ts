import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SimpleSmartWalletModule = buildModule("LockModule", (m) => {

  const simpleSmartWallet = m.contract("SimpleSmartWallet", [], {});

  return { simpleSmartWallet };
});

export default SimpleSmartWalletModule;

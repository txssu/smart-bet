import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployBettingContract: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log(`Deploying Betting contract with the account: ${deployer}`);

  const bettingContract = await deploy("Betting", {
    from: deployer,
    args: [], // Нет аргументов для конструктора
    log: true,
    autoMine: true, // Ускоряет деплой на локальных сетях
  });

  console.log(`Betting contract deployed at address: ${bettingContract.address}`);
};

export default deployBettingContract;

deployBettingContract.tags = ["Betting"];

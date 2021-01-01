import { Signer } from "@ethersproject/abstract-signer";
import { ethers, waffle, network } from "hardhat";
import { expect } from "chai";

import ArbitragerArtifact from "../artifacts/contracts/Arbitrager.sol/Arbitrager.json";

import { Accounts, Signers } from "../types";
import {
  Arbitrager,
  DemoFlash__factory,
  Arbitrager__factory,
  UniswapLikeArbitrager__factory,
  IUniswapV2Factory__factory,
  IERC20__factory,
} from "../typechain";
// import { shouldBehaveLikeGreeter } from "./Greeter.behavior";

const { deployContract } = waffle;

const HUNTER_ADDRESS = "0x4C5f1D9A89B822D2C3D600A07F24f311aC8E6162";
global._tracer_address_names[HUNTER_ADDRESS] = "HUNTER";
// const BAT = "0x037A54AaB062628C9Bbae1FDB1583c195585fe41";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
global._tracer_address_names[WETH] = "WETH";
// const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
// const DAI = "0x6b175474e89094c44da98b954eedeac495271d0f";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
global._tracer_address_names[USDC] = "USDC";
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
global._tracer_address_names[USDT] = "USDT";
const YFI = "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e";
global._tracer_address_names[YFI] = "YFI";

global._tracer_address_names["0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc"] = "UniswapPairUSDC-WETH";
global._tracer_address_names["0xF5FBC6CA5c677F1c977Ed3a064B9DDA14c5E241b"] = "UniswapPairYFI-USDT";

describe("Unit tests", function () {
  before(async function () {
    this.accounts = {} as Accounts;
    this.signers = {} as Signers;

    const signers: Signer[] = await ethers.getSigners();
    this.signers.admin = signers[0];
    this.accounts.admin = await signers[0].getAddress();

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [HUNTER_ADDRESS],
    });

    this.accounts.hunter = HUNTER_ADDRESS;
    this.signers.hunter = ethers.provider.getSigner(HUNTER_ADDRESS);
  });

  // describe("Flash test", function () {
  //   it("deploy flash and perform", async function () {
  //     const flashInstance = await new DemoFlash__factory(this.signers.hunter).deploy();
  //     global._tracer_address_names[flashInstance.address] = "FlashContract";

  //     await flashInstance.flash({
  //       value: ethers.utils.parseEther("0.1"),
  //     });
  //   });
  // });

  describe("Arbitrager", function () {
    beforeEach(async function () {
      console.log("deploying Arbitrager");
      // this.arbitrager = (await deployContract(this.signers.hunter, ArbitragerArtifact)) as Arbitrager;
      this.arbitrager = await new UniswapLikeArbitrager__factory(this.signers.hunter).deploy();
      global._tracer_address_names[this.arbitrager.address] = "Arbitrager";
    });

    // it("check sqrt", async function () {
    //   const cases = [{ input: 1024, output: 32 }];
    //   for (const _case of cases) {
    //     expect((await this.arbitrager.callStatic.sqrt(_case.input)).toString()).to.equal(String(_case.output));
    //   }
    // });

    it("arbitrage USDC and WETH", async function () {
      // await this.arbitrager.see(USDC, WETH);

      // const res = await this.arbitrager.callStatic.calculateTrades(USDC, WETH, true);
      // console.log(`x: ${res[1][0].toString()}; y: ${res[1][1].toString()}; z: ${res[1][2].toString()}`);

      const b = await IERC20__factory.connect(USDT, this.signers.hunter).balanceOf(
        "0x0000000000007f150bd6f54c40a34d7c3d5e9f56",
      );
      console.log(ethers.utils.formatEther(b));

      await this.arbitrager.main(
        YFI,
        USDT,
        await IUniswapV2Factory__factory.connect(
          "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
          this.signers.hunter,
        ).getPair(YFI, USDT), // sushiswap
        await IUniswapV2Factory__factory.connect(
          "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
          this.signers.hunter,
        ).getPair(YFI, USDT), // uniswap
        "0x0000000000007f150bd6f54c40a34d7c3d5e9f56", // treasury
      );
    });
  });
});

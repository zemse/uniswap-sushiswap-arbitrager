import { ethers, BigNumber } from "ethers";
import { IUniswapV2Factory__factory, IUniswapV2Pair__factory, IERC20__factory } from "../typechain";
import { readJson, writeJSON } from "fs-extra";
import { cal, cal_BN } from "./arbitrage-lib";
import path from "path";
const FILE_PATH = path.resolve(__dirname, "common-pairs.json");

const UNISWAP_V2_FACTORY_ADDRESS = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";
const SUSHISWAP_FACTORY_ADDRESS = "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac";

const provider = new ethers.providers.InfuraProvider("homestead", "b915fe11a8ab4e73a3edba4c59d656b2");
// const provider = new ethers.providers.AlchemyProvider("homestead", "n4u1EtBSi2HL4BywpxDO-ZkEbdH3cMpa");

const uniswapInstance = IUniswapV2Factory__factory.connect(UNISWAP_V2_FACTORY_ADDRESS, provider);
const sushiswapInstance = IUniswapV2Factory__factory.connect(SUSHISWAP_FACTORY_ADDRESS, provider);

// this is further multiplied by decimals of the token
// top is more wanted and bottom is less preferred one
// TODO: every coin should be normalized in tx gas price as per GWEI
const minimumProfits = {
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": 0.045, // WETH
  "0xdac17f958d2ee523a2206206994597c13d831ec7": 30, // USDT
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": 30, // USDC
  "0x6b175474e89094c44da98b954eedeac495271d0f": 30, // DAT
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": 0.001, // WBTC
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": 4, // UNI
  "0x6b3595068778dd592e39a122f4f5a5cf09c90fe2": 17, // SUSHI
  "0x514910771AF9Ca656af840dff83E8264EcF986CA": 2, // LINK
  "0x41C028a4C1F461eBFC3af91619b240004ebAD216": 5000, // TACO
};

// console.log(cal(1000, 1000, 100, 100.605));

(async () => {
  const commonPairs = await getCommonPairs(false);
  console.log(`Current common pairs: ${commonPairs.length}`);

  let consoleLogsAll: string[] = [];

  const promises: Promise<any>[] = [];
  for (const pairObj of commonPairs) {
    // console.log(pairObj);
    promises.push(
      (async () => {
        const consoleLogs: string[] = [];

        const token0Instance = IERC20__factory.connect(pairObj.token0, provider);
        const token1Instance = IERC20__factory.connect(pairObj.token1, provider);
        const uniswapPairInstance = IUniswapV2Pair__factory.connect(pairObj.uniswapPair, provider);
        const sushiswapPairInstance = IUniswapV2Pair__factory.connect(pairObj.sushiswapPair, provider);

        if (pairObj.token0_symbol === undefined) {
          try {
            pairObj.token0_symbol = await token0Instance.symbol();
          } catch {
            pairObj.token0_symbol = "SymbolError";
          }
        }
        if (pairObj.token1_symbol === undefined) {
          try {
            pairObj.token1_symbol = await token1Instance.symbol();
          } catch {
            pairObj.token1_symbol = "SymbolError";
          }
        }
        if (pairObj.token0_decimals === undefined) pairObj.token0_decimals = await token0Instance.decimals();
        if (pairObj.token1_decimals === undefined) pairObj.token1_decimals = await token1Instance.decimals();
        await writeJSON(FILE_PATH, commonPairs, { spaces: 2 });
        // cal(uR.reserve0, uR.reserve1.toString, sR[0], sR[1]);

        let pullToken = 1;
        const pppp = Object.entries(minimumProfits).find(entry => {
          if (entry[0].toLowerCase() === pairObj.token0.toLowerCase()) {
            pullToken = 1; // when 1 is pulled we get profit in 0
            return true;
          } else if (entry[0].toLowerCase() === pairObj.token1.toLowerCase()) {
            pullToken = 0; // when 0 is pulled we get profit in 1
            return true;
          } else {
            return false;
          }
        });
        // if (!pppp) continue; // since any token in pair is not recognized as profits we ignore this.

        const uR = await uniswapPairInstance.getReserves();
        const sR = await sushiswapPairInstance.getReserves();

        consoleLogs.push(`\n\n\nPair ${pairObj.token0_symbol}-${pairObj.token1_symbol}`);
        consoleLogs.push(`token0= ${pairObj.token0_symbol} (${pairObj.token0}) ${pairObj.token0_decimals} decimals`);
        consoleLogs.push(`token1= ${pairObj.token1_symbol} (${pairObj.token1}) ${pairObj.token1_decimals} decimals`);

        if (uR.reserve0.eq(0) || uR.reserve1.eq(0) || sR.reserve0.eq(0) || sR.reserve1.eq(0)) {
          consoleLogs.push("No liquidity");
          // continue;
          return;
        }
        const record: Record = {
          timestamp: Date.now(),
          uniswapLiquidity0: +ethers.utils.formatUnits(uR.reserve0, pairObj.token0_decimals),
          uniswapLiquidity1: +ethers.utils.formatUnits(uR.reserve1, pairObj.token1_decimals),
          sushiswapLiquidity0: +ethers.utils.formatUnits(sR.reserve0, pairObj.token0_decimals),
          sushiswapLiquidity1: +ethers.utils.formatUnits(sR.reserve1, pairObj.token1_decimals),
          trades: [],
        };
        consoleLogs.push(
          `\nUniswap: ${ethers.utils.formatUnits(uR.reserve0, pairObj.token0_decimals)} ${
            pairObj.token0_symbol
          } - ${ethers.utils.formatUnits(uR.reserve1, pairObj.token1_decimals)} ${pairObj.token1_symbol}`,
        );
        consoleLogs.push(
          `Sushiswap: ${ethers.utils.formatUnits(sR.reserve0, pairObj.token0_decimals)} ${
            pairObj.token0_symbol
          } == ${ethers.utils.formatUnits(sR.reserve1, pairObj.token1_decimals)} ${pairObj.token1_symbol}`,
        );

        let shouldPrint = false;
        try {
          const results = cal_BN(
            pullToken ? uR.reserve0 : uR.reserve1,
            pullToken ? uR.reserve1 : uR.reserve0,
            pullToken ? sR.reserve0 : sR.reserve1,
            pullToken ? sR.reserve1 : sR.reserve0,
          );
          // const results_js = cal(
          //   +uR.reserve0.toString(),
          //   +uR.reserve1.toString(),
          //   +sR.reserve0.toString(),
          //   +sR.reserve1.toString(),
          // );
          results.forEach((result, i) => {
            consoleLogs.push();

            let resultOk = true;
            if (result.x.gt(0)) {
              if (result.x.gt(pullToken ? sR.reserve1 : sR.reserve0)) {
                resultOk = false;
              }
              if (result.y.gt(pullToken ? uR.reserve0 : uR.reserve1)) {
                resultOk = false;
              }
            } else {
              if (result.x.lt((pullToken ? uR.reserve1 : uR.reserve0).mul(-1))) {
                resultOk = false;
              }
              if (result.y.lt((pullToken ? sR.reserve1 : sR.reserve0).mul(-1))) {
                resultOk = false;
              }
            }
            if (!resultOk) {
              // ignoring result that doesn't make sense
              consoleLogs.push(`Result ${i} doesn't make sense`);
              return;
            }
            const signChange = ethers.BigNumber.from(result.x.gt(0) ? 1 : -1);
            if (result.profit.mul(signChange).gt(0)) {
              consoleLogs.push(
                `X= ${ethers.utils.formatUnits(
                  result.x.mul(signChange),
                  pullToken ? pairObj.token1_decimals : pairObj.token0_decimals,
                )} ${pullToken ? pairObj.token1_symbol : pairObj.token0_symbol} (from ${
                  result.x.gt(0) ? "Uniswap" : "Sushiswap"
                })`,
              );
              consoleLogs.push(
                `Y= ${ethers.utils.formatUnits(
                  result.y.mul(signChange),
                  pullToken ? pairObj.token0_decimals : pairObj.token1_decimals,
                )} ${pullToken ? pairObj.token0_symbol : pairObj.token1_symbol}`,
              );
              consoleLogs.push(
                `Z= ${ethers.utils.formatUnits(
                  result.z.mul(signChange),
                  pullToken ? pairObj.token0_decimals : pairObj.token1_decimals,
                )} ${pullToken ? pairObj.token0_symbol : pairObj.token1_symbol} `,
              );
              consoleLogs.push(
                `Profit= ${ethers.utils.formatUnits(
                  result.profit.mul(signChange),
                  pullToken ? pairObj.token0_decimals : pairObj.token1_decimals,
                )} ${pullToken ? pairObj.token0_symbol : pairObj.token1_symbol}`,
              );
              shouldPrint = true;
              record.trades.push({
                pullToken,
                x: +ethers.utils.formatUnits(
                  result.x.mul(signChange),
                  pullToken ? pairObj.token1_decimals : pairObj.token0_decimals,
                ),
                x_from_exchange: result.x.gt(0) ? "Uniswap" : "Sushiswap",
                y: +ethers.utils.formatUnits(
                  result.y.mul(signChange),
                  pullToken ? pairObj.token0_decimals : pairObj.token1_decimals,
                ),
                z: +ethers.utils.formatUnits(
                  result.z.mul(signChange),
                  pullToken ? pairObj.token0_decimals : pairObj.token1_decimals,
                ),
                profit: +ethers.utils.formatUnits(
                  result.profit.mul(signChange),
                  pullToken ? pairObj.token0_decimals : pairObj.token1_decimals,
                ),
              });
            } else {
              consoleLogs.push(`Result ${i} is not profitable`);
            }
          });
        } catch (err) {
          consoleLogs.push(err.message);
        }

        if (shouldPrint) {
          consoleLogsAll = consoleLogsAll.concat(consoleLogs);
        }
      })().catch(console.error),
    );
  }

  console.log("waiting for promises to resolve");
  await Promise.all(promises);
  console.log(consoleLogsAll.join("\n"));
})().catch(console.error);

async function getCommonPairs(updateList: boolean): Promise<PairObj[]> {
  if (!updateList) {
    return await readJson(FILE_PATH);
  }
  const filter = uniswapInstance.filters.PairCreated(null, null, null, null);
  const commonPairs: PairObj[] = [];
  {
    let uniswapPairEvents = [] as ethers.Event[];
    const START = 10000834;
    const blockNumbers = [START];
    let blocks = (await provider.getBlockNumber()) - START;
    while (blocks > 0) {
      const delta = 100000;
      blockNumbers.push(blockNumbers[blockNumbers.length - 1] + delta);
      blocks -= delta;
    }
    // @ts-ignore
    blockNumbers.push("latest");

    for (let i = 0; i < blockNumbers.length - 1; i++) {
      const t1 = Date.now();
      const newPairs = await uniswapInstance.queryFilter(filter, blockNumbers[i], blockNumbers[i + 1]);
      const t2 = Date.now();
      console.log(
        `Uniswap added ${newPairs.length} pairs between ${blockNumbers[i]} and ${blockNumbers[i + 1]} (${t2 - t1} ms)`,
      );
      uniswapPairEvents = [...uniswapPairEvents, ...newPairs];
    }

    const t2 = Date.now();
    const sushiswapPairEvents = await sushiswapInstance.queryFilter(filter);
    const t3 = Date.now();
    console.log(`Sushiswap has ${sushiswapPairEvents.length} pairs (${t3 - t2} ms)`);

    uniswapPairEvents.forEach(uPairEvt => {
      const common = sushiswapPairEvents.find(sPairEvt => {
        return (
          uPairEvt.args?.token0 !== undefined &&
          sPairEvt.args?.token0 !== undefined &&
          uPairEvt.args?.token1 !== undefined &&
          sPairEvt.args?.token1 !== undefined &&
          uPairEvt.args.token0 === sPairEvt.args.token0 &&
          uPairEvt.args.token1 === sPairEvt.args.token1
        );
      });
      if (common) {
        commonPairs.push({
          token0: common.args?.token0,
          token1: common.args?.token1,
          uniswapPair: uPairEvt.args?.pair,
          sushiswapPair: common.args?.pair,
        });
      }
    });
  }
  console.log(`Total ${commonPairs.length} common pairs`);
  await writeJSON(FILE_PATH, commonPairs, { spaces: 2 });
  return getCommonPairs(false);
}

interface PairObj {
  token0: string;
  token1: string;
  uniswapPair: string;
  sushiswapPair: string;
  token0_symbol?: string;
  token1_symbol?: string;
  token0_decimals?: number;
  token1_decimals?: number;
}

interface Database {
  db: Array<{
    pairObj: PairObj;
    records: Array<Record>;
  }>;
}

interface Record {
  timestamp: number;
  uniswapLiquidity0: number;
  uniswapLiquidity1: number;
  sushiswapLiquidity0: number;
  sushiswapLiquidity1: number;
  trades: Array<Trade>;
}

interface Trade {
  pullToken: number;
  x: number;
  x_from_exchange: string;
  y: number;
  z: number;
  profit: number;
}

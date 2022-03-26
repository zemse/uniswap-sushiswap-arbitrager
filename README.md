# Uniswap Sushiswap Arbitrager

Finds profitable opportunities on ethereum mainnet to arbitrage two pairs of same tokens, each on UniswapV2 and Sushiswap, without any capital investment i.e. performing flash swap (tx gas fees needed obviously).

## Involves following programs:

1. Math calculation worked out using Calculus implemented in [Solidity](https://github.com/zemse/uniswap-sushiswap-arbitrager/blob/main/contracts/ArbitrageUniswapLib.sol), [TypeScript](https://github.com/zemse/uniswap-sushiswap-arbitrager/blob/main/scripts/arbitrage-lib.ts)).
2. NodeJs program to scan the arbitrage opportunities, implemention [find-arbitrage.ts](https://github.com/zemse/uniswap-sushiswap-arbitrager/blob/main/scripts/find-arbitrage.ts).
3. Solidity contract to execute the flash arbitrage (flash swap + normal swap) [Arbitrager.sol](https://github.com/zemse/uniswap-sushiswap-arbitrager/blob/main/contracts/Arbitrager.sol).

## Notes:

IMP: If this transaction is posted to mempool, it will be frontrun in no time ([flashbots](https://docs.flashbots.net), [Ethereum is a dark forest](https://www.paradigm.xyz/2020/08/ethereum-is-a-dark-forest)). Please do not use this in production, unless you know what you're doing.

// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@uniswap/v2-core/contracts/interfaces/IERC20.sol";
import { IUniswapV2Factory } from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import { IUniswapV2Pair } from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import { UniswapV2Library } from "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import { IUniswapV2Callee } from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol";
import { UniswapLikeArbitragerLib, Trade } from "./UniswapLikeArbitrageLib.sol";

/**
Deploy
  200:    694721
  2000:   725749
  200000: 843566

Performance:  // GAS of about 30,000 less would be charged if treasury already has some balance
  191811
  185404
 200:   183769
 2000:  183643
 200000:183289 183255 183302 183224 180914 180888

Revert: 
  46852
  40529
 */

contract UniswapLikeArbitrager is IUniswapV2Callee {
    // event TradeCalculated(uint256 x, uint256 y, uint256 z);

    // this function should be only owner since it calls anything else send all funds immediately after winning
    function main(
        address pullToken,
        address remainToken,
        address pairA, // address exchangeA, // swap
        address pairB, // address exchangeB, // flash
        address treasury
    ) public {
        require(pairA != pairB, "both exchange same");
        // evaluate if trade is profitable
        // address pairA = IUniswapV2Factory(exchangeA).getPair(pullToken, remainToken);
        // address pairB = IUniswapV2Factory(exchangeB).getPair(pullToken, remainToken);
        bool pullTokenIs0 = uint160(pullToken) < uint160(remainToken);
        uint256 x;
        uint256 y;
        uint256 z;
        {
            uint256 reserve_A_pull;
            uint256 reserve_A_remain;
            uint256 reserve_B_pull;
            uint256 reserve_B_remain;

            // these are not exactly pull and remain tokens, they are swapped below if necessary
            (reserve_A_pull, reserve_A_remain, ) = IUniswapV2Pair(pairA).getReserves();
            (reserve_B_pull, reserve_B_remain, ) = IUniswapV2Pair(pairB).getReserves();

            // swapping if pulltoken - remaintoken is different than uniswap's 0 - 1 order.
            if (!pullTokenIs0) {
                (reserve_A_pull, reserve_A_remain) = (reserve_A_remain, reserve_A_pull);
                (reserve_B_pull, reserve_B_remain) = (reserve_B_remain, reserve_B_pull);
            }

            require(
                reserve_A_pull > 0 && reserve_A_remain > 0 && reserve_B_pull > 0 && reserve_B_remain > 0,
                "No Liquidity"
            );

            (x, y, z) = UniswapLikeArbitragerLib.cal(
                reserve_B_remain,
                reserve_B_pull,
                reserve_A_remain,
                reserve_A_pull
            );
        }

        // emit TradeCalculated(x, y, z);
        require(x != 0, "Trade is not profitable");

        //
        // trigger flash loan
        IUniswapV2Pair(pairA).swap(
            pullTokenIs0 ? x : 0,
            pullTokenIs0 ? 0 : x,
            address(this),
            abi.encode(pairB, pullToken, remainToken, y, z)
        );

        // //
        // // send profits to profit address
        {
            (bool success, ) =
                remainToken.call(abi.encodeWithSignature("transfer(address,uint256)", treasury, y - z - 1));
            require(success, "erc20 transfer 3 failing");
        }
    }

    function uniswapV2Call(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external override {
        bool pullTokenIs0 = amount0 > 0;
        uint256 x = pullTokenIs0 ? amount0 : amount1;

        (address pairB, address pullToken, address remainToken, uint256 y, uint256 z) =
            abi.decode(data, (address, address, address, uint256, uint256));

        {
            // IERC20(pullToken).transfer(pairB, x);
            (bool success, ) = pullToken.call(abi.encodeWithSignature("transfer(address,uint256)", pairB, x));
            require(success, "erc20 transfer 1 failing");
        }
        IUniswapV2Pair(pairB).swap(pullTokenIs0 ? 0 : y, pullTokenIs0 ? y : 0, address(this), "");

        {
            // IERC20(remainToken).transfer(pairA, z + 1);
            (bool success, ) =
                remainToken.call(abi.encodeWithSignature("transfer(address,uint256)", msg.sender, z + 1));
            require(success, "erc20 transfer 2 failing");
        }
    }
}

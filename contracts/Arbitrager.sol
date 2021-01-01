// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@uniswap/v2-core/contracts/interfaces/IERC20.sol";
import { IUniswapV2Factory } from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import { IUniswapV2Pair } from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import { UniswapV2Library } from "@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol";
import { IUniswapV2Callee } from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Callee.sol";

struct Pair {
    address tokenA;
    address tokenB;
    uint256 minimumOutputA;
}

struct TradeDetails {
    int256 x;
    int256 y;
    int256 z;
    bool valid;
}

contract Arbitrager is IUniswapV2Callee {
    address private constant UNISWAP_V2_FACTORY = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
    address private constant SUSHISWAP_FACTORY = 0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac;

    event Addr(address addr, string m);
    event Amt(uint256 _0, uint256 _1, string m);

    event Sqrt(uint256 input, uint256 output);
    event CalX(int256 x1, int256 x2);

    event Arbitrage(address tokenA, address tokenB, uint256 output);

    event ArbitrageFailed(address tokenA, address tokenB, uint256 minimumOutput);

    function see(address token0, address token1) public {
        IUniswapV2Pair uniswapPair = IUniswapV2Pair(IUniswapV2Factory(UNISWAP_V2_FACTORY).getPair(token0, token1));
        IUniswapV2Pair sushiswapPair = IUniswapV2Pair(IUniswapV2Factory(SUSHISWAP_FACTORY).getPair(token0, token1));

        emit Addr(address(uniswapPair), "uniswapPair");
        emit Addr(address(sushiswapPair), "sushiswapPair");

        emit Addr((uniswapPair).token0(), "uniswapPair.token0");
        emit Addr((sushiswapPair).token0(), "sushiswapPair.token0");

        (uint256 ur0, uint256 ur1, ) = (uniswapPair).getReserves();
        (uint256 sr0, uint256 sr1, ) = (sushiswapPair).getReserves();
        emit Amt(ur0, ur1, "uniswap");
        emit Amt(sr0, sr1, "sushiswap");
    }

    function arbitrage(
        address token0,
        address token1,
        bool pullToken1,
        uint256 minimumOutputA
    ) public {
        require(uint160(token0) < uint160(token1), "Sort error");
        // (address token0, address token1) = UniswapV2Library.sortTokens(tokenA, tokenB);
        // bool pullToken1 = tokenB == token1;

        IUniswapV2Pair uniswapPair = IUniswapV2Pair(IUniswapV2Factory(UNISWAP_V2_FACTORY).getPair(token0, token1));
        IUniswapV2Pair sushiswapPair = IUniswapV2Pair(IUniswapV2Factory(SUSHISWAP_FACTORY).getPair(token0, token1));

        // emit Addr(uniswapPair, "uniswapPair");
        // emit Addr(sushiswapPair, "sushiswapPair");

        // emit Addr(IUniswapV2Pair(uniswapPair).token0(), "uniswapPair.token0");
        // emit Addr(IUniswapV2Pair(sushiswapPair).token0(), "sushiswapPair.token0");

        // (uint256 ur0, uint256 ur1, ) = IUniswapV2Pair(uniswapPair).getReserves();
        // (uint256 sr0, uint256 sr1, ) = IUniswapV2Pair(sushiswapPair).getReserves();
        // emit Amt(ur0, ur1, "uniswap");
        // emit Amt(sr0, sr1, "sushiswap");

        (TradeDetails memory t1, TradeDetails memory t2) = calculateTrades(token0, token1, pullToken1);
        if (t1.valid) {
            trade(
                IERC20(token0),
                IERC20(token1),
                pullToken1,
                minimumOutputA,
                t1.x > 0 ? sushiswapPair : uniswapPair,
                t1.x > 0 ? uniswapPair : sushiswapPair,
                uint256(t1.x),
                uint256(t1.y),
                uint256(t1.z),
                0
            );
        }

        if (t2.valid) {
            trade(
                IERC20(token0),
                IERC20(token1),
                pullToken1,
                minimumOutputA,
                t2.x > 0 ? uniswapPair : sushiswapPair,
                t2.x > 0 ? sushiswapPair : uniswapPair,
                uint256(t2.x),
                uint256(t2.y),
                uint256(t2.z),
                0
            );
        }
    }

    function trade(
        IERC20 token0,
        IERC20 token1,
        bool pullToken1,
        uint256 minimumOutputA,
        IUniswapV2Pair uniswapPair,
        IUniswapV2Pair sushiswapPair,
        uint256 x,
        uint256 y,
        uint256 z,
        uint8 step
    ) private {
        if (step == 0) {
            sushiswapPair.swap(
                pullToken1 ? 0 : x,
                pullToken1 ? x : 0,
                address(this),
                abi.encode(token0, token1, pullToken1, minimumOutputA, uniswapPair, sushiswapPair, x, y, z, 1)
            );
        } else if (step == 1) {
            {
                uint256 x_received = (pullToken1 ? token1 : token0).balanceOf(address(this));
                require(x_received == x, "x_received should be equal to x");

                (bool _success, ) =
                    address(pullToken1 ? token1 : token0).call(
                        abi.encodeWithSignature("transfer(address,uint256)", address(uniswapPair), x_received)
                    );
                require(_success, "step 1 transfer to uniswap failing");
            }
            y = (y * (980)) / (1000); // TODO: debug this pakad pakad ke
            (uint256 r0, uint256 r1, ) = uniswapPair.getReserves();
            // revert(r0 == 1133852215702953556 ? "yyyy" : "nnnn");
            uniswapPair.swap(
                pullToken1 ? y : 0,
                pullToken1 ? 0 : y,
                address(this),
                "0x" //abi.encode(token0, token1, pullToken1, minimumOutputA, uniswapPair, sushiswapPair, x, y, z, 2)
            );

            require(y > z, "y should be greater than z for profit");
            // revert("fxxx");
            {
                (bool _success, ) =
                    address(pullToken1 ? token0 : token1).call(
                        abi.encodeWithSignature("transfer(address,uint256)", address(uniswapPair), z)
                    );
                require(_success, "step 1 final transfer to uniswap failing");
            }
        } else if (step == 2) {
            // revert("reached step2");
        }
    }

    event UniswapCalled();

    function uniswapV2Call(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external override {
        if (data.length == 320) {
            (
                IERC20 token0,
                IERC20 token1,
                bool pullToken1,
                uint256 minimumOutputA,
                IUniswapV2Pair uniswapPair,
                IUniswapV2Pair sushiswapPair,
                uint256 x,
                uint256 y,
                uint256 z,
                uint8 step
            ) =
                abi.decode(
                    data,
                    (IERC20, IERC20, bool, uint256, IUniswapV2Pair, IUniswapV2Pair, uint256, uint256, uint256, uint8)
                );
            emit UniswapCalled();

            trade(token0, token1, pullToken1, minimumOutputA, uniswapPair, sushiswapPair, x, y, z, step);
        }
    }

    function arbitrageMultiple(Pair[] memory pairs) public {
        for (uint256 i = 0; i < pairs.length; i++) {
            (bool success, ) =
                address(this).call(
                    abi.encodeWithSignature(
                        "arbitrage(address,address,uint256)",
                        pairs[i].tokenA,
                        pairs[i].tokenB,
                        pairs[i].minimumOutputA
                    )
                );
            if (!success) {
                emit ArbitrageFailed(pairs[i].tokenA, pairs[i].tokenB, pairs[i].minimumOutputA);
            }
        }
    }

    function calculateTrades(
        address token0,
        address token1,
        bool pullToken1
    ) public returns (TradeDetails memory, TradeDetails memory) {
        address uniswapPair = IUniswapV2Factory(UNISWAP_V2_FACTORY).getPair(token0, token1);
        address sushiswapPair = IUniswapV2Factory(SUSHISWAP_FACTORY).getPair(token0, token1);

        (uint256 ur0, uint256 ur1, ) = IUniswapV2Pair(uniswapPair).getReserves();
        (uint256 sr0, uint256 sr1, ) = IUniswapV2Pair(sushiswapPair).getReserves();

        if (!pullToken1) {
            // swapping indexes
            (ur0, ur1) = (ur1, ur0);
            (sr0, sr1) = (sr1, sr0);
        }

        (int256 x1, int256 x2) = calX(ur0, ur1, sr0, sr1);
        if (x1 > int256(sr1) || x1 < (int256(sr1) * -1)) {
            x1 = 0;
        }
        if (x2 > int256(sr1) || x2 < (int256(sr1) * -1)) {
            x2 = 0;
        }
        return (calProfit(x1, ur0, ur1, sr0, sr1), calProfit(x2, ur0, ur1, sr0, sr1));
    }

    function calX(
        uint256 ur0,
        uint256 ur1,
        uint256 sr0,
        uint256 sr1
    ) public returns (int256, int256) {
        // product sq.roots
        int256 prA = int256(sqrt(ur0 * ur1));
        int256 prB = int256(sqrt(sr0 * sr1));

        // k fraction
        int256 pr_sum = prA + prB;
        int256 pr_diff = prA - prB;
        // console.log("pr_sum.toString(), pr_diff.toString()", pr_sum.toString(), pr_diff.toString());

        // const x1 = (k * (ur1 + sr1)) / 2 - (ur1 - sr1) / 2;
        int256 x1 = ((pr_sum * (int256(ur1 + sr1))) / (pr_diff * 2)) - (int256(ur1) - int256(sr1)) / 2;
        // console.log("x1.toString()", x1.toString());

        // const x2 = ((1 / k) * (ur1 + sr1)) / 2 - (ur1 - sr1) / 2;
        int256 x2 = ((pr_diff * (int256(ur1 + sr1))) / (pr_sum * 2)) - (int256(ur1) - int256(sr1)) / 2;
        // console.log("x2.toString()", x2.toString());
        emit CalX(x1, x2);
        return (x1, x2);
    }

    function calProfit(
        int256 x,
        uint256 ur0,
        uint256 ur1,
        uint256 sr0,
        uint256 sr1
    ) private returns (TradeDetails memory) {
        if (x == 0) {
            return TradeDetails({ x: 0, y: 0, z: 0, valid: false });
        }
        bool valid = true;
        // const y_pure = ur0.sub(ur0.mul(ur1).div(ur1.add(x)));
        int256 y_pure = int256(ur0) - ((int256(ur0) * int256(ur1)) / (int256(ur1) + x));
        // const y = y_pure.mul(997).div(1000);
        int256 y = y_pure; //(y_pure * 997) / 1000;
        if (y > int256(ur0) || y < (int256(ur0) * -1)) {
            valid = false;
        }
        // const z_pure = sr0.mul(sr1).div(sr1.sub(x)).sub(sr0);
        int256 z_pure = (int256(sr0 * sr1)) / (int256(sr1) - x) - int256(sr0);
        // const z = z_pure.mul(1003).div(1000);
        int256 z = (z_pure * 1003) / 1000;

        // profit = y - z;
        return TradeDetails({ x: x, y: y, z: z, valid: valid });
    }

    function sqrt(uint256 _x) public returns (uint256) {
        int256 x = int256(_x);
        int256 z = (x + 1) / 2;
        int256 y = x;
        while (z - y < 0) {
            y = z;
            z = ((x / z) + z) / (2);
        }
        emit Sqrt(_x, uint256(y));
        return uint256(y);
    }
}

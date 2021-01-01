// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0;

struct Trade {
    int256 x; // if trade is not profitable x is set as zero
    int256 y;
    int256 z;
}

library UniswapLikeArbitragerLib {
    function calX(
        uint256 Ares0,
        uint256 Ares1,
        uint256 Bres0,
        uint256 Bres1
    ) internal pure returns (int256) {
        // product sq.roots
        int256 prA = int256(sqrt(Ares0 * Ares1));
        int256 prB = int256(sqrt(Bres0 * Bres1));

        // uint256 k = (prA + prB) / (prA - prB);

        // uint256 x1 = (k * (Ares1 * (1000 / 997) + Bres1)) / 2 - (Ares1 * (1000 / 997) - Bres1) / 2;
        // int256 x1 =
        //     ((((int256(Ares1) * 1000 + int256(Bres1) * 997) * (prA + prB)) / (prA - prB)) -
        //         (int256(Ares1) * 1000 - int256(Bres1) * 997)) /
        //         2 /
        //         997;
        // uint256 x2 = ((1 / k) * (Ares1 * (1000 / 997) + Bres1)) / 2 - (Ares1 * (1000 / 997) - Bres1) / 2;
        int256 x2 =
            ((((int256(Ares1) * 1000 + int256(Bres1) * 997) * (prA - prB)) / (prA + prB)) -
                (int256(Ares1) * 1000 - int256(Bres1) * 997)) /
                2 /
                997;
        return (x2);
    }

    // export function calProfit(x: number, Ares0: number, Ares1: number, Bres0: number, Bres1: number): number {
    //   return Ares0 - (Ares0 * Ares1) / (Ares1 + x) + (Bres0 * Bres1) / (x - Bres1) + Bres0;
    // }

    function cal(
        uint256 Ares0,
        uint256 Ares1,
        uint256 Bres0,
        uint256 Bres1
    )
        internal
        returns (
            uint256 x,
            uint256 y,
            uint256 z
        )
    {
        // (trades[0].x, trades[1].x) = calX(Ares0, Ares1, Bres0, Bres1);
        int256 _x = calX(Ares0, Ares1, Bres0, Bres1);
        if (_x <= 0) {
            return (0, 0, 0);
        }
        x = uint256(_x);
        // trades[0].y = (trades[0].x * 997 * int256(Ares0)) / (int256(Ares1) * 1000 + trades[0].x * 997);
        // trades[0].z = (((int256(Bres0) * trades[0].x) / (int256(Bres1) - trades[0].x)) * 1000) / 997;

        y = ((x * 997 * Ares0)) / (Ares1 * 1000 + x * 997);
        z = ((((Bres0 * x) * 1000) / (Bres1 - x))) / 997;

        if (x >= Bres1 || y >= Ares0 || z < 0) {
            delete x;
        }
    }

    // function isTradeProfitable(Trade memory trade, ) private returns bool() {

    // }

    function sqrt(uint256 _x) public pure returns (uint256) {
        int256 x = int256(_x);
        int256 z = (x + 1) / 2;
        int256 y = x;
        while (z - y < 0) {
            y = z;
            z = ((x / z) + z) / (2);
        }

        return uint256(y);
    }
}

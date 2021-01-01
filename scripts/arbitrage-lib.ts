import { BigNumber, ethers } from "ethers";

export function calX(Ares0: number, Ares1: number, Bres0: number, Bres1: number): [number, number] {
  // product sq.roots
  const prA = Math.sqrt(Ares0 * Ares1);
  const prB = Math.sqrt(Bres0 * Bres1);

  const k = (prA + prB) / (prA - prB);

  const x1 = (k * (Ares1 * (1000 / 997) + Bres1)) / 2 - (Ares1 * (1000 / 997) - Bres1) / 2;
  const x2 = ((1 / k) * (Ares1 * (1000 / 997) + Bres1)) / 2 - (Ares1 * (1000 / 997) - Bres1) / 2;
  return [x1, x2];
}

// export function calProfit(x: number, Ares0: number, Ares1: number, Bres0: number, Bres1: number): number {
//   return Ares0 - (Ares0 * Ares1) / (Ares1 + x) + (Bres0 * Bres1) / (x - Bres1) + Bres0;
// }

export function cal(Ares0: number, Ares1: number, Bres0: number, Bres1: number) {
  const xArr = calX(Ares0, Ares1, Bres0, Bres1);
  return xArr.map(x => {
    // const y = Ares0 - (Ares0 * Ares1) / (Ares1 + x);
    // const z = (Bres0 * Bres1) / (Bres1 - x) - Bres0;
    const y = (x * (997 / 1000) * Ares0) / (Ares1 + x * (997 / 1000));
    const z = (((Bres0 * x) / (Bres1 - x)) * 1000) / 997;
    const profit = y - z;
    return { x, y, z, profit };
  });
}

export function calX_BN(
  Ares0: BigNumber,
  Ares1: BigNumber,
  Bres0: BigNumber,
  Bres1: BigNumber,
): [BigNumber, BigNumber] {
  // product sq.roots
  const prA = bignumberSqrt(Ares0.mul(Ares1));
  const prB = bignumberSqrt(Bres0.mul(Bres1));

  // k fraction
  const pr_sum = prA.add(prB);
  const pr_diff = prA.sub(prB);
  // console.log("pr_sum.toString(), pr_diff.toString()", pr_sum.toString(), pr_diff.toString());

  // const x1 = (k * (Ares1 + Bres1)) / 2 - (Ares1 - Bres1) / 2;
  // const x1 = pr_sum.mul(Ares1.add(Bres1)).div(pr_diff.mul(2)).sub(Ares1.sub(Bres1).div(2));
  const x1 = pr_sum
    .mul(Ares1.mul(1000).add(Bres1.mul(997)))
    .div(pr_diff)
    .add(Bres1.mul(997).sub(Ares1.mul(1000)))
    .div(2)
    .div(997);

  // console.log("x1.toString()", x1.toString());

  // const x2 = ((1 / k) * (Ares1 + Bres1)) / 2 - (Ares1 - Bres1) / 2;
  // const x2 = pr_diff.mul(Ares1.add(Bres1)).div(pr_sum.mul(2)).sub(Ares1.sub(Bres1).div(2));
  const x2 = pr_diff
    .mul(Ares1.mul(1000).add(Bres1.mul(997)))
    .div(pr_sum)
    .add(Bres1.mul(997).sub(Ares1.mul(1000)))
    .div(2)
    .div(997);

  // console.log("x2.toString()", x2.toString());
  return [x1, x2];
}

export function cal_BN(Ares0: BigNumber, Ares1: BigNumber, Bres0: BigNumber, Bres1: BigNumber) {
  const xArr = calX_BN(Ares0, Ares1, Bres0, Bres1);
  // console.log(1);

  return xArr.map(x => {
    // const y_pure = Ares0.sub(Ares0.mul(Ares1).div(Ares1.add(x)));
    // const y = y_pure.mul(997).div(1000);
    // const z_pure = Bres0.mul(Bres1).div(Bres1.sub(x)).sub(Bres0);
    // const z = z_pure.mul(1003).div(1000);
    const y = x
      .mul(997)
      .mul(Ares0)
      .div(Ares1.mul(1000).add(x.mul(997)));
    const z = Bres0.mul(x).mul(1000).div(Bres1.sub(x)).div(997);
    const profit = y.sub(z);
    return { x, y, z, profit };
  });
}

const ONE = ethers.BigNumber.from(1);
const TWO = ethers.BigNumber.from(2);

function bignumberSqrt(x: BigNumber) {
  let z = x.add(ONE).div(TWO);
  let y = x;
  while (z.sub(y).isNegative()) {
    y = z;
    z = x.div(z).add(z).div(TWO);
  }
  return y;
}

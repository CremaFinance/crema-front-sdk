import Decimal from "decimal.js";
import invariant from "tiny-invariant";

import type { Tick } from "../state";
import { tick2SqrtPrice } from ".";

/**
 * Calculate liquity and another token amount when current tick is in [tickLower, tickUpper]
 * @param tickLower The tick lower
 * @param tickUpper The tick upper
 * @param currentSqrtPrice The current sqrt price
 * @param desiredAmountSrc The src token amount
 * @param direct 0(desiredAmountSrc is TokenA), 1(desiredAmountSrc is TokenB)
 * @returns The liquity and dst token amount
 */
export function calculateLiquity(
  tickLower: number,
  tickUpper: number,
  desiredAmountSrc: Decimal,
  currentSqrtPrice: Decimal,
  direct: number
): {
  desiredAmountDst: Decimal;
  deltaLiquity: Decimal;
} {
  invariant(tickLower < tickUpper, "The tickLower must less than tickUpper");
  const lowerSqrtPrice = tick2SqrtPrice(tickLower);
  const upperSqrtPrice = tick2SqrtPrice(tickUpper);
  invariant(
    currentSqrtPrice.greaterThanOrEqualTo(lowerSqrtPrice) &&
      currentSqrtPrice.lessThanOrEqualTo(upperSqrtPrice),
    "The current price must in [lowerPrice,upperPrice]"
  );
  const one = new Decimal(1);
  if (direct === 0) {
    const deltaLiquity = desiredAmountSrc.div(
      one.div(currentSqrtPrice).sub(one.div(upperSqrtPrice))
    );
    const desiredAmountDst = deltaLiquity.mul(
      currentSqrtPrice.sub(lowerSqrtPrice)
    );
    return { desiredAmountDst, deltaLiquity };
  } else {
    const deltaLiquity = desiredAmountSrc.div(
      currentSqrtPrice.sub(lowerSqrtPrice)
    );
    const desiredAmountDst = deltaLiquity.mul(
      one.div(currentSqrtPrice).sub(one.div(upperSqrtPrice))
    );
    return { desiredAmountDst, deltaLiquity };
  }
}

/**
 * Calculate amount out of token A and token B by liquity
 * @param tickLower The tick lower
 * @param tickUpper The tick upper
 * @param currentSqrtPrice The current sqrt price
 * @param liquity The liquity amount
 * @returns The amount of token A and token B
 */
export function calculateTokenAmount(
  tickLower: number,
  tickUpper: number,
  liquity: Decimal,
  currentSqrtPrice: Decimal
): {
  amountA: Decimal;
  amountB: Decimal;
} {
  const lowerSqrtPrice = tick2SqrtPrice(tickLower);
  const upperSqrtPrice = tick2SqrtPrice(tickUpper);
  if (currentSqrtPrice.lessThan(lowerSqrtPrice)) {
    return {
      amountA: liquity
        .div(lowerSqrtPrice)
        .sub(liquity.div(upperSqrtPrice))
        .toDecimalPlaces(0),
      amountB: new Decimal(0),
    };
  } else if (currentSqrtPrice.greaterThan(upperSqrtPrice)) {
    return {
      amountA: new Decimal(0),
      amountB: liquity
        .mul(upperSqrtPrice)
        .sub(liquity.mul(lowerSqrtPrice))
        .toDecimalPlaces(0),
    };
  } else {
    return {
      amountA: liquity
        .div(currentSqrtPrice)
        .sub(liquity.div(upperSqrtPrice))
        .toDecimalPlaces(0),
      amountB: liquity
        .mul(currentSqrtPrice)
        .sub(liquity.mul(lowerSqrtPrice))
        .toDecimalPlaces(0),
    };
  }
}

/**
 * Calculate liquity when current tick is less than tickLower
 * @param tickLower The tick lower
 * @param tickUpper The tick upper
 * @param desiredAmountA The desired amount of token A
 * @returns the liquity
 */
export function calculateLiquityOnlyA(
  tickLower: number,
  tickUpper: number,
  desiredAmountA: Decimal
): Decimal {
  invariant(tickLower < tickUpper, "The tickLower must less than tickUpper");
  const lowerSqrtPrice = tick2SqrtPrice(tickLower);
  const upperSqrtPrice = tick2SqrtPrice(tickUpper);
  const one = new Decimal(1);
  return desiredAmountA.div(
    one.div(lowerSqrtPrice).sub(one.div(upperSqrtPrice))
  );
}

/**
 * Calculate liquity when current tick is less than tickLower
 * @param tickLower The tick lower
 * @param tickUpper The tick upper
 * @returns The liquity
 */
export function calculateLiquityOnlyB(
  tickLower: number,
  tickUpper: number,
  desiredAmountB: Decimal
): Decimal {
  invariant(tickLower < tickUpper, "The tickLower must less than tickUpper");
  const lowerSqrtPrice = tick2SqrtPrice(tickLower);
  const upperSqrtPrice = tick2SqrtPrice(tickUpper);
  return desiredAmountB.div(upperSqrtPrice.sub(lowerSqrtPrice));
}

export interface Liquity {
  lowerTick: number;
  upperTick: number;
  amount: Decimal;
}
/**
 * Calculate the liquitys table
 * @param ticks The tick array of token swap
 * @returns The min, max of liquity, and liquitys array
 */
export function calculateLiquityTable(ticks: Tick[]): {
  maxLiquity: Decimal;
  minLiquity: Decimal;
  liquitys: Liquity[];
} {
  let minLiquity = new Decimal(0);
  let maxLiquity = new Decimal(0);
  const liquitys: Liquity[] = [];
  const liquity: Liquity = {
    lowerTick: 0,
    upperTick: 0,
    amount: new Decimal(0),
  };
  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i];
    invariant(tick !== undefined);
    if (liquity.amount.equals(0)) {
      liquity.lowerTick = tick.tick;
      liquity.amount = tick.liquityNet;
      continue;
    }
    liquity.upperTick = tick.tick;
    minLiquity =
      liquity.amount.lessThan(minLiquity) || minLiquity.equals(0)
        ? liquity.amount
        : minLiquity;
    maxLiquity = liquity.amount.greaterThan(maxLiquity)
      ? liquity.amount
      : maxLiquity;
    liquitys.push({
      lowerTick: liquity.lowerTick,
      upperTick: liquity.upperTick,
      amount: liquity.amount,
    });
    liquity.amount = liquity.amount.add(tick.liquityNet);
    liquity.lowerTick = tick.tick;
  }
  return { maxLiquity, minLiquity, liquitys };
}

/**
 * Calculate max tokenAmount with sliding point.
 * @param liquity.
 */
export function calculateSlidTokenAmount(
  tickLower: number,
  tickUpper: number,
  liquity: Decimal,
  currentSqrtPrice: Decimal,
  slid: Decimal
): {
  maxAmountA: Decimal;
  minAmountA: Decimal;
  maxAmountB: Decimal;
  minAmountB: Decimal;
  amountA: Decimal;
  amountB: Decimal;
} {
  invariant(
    slid.lessThan(1) && slid.greaterThan(0),
    `Invalid slid:${slid.toString()}`
  );
  const maxSqrtPrice = currentSqrtPrice.mul(new Decimal(1).add(slid).sqrt());
  const minSqrtPrice = currentSqrtPrice.mul(new Decimal(1).sub(slid).sqrt());
  const constant = calculateTokenAmount(
    tickLower,
    tickUpper,
    liquity,
    currentSqrtPrice
  );
  const minRes = calculateTokenAmount(
    tickLower,
    tickUpper,
    liquity,
    minSqrtPrice
  );
  const maxRes = calculateTokenAmount(
    tickLower,
    tickUpper,
    liquity,
    maxSqrtPrice
  );
  return {
    maxAmountA: minRes.amountA,
    minAmountA: maxRes.amountA,
    maxAmountB: maxRes.amountB,
    minAmountB: minRes.amountB,
    amountA: constant.amountA,
    amountB: constant.amountB,
  };
}

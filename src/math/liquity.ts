import Decimal from "decimal.js";
import { Tick } from "../state";
import invariant from "tiny-invariant";
import { tick2SqrtPrice } from "./tick";

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
  let lowerSqrtPrice = tick2SqrtPrice(tickLower);
  let upperSqrtPrice = tick2SqrtPrice(tickUpper);
  invariant(
    currentSqrtPrice.greaterThanOrEqualTo(lowerSqrtPrice) &&
      currentSqrtPrice.lessThanOrEqualTo(upperSqrtPrice),
    "The current price must in [lowerPrice,upperPrice]"
  );
  let one = new Decimal(1);
  if (direct === 0) {
    let deltaLiquity = desiredAmountSrc.div(
      one.div(currentSqrtPrice).sub(one.div(upperSqrtPrice))
    );
    let desiredAmountDst = deltaLiquity.mul(
      currentSqrtPrice.sub(lowerSqrtPrice)
    );
    return { desiredAmountDst, deltaLiquity };
  } else {
    let deltaLiquity = desiredAmountSrc.div(
      currentSqrtPrice.sub(lowerSqrtPrice)
    );
    let desiredAmountDst = deltaLiquity.mul(
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
  let lowerSqrtPrice = tick2SqrtPrice(tickLower);
  let upperSqrtPrice = tick2SqrtPrice(tickUpper);
  if (currentSqrtPrice.lessThan(lowerSqrtPrice)) {
    return {
      amountA: liquity.div(lowerSqrtPrice).sub(liquity.div(upperSqrtPrice)),
      amountB: new Decimal(0),
    };
  } else if (currentSqrtPrice.greaterThan(upperSqrtPrice)) {
    return {
      amountA: new Decimal(0),
      amountB: liquity.mul(upperSqrtPrice).sub(liquity.mul(lowerSqrtPrice)),
    };
  } else {
    return {
      amountA: liquity.div(currentSqrtPrice).sub(liquity.div(upperSqrtPrice)),
      amountB: liquity.mul(currentSqrtPrice).sub(liquity.mul(lowerSqrtPrice)),
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
  let lowerSqrtPrice = tick2SqrtPrice(tickLower);
  let upperSqrtPrice = tick2SqrtPrice(tickUpper);
  let one = new Decimal(1);
  return desiredAmountA.div(
    one.div(lowerSqrtPrice).sub(one.div(upperSqrtPrice))
  );
}

/**
 * Calculate liquity when current tick is less than tickLower
 * @param tickLower The tick lower
 * @param tickUpper The tick upper
 * @param desiredAmountA The desired amount of token B
 * @returns The liquity
 */
export function calculateLiquityOnlyB(
  tickLower: number,
  tickUpper: number,
  desiredAmountB: Decimal
): Decimal {
  invariant(tickLower < tickUpper, "The tickLower must less than tickUpper");
  let lowerSqrtPrice = tick2SqrtPrice(tickLower);
  let upperSqrtPrice = tick2SqrtPrice(tickUpper);
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
export function calculateLiquityTable(
  ticks: Tick[]
): {
  maxLiquity: Decimal;
  minLiquity: Decimal;
  liquitys: Liquity[];
} {
  let minLiquity = new Decimal(0);
  let maxLiquity = new Decimal(0);
  const liquitys: Liquity[] = [];
  let liquity: Liquity = {
    lowerTick: 0,
    upperTick: 0,
    amount: new Decimal(0),
  };
  for (let i = 0; i < ticks.length; i++) {
    if (liquity.amount.equals(0)) {
      liquity.lowerTick = ticks[i].tick;
      liquity.amount = ticks[i].liquityNet;
      continue;
    }
    liquity.upperTick = ticks[i].tick;
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
    liquity.amount = liquity.amount.add(ticks[i].liquityNet);
    liquity.lowerTick = ticks[i].tick;
  }
  return { maxLiquity, minLiquity, liquitys };
}

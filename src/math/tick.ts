import { Decimal } from "decimal.js";
import invariant from "tiny-invariant";

import type { Tick } from "../state";

// The max ticker
export const MAX_TICK = 443632;
// export const MAX_TICK = 552648

// The min ticker
export const MIN_TICK = -MAX_TICK;

// The price pieces
// price = pow(PIECES, TICK)
export const PIECES = new Decimal("1.0001");
export const PRICE_OFFSET = new Decimal("1e-12");
export const MAX_PRICE = PIECES.pow(MAX_TICK).add(PRICE_OFFSET);
export const MIN_PRICE = PIECES.pow(MIN_TICK).add(PRICE_OFFSET);
export const MAX_SQRT_PRICE = PIECES.pow(MAX_TICK / 2)
  .add(PRICE_OFFSET)
  .toDP(12);
export const MIN_SQRT_PRICE = PIECES.pow(MIN_TICK / 2)
  .sub(PRICE_OFFSET)
  .toDP(12);

/**
 * Get the tick by sqrt price
 *
 * @param sqrtPrice the sqrt price
  let afterSqrtPrice = liquity.div(amountIn.add(liquity.div(upperSqrtPrice)));
 */
export function sqrtPrice2Tick(sqrtPrice: Decimal): number {
  invariant(
    sqrtPrice.lessThanOrEqualTo(MAX_SQRT_PRICE),
    `Invalid sqrtPrice: ${sqrtPrice.toString()} Max: ${MAX_SQRT_PRICE.toString()}, too large`
  );
  invariant(
    sqrtPrice.greaterThanOrEqualTo(MIN_SQRT_PRICE),
    `Invalid sqrtPrice: ${sqrtPrice.toString()}, Min: ${MIN_SQRT_PRICE.toString()}, too small`
  );
  return sqrtPrice.pow(2).log(PIECES).toDP(0, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Get the sqrt price by tick
 * @param tick the tick
 * @returns the sqrt price
 */
export function tick2SqrtPrice(tick: number): Decimal {
  invariant(
    tick >= MIN_TICK && tick <= MAX_TICK,
    `Invalid tick: ${tick}, must be in range [${MIN_TICK}, ${MAX_TICK}]`
  );
  return PIECES.pow(tick / 2);
}

/**
 * Get the tick by price
 * @param price the price
 * @returns the tick
 */
export function price2Tick(price: Decimal): number {
  invariant(
    price.lessThan(MAX_PRICE),
    `Invalid price:${price.toString()} Max: ${MAX_PRICE.toString()},  too large`
  );
  invariant(
    price.greaterThan(MIN_PRICE),
    `Invalid price:${price.toString()} Min: ${MIN_PRICE.toString()}, too small`
  );
  return price.log(PIECES).toDP(0, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Get the price by tick
 * @param tick the tick
 * @returns the price
 */
export function tick2Price(tick: number): Decimal {
  invariant(
    tick >= MIN_TICK && tick <= MAX_TICK,
    `Invalid tick: ${tick}, must be in range [${MIN_TICK.toString()}, ${MAX_TICK.toString()}]`
  );
  return PIECES.pow(tick);
}

/**
 * Get the nearest valid tick
 * @deprecated please use {@link getNearestTickBySqrtPrice Or getNearestTickByPrice} instead
 * @param sqrtPrice the sqrt price
 * @param tickSpace the tick space
 * @returns the tick or null
 */
export function getNearestTick(
  sqrtPrice: Decimal,
  tickSpace: number
): number | null {
  return getNearestTickBySqrtPrice(sqrtPrice, tickSpace);
}

/**
 * Get the nearest valid tick for positions
 * @param sqrtPrice the sqrt price
 * @param tickSpace the tick space
 * @returns the tick or null(if the tick space <= 0)
 */
export function getNearestTickBySqrtPrice(
  sqrtPrice: Decimal,
  tickSpace: number
): number {
  invariant(
    tickSpace > 0 && tickSpace % 1 === 0,
    `Invalid tickSpace:${tickSpace}`
  );
  invariant(
    sqrtPrice.lessThan(MAX_SQRT_PRICE),
    `Invalid sqrtPrice: ${sqrtPrice.toString()} Max: ${MAX_SQRT_PRICE.toString()}, too large`
  );
  invariant(
    sqrtPrice.greaterThan(MIN_SQRT_PRICE),
    `Invalid sqrtPrice: ${sqrtPrice.toString()}, Min: ${MIN_SQRT_PRICE.toString()}, too small`
  );
  const t = sqrtPrice2Tick(sqrtPrice);
  const m = (t - MIN_TICK) % tickSpace;
  if (m > tickSpace / 2) {
    return t - m + tickSpace;
  }
  return t - m;
}

/**
 * Get the nearest valid tick for positions
 * @param price the price
 * @param tickSpace the tick space
 * @returns the tick or null(if the tick space <= 0)
 */
export function getNearestTickByPrice(
  price: Decimal,
  tickSpace: number
): number {
  invariant(
    tickSpace > 0 && tickSpace % 1 === 0,
    `Invalid tickSpace:${tickSpace}`
  );
  invariant(
    price.lessThan(MAX_PRICE),
    `Invalid price:${price.toString()} Max: ${MAX_PRICE.toString()},  too large`
  );
  invariant(
    price.greaterThan(MIN_PRICE),
    `Invalid price:${price.toString()} Min: ${MIN_PRICE.toString()}, too small`
  );
  const t = price2Tick(price);
  const m = (t - MIN_TICK) % tickSpace;
  if (m > tickSpace / 2) {
    return t - m + tickSpace;
  }
  return t - m;
}

/**
 *
 * @param ticks The tick array of token swap
 * @param currentSqrtPrice The current sqrt price of token swap
 * @param fee The fee rate of token swap
 * @param currentLiquity The current liquity of token swap
 * @param amountIn The amount in of token A
 * @returns amountOut:The amount out of token B, amountUsed:The used of amountIn, afterPrice:The price after calculate, afterLiquity: The liquity after calculate
 */
export function calculateSwapA2B(
  ticks: Tick[],
  currentSqrtPrice: Decimal,
  fee: Decimal,
  currentLiquity: Decimal,
  amountIn: Decimal
): {
  amountOut: Decimal;
  amountUsed: Decimal;
  feeUsed: Decimal;
  afterPrice: Decimal;
  afterLiquity: Decimal;
} {
  invariant(amountIn.greaterThan(new Decimal(0)), "invalid amount in");
  invariant(
    currentLiquity.greaterThanOrEqualTo(new Decimal(0)),
    "invalid liquity"
  );
  invariant(ticks.length > 0, "the ticks is empty");
  //let currentTick = sqrtPrice2Tick(currentSqrtPrice);
  invariant(ticks[0] !== undefined);
  invariant(currentSqrtPrice > ticks[0].tickPrice, "out of ticks");
  let liquity = currentLiquity;
  let out = new Decimal(0);
  let remind = amountIn;
  let remindWithFee = new Decimal(0);
  let feeUsed = new Decimal(0);
  let amountUsed = new Decimal(0);
  for (let i = ticks.length - 1; i >= 0; i--) {
    const ticksI = ticks[i];
    invariant(ticksI !== undefined);
    if (liquity.equals(new Decimal(0))) {
      currentSqrtPrice = ticksI.tickPrice.sub(PRICE_OFFSET);
      liquity = liquity.sub(ticksI.liquityNet);
      //upperSqrtPrice = ticks[i].tickPrice;
      continue;
    }
    if (currentSqrtPrice < ticksI.tickPrice) {
      continue;
    }
    const upperSqrtPrice = currentSqrtPrice;
    const lowerSqrtPrice = ticksI.tickPrice;
    const maxAmountIn = maxAmountA(lowerSqrtPrice, currentSqrtPrice, liquity);
    const fullStepFee = maxAmountIn.mul(fee).toDP(0, Decimal.ROUND_DOWN);
    if (remind.lessThan(fullStepFee)) {
      remindWithFee = remind;
    } else {
      remindWithFee = remind.sub(fullStepFee);
    }

    if (maxAmountIn.greaterThanOrEqualTo(remindWithFee)) {
      remindWithFee = remind
        .mul(new Decimal(1).sub(fee))
        .toDP(0, Decimal.ROUND_UP);
      const { amountOut, afterSqrtPrice } = swapA2B(
        upperSqrtPrice,
        liquity,
        remindWithFee
      );
      amountUsed = amountUsed.add(remind);
      feeUsed = feeUsed.add(remind.sub(remindWithFee));
      return {
        amountOut: out.add(amountOut),
        amountUsed,
        feeUsed,
        afterPrice: afterSqrtPrice,
        afterLiquity: liquity,
      };
    } else {
      remind = remindWithFee.sub(maxAmountIn);
      amountUsed = amountUsed.add(maxAmountIn).add(fullStepFee);
      feeUsed = feeUsed.add(fullStepFee);
      out = out.add(maxAmountB(lowerSqrtPrice, upperSqrtPrice, liquity));
      liquity = liquity.sub(ticksI.liquityNet);
      currentSqrtPrice = ticksI.tickPrice.sub(PRICE_OFFSET);
      //upperSqrtPrice = ticks[i].tickPrice;
    }
  }
  return {
    amountOut: out,
    amountUsed,
    feeUsed,
    afterPrice: currentSqrtPrice,
    afterLiquity: liquity,
  };
}

/**
 *
 * @param ticks The tick array of token swap
 * @param currentSqrtPrice The current sqrt price of token swap
 * @param fee The fee rate of token swap
 * @param currentLiquity The current liquity of token swap
 * @param amountIn The amount in of token B
 * @returns amountOut:The amount out of token B, amountUsed:The used of amountIn, afterPrice:The price after calculate, afterLiquity: The liquity after calculate
 */
export function calculateSwapB2A(
  ticks: Tick[],
  currentSqrtPrice: Decimal,
  fee: Decimal,
  currentLiquity: Decimal,
  amountIn: Decimal
): {
  amountOut: Decimal;
  amountUsed: Decimal;
  feeUsed: Decimal;
  afterPrice: Decimal;
  afterLiquity: Decimal;
} {
  invariant(amountIn.greaterThan(new Decimal(0)), "invalid amount in");
  invariant(
    currentLiquity.greaterThanOrEqualTo(new Decimal(0)),
    "invalid liquity"
  );
  invariant(ticks.length > 0, "the ticks is empty");
  //let currentTick = sqrtPrice2Tick(currentSqrtPrice);
  const lastTick = ticks[ticks.length - 1];
  invariant(
    lastTick !== undefined && currentSqrtPrice.lessThan(lastTick.tickPrice),
    "out of ticks"
  );
  let liquity = currentLiquity;
  let out = new Decimal(0);
  let remind = amountIn;
  let remindWithFee = new Decimal(0);
  let amountUsed = new Decimal(0);
  let feeUsed = new Decimal(0);
  for (let i = 0; i < ticks.length; i++) {
    const ticksI = ticks[i];
    invariant(ticksI !== undefined);
    if (liquity.equals(new Decimal(0))) {
      currentSqrtPrice = ticksI.tickPrice.add(PRICE_OFFSET);
      liquity = liquity.add(ticksI.liquityNet);
      continue;
    }
    if (currentSqrtPrice > ticksI.tickPrice) {
      continue;
    }
    const upperSqrtPrice = ticksI.tickPrice;
    const maxAmountIn = maxAmountB(currentSqrtPrice, upperSqrtPrice, liquity);
    const fullStepFee = maxAmountIn.mul(fee).toDP(0, Decimal.ROUND_DOWN);
    if (remind.lessThan(fullStepFee)) {
      remindWithFee = remind;
    } else {
      remindWithFee = remind.sub(fullStepFee);
    }
    if (maxAmountIn.greaterThanOrEqualTo(remindWithFee)) {
      remindWithFee = remind
        .mul(new Decimal(1).sub(fee))
        .toDP(0, Decimal.ROUND_UP);
      const { amountOut, afterSqrtPrice } = swapB2A(
        currentSqrtPrice,
        liquity,
        remindWithFee
      );
      amountUsed = amountUsed.add(remind);
      feeUsed = feeUsed.add(remind.sub(remindWithFee));
      return {
        amountOut: out.add(amountOut),
        feeUsed,
        amountUsed,
        afterPrice: afterSqrtPrice.pow(2),
        afterLiquity: liquity,
      };
    } else {
      remind = remindWithFee.sub(maxAmountIn);
      amountUsed = amountUsed.add(maxAmountIn).add(fullStepFee);
      feeUsed = feeUsed.add(fullStepFee);
      out = out.add(maxAmountA(currentSqrtPrice, upperSqrtPrice, liquity));
      liquity = liquity.add(ticksI.liquityNet);
      currentSqrtPrice = ticksI.tickPrice.add(PRICE_OFFSET);
    }
  }
  return {
    amountOut: out,
    amountUsed,
    feeUsed,
    afterPrice: currentSqrtPrice,
    afterLiquity: liquity,
  };
}

/** @internal */
export function maxAmountA(
  lowerSqrtPrice: Decimal,
  upperSqrtPrice: Decimal,
  liquity: Decimal
): Decimal {
  return liquity
    .div(lowerSqrtPrice)
    .toDP(0, Decimal.ROUND_DOWN)
    .sub(liquity.div(upperSqrtPrice).toDP(0, Decimal.ROUND_DOWN));
}

/** @internal */
export function maxAmountB(
  lowerSqrtPrice: Decimal,
  upperSqrtPrice: Decimal,
  liquity: Decimal
): Decimal {
  return liquity
    .mul(upperSqrtPrice.sub(lowerSqrtPrice))
    .toDP(0, Decimal.ROUND_DOWN);
}

/** @internal */
export function swapA2B(
  upperSqrtPrice: Decimal,
  liquity: Decimal,
  amountIn: Decimal
): { amountOut: Decimal; afterSqrtPrice: Decimal } {
  const afterSqrtPrice = liquity.div(amountIn.add(liquity.div(upperSqrtPrice)));
  const delta_increase = amountIn.add(
    liquity.div(upperSqrtPrice).toDP(0, Decimal.ROUND_DOWN)
  );
  const out = liquity
    .mul(upperSqrtPrice)
    .toDP(0, Decimal.ROUND_DOWN)
    .sub(liquity.mul(liquity).div(delta_increase).toDP(0, Decimal.ROUND_DOWN));
  return { amountOut: out, afterSqrtPrice };
}

/** @internal */
export function swapB2A(
  lowerSqrtPrice: Decimal,
  liquity: Decimal,
  amountIn: Decimal
): { amountOut: Decimal; afterSqrtPrice: Decimal } {
  const afterSqrtPrice = amountIn.div(liquity).add(lowerSqrtPrice);
  const delta_increase = amountIn.add(
    liquity.mul(lowerSqrtPrice).toDP(0, Decimal.ROUND_DOWN)
  );
  const out = liquity
    .div(lowerSqrtPrice)
    .toDP(0, Decimal.ROUND_DOWN)
    .sub(liquity.mul(liquity).div(delta_increase).toDP(0, Decimal.ROUND_DOWN));
  return { amountOut: out, afterSqrtPrice };
}

/*
 * Convert the tick to ui price.
 * @param tick the tick.
 * @param baseDecimals the base token decimals.
 * @param quoteDecimals the quote token decimals
 * @return The ui price
 */
export function tick2UiPrice(
  tick: number,
  baseDecimals: number,
  quoteDecimals: number
): Decimal {
  const multiple = new Decimal(10)
    .pow(quoteDecimals)
    .div(new Decimal(10).pow(baseDecimals));
  return tick2Price(tick).mul(multiple);
}

/*
 * Convert the ui price to tick.
 * @param price the ui price.
 * @param baseDecimals the base token decimals.
 * @param quoteDecimals the quote token decimals
 * @return The tick
 */
export function uiPrice2Tick(
  price: Decimal,
  baseDecimals: number,
  quoteDecimals: number
): number {
  const multiple = new Decimal(10)
    .pow(baseDecimals)
    .div(new Decimal(10).pow(quoteDecimals));
  return price2Tick(price.mul(multiple));
}

/*
 * Convert the lamport price(with decimals) to ui price
 * @param price the lamport price
 * @param baseDecimals the base token decimals.
 * @param quoteDecimals the quote token decimals
 * @return The ui price
 */
export function lamportPrice2uiPrice(
  price: Decimal,
  baseDecimals: number,
  quoteDecimals: number
): Decimal {
  const multiple = new Decimal(10)
    .pow(baseDecimals)
    .div(new Decimal(10).pow(quoteDecimals));
  return price.mul(multiple);
}

/*
 * Convert the ui price to lamport price
 * @param price the lamport price
 * @param baseDecimals the base token decimals.
 * @param quoteDecimals the quote token decimals
 * @return The lamport price
 */
export function uiPrice2LamportPrice(
  price: Decimal,
  baseDecimals: number,
  quoteDecimals: number
): Decimal {
  const multiple = new Decimal(10)
    .pow(quoteDecimals)
    .div(new Decimal(10).pow(baseDecimals));
  return price.mul(multiple);
}

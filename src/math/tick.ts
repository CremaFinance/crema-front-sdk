import { Decimal } from "decimal.js";
import invariant from "tiny-invariant";
import { Tick } from "../state";

// The max ticker
export const MAX_TICK = 443632;
// export const MAX_TICK = 552648

// The min ticker
export const MIN_TICK = -MAX_TICK;

// The price pieces
// price = pow(PIECES, TICK)
export const PIECES = new Decimal("1.0001");

export const MAX_PRICE = PIECES.pow(MAX_TICK);
export const MIN_PRICE = PIECES.pow(MIN_TICK);
export const MAX_SQRT_PRICE = PIECES.pow(MAX_TICK / 2);
export const MIN_SQRT_PRICE = PIECES.pow(MIN_TICK / 2);

/**
 * Get the tick by sqrt price
 *
 * @param sqrtPrice the sqrt price
 * @return the tick
 */
export function sqrtPrice2Tick(sqrtPrice: Decimal): number {
  invariant(
    sqrtPrice.lessThan(MAX_SQRT_PRICE),
    `Invalid sqrtPrice: ${sqrtPrice.toString()} Max: ${MAX_SQRT_PRICE}, too large`
  );
  invariant(
    sqrtPrice.greaterThan(MIN_SQRT_PRICE),
    `Invalid sqrtPrice: ${sqrtPrice.toString()}, Min: ${MIN_SQRT_PRICE}, too small`
  );
  return sqrtPrice
    .pow(2)
    .log(PIECES)
    .toDP(0, Decimal.ROUND_HALF_UP)
    .toNumber();
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
    `Invalid price:${price.toString()} Max: ${MAX_PRICE},  too large`
  );
  invariant(
    price.greaterThan(MIN_PRICE),
    `Invalid price:${price.toString()} Min: ${MIN_PRICE}, too small`
  );
  return price
    .log(PIECES)
    .toDP(0, Decimal.ROUND_HALF_UP)
    .toNumber();
}

/**
 * Get the price by tick
 * @param tick the tick
 * @returns the price
 */
export function tick2Price(tick: number): Decimal {
  invariant(
    tick >= MIN_TICK && tick <= MAX_TICK,
    `Invalid tick: ${tick}, must be in range [${MIN_TICK}, ${MAX_TICK}]`
  );
  return PIECES.pow(tick);
}

/**
 * Get the nearest valid tick
 * @deprecated please use {@link getNearestTickBySqrtPrice Or getNearestTickByPrice} instead
 * @param sqrtPrice the sqrt price
 * @param tickSpace the tick space
 * @param isLower is the tick is lowwer
 * @returns the tick or null
 */
export function getNearestTick(
  sqrtPrice: Decimal,
  tickSpace: number,
  isLower: boolean
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
    `Invalid sqrtPrice: ${sqrtPrice.toString()} Max: ${MAX_SQRT_PRICE}, too large`
  );
  invariant(
    sqrtPrice.greaterThan(MIN_SQRT_PRICE),
    `Invalid sqrtPrice: ${sqrtPrice.toString()}, Min: ${MIN_SQRT_PRICE}, too small`
  );
  let t = sqrtPrice2Tick(sqrtPrice);
  let m = (t - MIN_TICK) % tickSpace;
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
    `Invalid price:${price.toString()} Max: ${MAX_PRICE},  too large`
  );
  invariant(
    price.greaterThan(MIN_PRICE),
    `Invalid price:${price.toString()} Min: ${MIN_PRICE}, too small`
  );
  let t = price2Tick(price);
  let m = (t - MIN_TICK) % tickSpace;
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
  let currentTick = sqrtPrice2Tick(currentSqrtPrice);
  invariant(currentTick > ticks[0].tick, "out of ticks");
  let liquity = currentLiquity;
  let out = new Decimal(0);
  let remind = amountIn;
  let remindWithFee = new Decimal(0);
  let feeUsed = new Decimal(0);
  let amountUsed = new Decimal(0);
  let upperSqrtPrice = currentSqrtPrice;
  for (let i = ticks.length - 1; i >= 0; i--) {
    if (liquity.equals(new Decimal(0))) {
      currentTick = ticks[i].tick;
      liquity = liquity.sub(ticks[i].liquityNet);
      upperSqrtPrice = ticks[i].tickPrice;
      continue;
    }
    if (currentTick <= ticks[i].tick) {
      continue;
    }
    let lowerSqrtPrice = ticks[i].tickPrice;
    let maxAmountIn = maxAmountA(lowerSqrtPrice, upperSqrtPrice, liquity);
    let fullStepFee = maxAmountIn.mul(fee).toDP(0, Decimal.ROUND_DOWN);
    if (remind.lessThan(fullStepFee)) {
      remindWithFee = remind;
    } else {
      remindWithFee = remind.sub(fullStepFee);
    }

    if (maxAmountIn.greaterThanOrEqualTo(remindWithFee)) {
      remindWithFee = remind
        .mul(new Decimal(1).sub(fee))
        .toDP(0, Decimal.ROUND_UP);
      let { amountOut, afterSqrtPrice } = swapA2B(
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
        afterPrice: afterSqrtPrice.pow(2),
        afterLiquity: liquity,
      };
    } else {
      remind = remindWithFee.sub(maxAmountIn);
      amountUsed = amountUsed.add(maxAmountIn).add(fullStepFee);
      feeUsed = feeUsed.add(fullStepFee);
      out = out.add(maxAmountB(lowerSqrtPrice, upperSqrtPrice, liquity));
      liquity = liquity.sub(ticks[i].liquityNet);
      currentTick = ticks[i].tick;
      upperSqrtPrice = ticks[i].tickPrice;
    }
  }
  return {
    amountOut: out,
    amountUsed,
    feeUsed,
    afterPrice: tick2Price(currentTick),
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
  let currentTick = sqrtPrice2Tick(currentSqrtPrice);
  invariant(currentTick < ticks[ticks.length - 1].tick, "out of ticks");
  let liquity = currentLiquity;
  let out = new Decimal(0);
  let remind = amountIn;
  let remindWithFee = new Decimal(0);
  let amountUsed = new Decimal(0);
  let feeUsed = new Decimal(0);
  let lowerSqrtPrice = currentSqrtPrice;
  for (let i = 0; i < ticks.length; i++) {
    if (liquity.equals(new Decimal(0))) {
      currentTick = ticks[i].tick;
      liquity = liquity.add(ticks[i].liquityNet);
      lowerSqrtPrice = ticks[i].tickPrice;
      continue;
    }
    if (currentTick >= ticks[i].tick) {
      continue;
    }
    let upperSqrtPrice = ticks[i].tickPrice;
    let maxAmountIn = maxAmountB(lowerSqrtPrice, upperSqrtPrice, liquity);
    let fullStepFee = maxAmountIn.mul(fee).toDP(0, Decimal.ROUND_DOWN);
    if (remind.lessThan(fullStepFee)) {
      remindWithFee = remind;
    } else {
      remindWithFee = remind.sub(fullStepFee);
    }
    if (maxAmountIn.greaterThanOrEqualTo(remindWithFee)) {
      remindWithFee = remind
        .mul(new Decimal(1).sub(fee))
        .toDP(0, Decimal.ROUND_UP);
      let { amountOut, afterSqrtPrice } = swapB2A(
        lowerSqrtPrice,
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
      out = out.add(maxAmountA(lowerSqrtPrice, upperSqrtPrice, liquity));
      liquity = liquity.add(ticks[i].liquityNet);
      currentTick = ticks[i].tick;
      lowerSqrtPrice = ticks[i].tickPrice;
    }
  }
  return {
    amountOut: out,
    amountUsed,
    feeUsed,
    afterPrice: tick2Price(currentTick),
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
  let afterSqrtPrice = liquity.div(amountIn.add(liquity.div(upperSqrtPrice)));
  let delta_increase = amountIn.add(
    liquity.div(upperSqrtPrice).toDP(0, Decimal.ROUND_DOWN)
  );
  let out = liquity
    .mul(upperSqrtPrice)
    .toDP(0, Decimal.ROUND_DOWN)
    .sub(
      liquity
        .mul(liquity)
        .div(delta_increase)
        .toDP(0, Decimal.ROUND_DOWN)
    );
  return { amountOut: out, afterSqrtPrice };
}

/** @internal */
export function swapB2A(
  lowerSqrtPrice: Decimal,
  liquity: Decimal,
  amountIn: Decimal
): { amountOut: Decimal; afterSqrtPrice: Decimal } {
  let afterSqrtPrice = amountIn.div(liquity).add(lowerSqrtPrice);
  let delta_increase = amountIn.add(
    liquity.mul(lowerSqrtPrice).toDP(0, Decimal.ROUND_DOWN)
  );
  let out = liquity
    .div(lowerSqrtPrice)
    .toDP(0, Decimal.ROUND_DOWN)
    .sub(
      liquity
        .mul(liquity)
        .div(delta_increase)
        .toDP(0, Decimal.ROUND_DOWN)
    );
  return { amountOut: out, afterSqrtPrice };
}

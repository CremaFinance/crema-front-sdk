import Decimal from 'decimal.js'
import invariant from 'tiny-invariant'
import { Tick } from '../state'

Decimal.config(
    {
        precision: 64,
        rounding: Decimal.ROUND_HALF_DOWN,
        toExpNeg: -64,
        toExpPos: 64,
    }
)

// The max ticker
// export const MAX_TICK = 443636
export const MAX_TICK = 552648

// The min ticker
export const MIN_TICK = -MAX_TICK

// The price pieces
// price = pow(PIECES, TICK)
export const PIECES = new Decimal('1.0001')

export const MAX_PRICE = PIECES.pow(MAX_TICK)
export const MIN_PRICE = PIECES.pow(MIN_TICK)
export const MAX_SQRT_PRICE = PIECES.pow(MAX_TICK / 2)
export const MIN_SQRT_PRICE = PIECES.pow(MIN_TICK / 2)

export const TICK_INFO_SPAN = 84000

/** 
* Get the tick by sqrt price
*
* @param sqrtPrice the sqrt price
* @return the tick
*/
export function sqrtPrice2Tick(sqrtPrice: Decimal): number {
    invariant(sqrtPrice.lessThan(MAX_SQRT_PRICE), `Invalid sqrtPrice: ${sqrtPrice.toString()} Max: ${MAX_SQRT_PRICE}, too large`)
    invariant(sqrtPrice.greaterThan(MIN_SQRT_PRICE), `Invalid sqrtPrice: ${sqrtPrice.toString()}, Min: ${MIN_SQRT_PRICE}, too small`)
    return sqrtPrice.pow(2).log(PIECES).toDP(0, Decimal.ROUND_HALF_UP).toNumber()
}

/**
 * Get the sqrt price by tick
 * @param tick the tick 
 * @returns the sqrt price
 */
export function tick2SqrtPrice(tick: number): Decimal {
    invariant(tick >= MIN_TICK && tick <= MAX_TICK, `Invalid tick: ${tick}, must be in range [${MIN_TICK}, ${MAX_TICK}]`)
    return PIECES.pow(tick / 2)
}

/**
 * Get the tick by price
 * @param price the price
 * @returns the tick
 */
export function price2Tick(price: Decimal): number {
    invariant(price.lessThan(MAX_PRICE), `Invalid price:${price.toString()} Max: ${MAX_PRICE},  too large`)
    invariant(price.greaterThan(MIN_PRICE), `Invalid price:${price.toString()} Min: ${MIN_PRICE}, too small`)
    return price.log(PIECES).toDP(0, Decimal.ROUND_HALF_UP).toNumber()
}

/**
 * Get the price by tick
 * @param tick the tick
 * @returns the price
 */
export function tick2Price(tick: number): Decimal {
    invariant(tick >= MIN_TICK && tick <= MAX_TICK, `Invalid tick: ${tick}, must be in range [${MIN_TICK}, ${MAX_TICK}]`)
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
export function getNearestTick(sqrtPrice: Decimal, tickSpace: number, isLower: boolean): number | null {
    return getNearestTickBySqrtPrice(sqrtPrice, tickSpace)
}

/**
 * Get the nearest valid tick for positions
 * @param sqrtPrice the sqrt price
 * @param tickSpace the tick space
 * @returns the tick or null(if the tick space <= 0)
 */
export function getNearestTickBySqrtPrice(sqrtPrice: Decimal, tickSpace: number): number {
    invariant((tickSpace > 0) && ((tickSpace % 1) === 0), `Invalid tickSpace:${tickSpace}`)
    invariant(sqrtPrice.lessThan(MAX_SQRT_PRICE), `Invalid sqrtPrice: ${sqrtPrice.toString()} Max: ${MAX_SQRT_PRICE}, too large`)
    invariant(sqrtPrice.greaterThan(MIN_SQRT_PRICE), `Invalid sqrtPrice: ${sqrtPrice.toString()}, Min: ${MIN_SQRT_PRICE}, too small`)
    let t = sqrtPrice2Tick(sqrtPrice)
    let m = (t - MIN_TICK) % tickSpace
    if (m > tickSpace / 2) {
        return t - m + tickSpace
    }
    return t - m
}

/**
 * Get the nearest valid tick for positions
 * @param price the price
 * @param tickSpace the tick space
 * @returns the tick or null(if the tick space <= 0)
 */
export function getNearestTickByPrice(price: Decimal, tickSpace: number): number {
    invariant((tickSpace > 0) && ((tickSpace % 1) === 0), `Invalid tickSpace:${tickSpace}`)
    invariant(price.lessThan(MAX_PRICE), `Invalid price:${price.toString()} Max: ${MAX_PRICE},  too large`)
    invariant(price.greaterThan(MIN_PRICE), `Invalid price:${price.toString()} Min: ${MIN_PRICE}, too small`)
    let t = price2Tick(price)
    let m = (t - MIN_TICK) % tickSpace
    if (m > tickSpace / 2) {
        return t - m + tickSpace
    }
    return t - m
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
    amountOut: Decimal,
    amountUsed: Decimal,
    afterPrice: Decimal,
    afterLiquity: Decimal,
} {
    invariant(amountIn.greaterThan(new Decimal(0)), "invalid amount in")
    invariant(currentLiquity.greaterThanOrEqualTo(new Decimal(0)), "invalid liquity")
    invariant(ticks.length > 0, "the ticks is empty")
    let currentTick = sqrtPrice2Tick(currentSqrtPrice)
    invariant(currentTick > ticks[0].tick, "out of ticks")
    let liquity = currentLiquity
    let out = new Decimal(0)
    // let rate = new Decimal(1).add(fee)
    let rate = fee.div(new Decimal(1).sub(fee)).add(new Decimal(1))
    let remain = amountIn.div(rate)
    let amountUsed = new Decimal(0)
    for (let i = ticks.length - 1; i >= 0; i--) {
        if (liquity.equals(new Decimal(0))) {
            currentTick = ticks[i].tick
            liquity = liquity.sub(ticks[i].liquityNet)
            continue
        }
        if (currentTick <= ticks[i].tick) {
            continue
        }
        let lowerSqrtPrice = tick2SqrtPrice(ticks[i].tick)
        let upperSqrtPrice = tick2SqrtPrice(currentTick)
        let maxAmountIn = maxAmountA(lowerSqrtPrice, upperSqrtPrice, liquity)

        if (maxAmountIn.greaterThanOrEqualTo(remain)) {
            let { amountOut, afterSqrtPrice } = swapA2B(lowerSqrtPrice, upperSqrtPrice, liquity, remain)
            amountUsed = amountUsed.add(remain.mul(rate))
            return { amountOut: out.add(amountOut), amountUsed, afterPrice: afterSqrtPrice.pow(2), afterLiquity: liquity }
        } else {
            remain = remain.sub(maxAmountIn)
            amountUsed = amountUsed.add(maxAmountIn.mul(rate))
            out = out.add(maxAmountB(lowerSqrtPrice, upperSqrtPrice, liquity))
            liquity = liquity.sub(ticks[i].liquityNet)
            currentTick = ticks[i].tick
        }
    }
    return { amountOut: out, amountUsed, afterPrice: tick2Price(currentTick), afterLiquity: liquity }
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
    amountOut: Decimal,
    amountUsed: Decimal,
    afterPrice: Decimal,
    afterLiquity: Decimal,
} {
    invariant(amountIn.greaterThan(new Decimal(0)), "invalid amount in")
    invariant(currentLiquity.greaterThanOrEqualTo(new Decimal(0)), "invalid liquity")
    invariant(ticks.length > 0, "the ticks is empty")
    let currentTick = sqrtPrice2Tick(currentSqrtPrice)
    invariant(currentTick < ticks[ticks.length - 1].tick, "out of ticks")
    let liquity = currentLiquity
    let out = new Decimal(0)
    //let rate = new Decimal(1).add(fee)
    let rate = fee.div(new Decimal(1).sub(fee)).add(new Decimal(1))
    let remain = amountIn.div(rate)
    let amountUsed = new Decimal(0)
    for (let i = 0; i < ticks.length; i++) {
        if (liquity.equals(new Decimal(0))) {
            currentTick = ticks[i].tick
            liquity = liquity.add(ticks[i].liquityNet)
            continue
        }
        if (currentTick >= ticks[i].tick) {
            continue
        }
        let lowerSqrtPrice = tick2SqrtPrice(currentTick)
        let upperSqrtPrice = tick2SqrtPrice(ticks[i].tick)
        let maxAmountIn = maxAmountB(lowerSqrtPrice, upperSqrtPrice, liquity)

        if (maxAmountIn.greaterThanOrEqualTo(remain)) {
            let { amountOut, afterSqrtPrice } = swapB2A(lowerSqrtPrice, upperSqrtPrice, liquity, remain)
            amountUsed = amountUsed.add(remain.mul(rate))
            return { amountOut: out.add(amountOut), amountUsed, afterPrice: afterSqrtPrice.pow(2), afterLiquity: liquity }
        } else {
            remain = remain.sub(maxAmountIn)
            amountUsed = amountUsed.add(maxAmountIn.mul(rate))
            out = out.add(maxAmountA(lowerSqrtPrice, upperSqrtPrice, liquity))
            liquity = liquity.add(ticks[i].liquityNet)
            currentTick = ticks[i].tick
        }
    }
    return { amountOut: out, amountUsed, afterPrice: tick2Price(currentTick), afterLiquity: liquity }
}

/** @internal */
export function maxAmountA(lowerSqrtPrice: Decimal, upperSqrtPrice: Decimal, liquity: Decimal): Decimal {
    let one = new Decimal(1)
    return liquity.mul(one.div(lowerSqrtPrice).sub(one.div(upperSqrtPrice)))
}

/** @internal */
export function maxAmountB(lowerSqrtPrice: Decimal, upperSqrtPrice: Decimal, liquity: Decimal): Decimal {
    return liquity.mul(upperSqrtPrice.sub(lowerSqrtPrice))
}

/** @internal */
export function swapA2B(lowerSqrtPrice: Decimal, upperSqrtPrice: Decimal, liquity: Decimal, amountIn: Decimal): { amountOut: Decimal, afterSqrtPrice: Decimal } {
    invariant(maxAmountA(lowerSqrtPrice, upperSqrtPrice, liquity).greaterThanOrEqualTo(amountIn), "out of tick")
    let before = maxAmountB(lowerSqrtPrice, upperSqrtPrice, liquity)
    let afterSqrtPrice = liquity.div(amountIn.add(liquity.div(upperSqrtPrice)))
    let after = maxAmountB(lowerSqrtPrice, afterSqrtPrice, liquity)
    return { amountOut: before.sub(after), afterSqrtPrice }

}

/** @internal */
export function swapB2A(lowerSqrtPrice: Decimal, upperSqrtPrice: Decimal, liquity: Decimal, amountIn: Decimal): { amountOut: Decimal, afterSqrtPrice: Decimal } {
    invariant(maxAmountB(lowerSqrtPrice, upperSqrtPrice, liquity).greaterThanOrEqualTo(amountIn), "out of tick")
    let before = maxAmountA(lowerSqrtPrice, upperSqrtPrice, liquity)
    let afterSqrtPrice = amountIn.div(liquity).add(lowerSqrtPrice)
    let after = maxAmountA(afterSqrtPrice, upperSqrtPrice, liquity)
    return { amountOut: before.sub(after), afterSqrtPrice }
}
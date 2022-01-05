import { url } from "../src/util/url";
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { TokenSwap } from '../src/tokenSwap';
import Decimal from "decimal.js";
import { calculateLiquity, calculateLiquityOnlyA, getNearestTickByPrice } from "../src/math";
import invariant from "tiny-invariant";
import { Token } from "@solana/spl-token";

export const PROGRAM_ID = new PublicKey("5Pj7hESxMKuoZGztQL5Ab3KtDsGsKL5MxkypY4k7PeFE")
export const TOKEN_SWAP_KEY = new PublicKey("2xiK9cKwamxfhyUwJPoSEN3pihdnK9NZ7Svos96fnBEE")
export const PAYER = Keypair.fromSecretKey(new Uint8Array([102, 88, 110, 202, 187, 128, 209, 4, 12, 97, 105, 56, 81, 168, 150, 190, 38, 221, 82, 60, 185, 68, 193, 113, 233, 32, 224, 193, 169, 199, 225, 31, 42, 102, 27, 129, 168, 23, 103, 67, 169, 227, 105, 103, 96, 76, 109, 223, 245, 23, 241, 63, 191, 236, 51, 107, 246, 232, 122, 64, 71, 30, 77, 183]))
export const TOKEN_A_MINT = new PublicKey("5smfGJccdpeetdReFzX8qTvvxRAQMy64swym8DSPhvRp")
export const TOKEN_B_MINT = new PublicKey("6LtDq6wKa1a585os9xxFrVdpWWNGxG37K9dxe6en8mTn")
export const USER_TOKEN_A = new PublicKey("Gwv36X1tA3bzJNi8zdznBHVhaUcJNAzMCDkPNoctDJCu")
export const USER_TOKEN_B = new PublicKey("D5H3s2SAKQjLZQRFPNVxCAy7MK8svvAJcJ3VvXnbZvhc")
export const TICK_SPACE = 60
export const TOKEN_DECIMAL = 1000000000

/**
 * Create a token swap
 * @param conn 
 * @returns 
 */
export async function createTokenSwap(conn: Connection): Promise<TokenSwap | null> {
    const fee = new Decimal(0.05)
    const managerFee = new Decimal(0.005)
    const initializedPrice = new Decimal(1)

    return await TokenSwap.createTokenSwap(
        conn,
        PROGRAM_ID,
        TOKEN_A_MINT,
        TOKEN_B_MINT,
        PAYER.publicKey,
        fee,
        managerFee,
        TICK_SPACE,
        initializedPrice,
        PAYER
    )
}

export async function mintPosition(swap: TokenSwap) {
    let tickLower = swap.getNearestTickByPrice(new Decimal(0.9))
    let tickUpper = swap.getNearestTickByPrice(new Decimal(1))
    let desiredAmountA = new Decimal(2000 * TOKEN_DECIMAL)
    let { desiredAmountB, liquity } = swap.calculateLiquityByTokenA(tickLower, tickUpper, desiredAmountA)
    let maximumAmountA = desiredAmountA.mul(1.05)
    let maximumAmountB = desiredAmountB.mul(1.05)
    let transferAuthority = new Keypair()
    if (maximumAmountA.greaterThan(0)) {
        await swap.approve(USER_TOKEN_A, TOKEN_A_MINT, maximumAmountA, transferAuthority)
    }
    if (maximumAmountB.greaterThan(0)) {
        await swap.approve(USER_TOKEN_B, TOKEN_B_MINT, maximumAmountB, transferAuthority)
    }
    console.log(
        {
            tickLower: tickLower.toString(),
            tickUpper: tickUpper.toString(),
            userTokenA: USER_TOKEN_A.toString(),
            userTokenB: USER_TOKEN_B.toString(),
            maximumAmountA: maximumAmountA.toString(),
            maximumAmountB: maximumAmountB.toString(),
        }
    )
    let tx = await swap.mintPosition(
        USER_TOKEN_A,
        USER_TOKEN_B,
        tickLower,
        tickUpper,
        liquity,
        maximumAmountA,
        maximumAmountB,
        transferAuthority
    )
    if (tx != null) {
        console.log(tx)
    }
}

export async function increaseLiquity(swap: TokenSwap, positionId: PublicKey) {
    let positionInfo = swap.getPositionInfo(positionId)
    console.log(positionInfo)
    invariant(positionInfo != undefined, `position:${positionId} not found`)
    let desiredAmountA = new Decimal(100 * TOKEN_DECIMAL)
    let { desiredAmountB, liquity } = swap.calculateLiquityByTokenA(positionInfo.lowerTick, positionInfo.upperTick, desiredAmountA)
    let maximumAmountA = desiredAmountA.mul(1.05)
    let maximumAmountB = desiredAmountB.mul(1.05)
    let tx = await swap.increaseLiquity(
        positionId,
        USER_TOKEN_A,
        USER_TOKEN_B,
        liquity,
        desiredAmountA.mul(1.05),
        desiredAmountB.mul(1.05),
    )
    console.log(
        {
            position: positionInfo,
            userTokenA: USER_TOKEN_A.toString(),
            userTokenB: USER_TOKEN_B.toString(),
            liquity: liquity,
            maximumAmountA: maximumAmountA,
            maximumAmountB: maximumAmountB,
        }
    )
    if (tx != null) {
        console.log(tx)
    }
}

export async function decreaseLiquity(swap: TokenSwap, positionId: PublicKey) {
    let positionInfo = swap.getPositionInfo(positionId)
    invariant(positionInfo != undefined, `position:${positionId} not found`)
    let { liquity, amountA, amountB } = swap.calculatePositionValue(positionId)
    let minimumAmountA = amountA.mul(0.45)
    let minimumAmountB = amountB.mul(0.45)
    let tx = await swap.decreaseLiquity(
        positionId,
        USER_TOKEN_A,
        USER_TOKEN_B,
        liquity,
        minimumAmountA,
        minimumAmountB,
    )
    console.log(
        {
            position: positionInfo,
            userTokenA: USER_TOKEN_A.toString(),
            userTokenB: USER_TOKEN_B.toString(),
            liquity: liquity,
            minimumAmountA: minimumAmountA,
            minimumAmountB: minimumAmountB,
        }
    )
    if (tx != null) {
        console.log(tx)
    }
}

export async function swap(swap: TokenSwap) {
    let amountIn = new Decimal(3000 * TOKEN_DECIMAL)
    let direct = 1
    console.log(
        {
            userTokenA: USER_TOKEN_A.toString(),
            userTokenB: USER_TOKEN_B.toString(),
            amountIn: amountIn.toNumber(),
            direct: direct
        }
    )
    let transferAuthority = new Keypair()
    let { userSrc, userDst } = direct === 1 ? { userSrc: USER_TOKEN_A, userDst: USER_TOKEN_B } : { userSrc: USER_TOKEN_B, userDst: USER_TOKEN_A }
    direct === 1 ?
        await swap.approve(USER_TOKEN_A, TOKEN_A_MINT, amountIn.mul(1.05), transferAuthority) :
        await swap.approve(USER_TOKEN_B, TOKEN_B_MINT, amountIn.mul(1.05), transferAuthority)


    //await swap.approveB(USER_TOKEN_B, amountIn)
    let tx = await swap.swap(
        userSrc,
        userDst,
        direct,
        amountIn,
        new Decimal(0),
        transferAuthority
    )
    if (tx != null) {
        console.log(tx)
    }
}
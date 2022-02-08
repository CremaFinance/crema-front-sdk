import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { TokenSwap } from '../src/tokenSwap';
import Decimal from "decimal.js";
import invariant from "tiny-invariant";
import * as fs from "fs";

export const PROGRAM_ID = new PublicKey("6MLxLqiXaaSUpkgMnWDTuejNZEz3kE7k2woyHGVFw319")
export const PAYER = KPFromFile("./.secret")

// mainnet-beta
// export const TOKEN_SWAP_KEY = new PublicKey("8J3avAjuRfL2CYFKKDwhhceiRoajhrHv9kN5nUiEnuBG")
//
// devnet
export const TOKEN_SWAP_KEY = new PublicKey("8BHKY3e1N2EmH89yXuxhYhd2aP2Ex5xhoZUJ4eUTsekY")


export const TOKEN_A_MINT = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")
export const TOKEN_B_MINT = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")
export const USER_TOKEN_A = new PublicKey("Gwv36X1tA3bzJNi8zdznBHVhaUcJNAzMCDkPNoctDJCu")
export const USER_TOKEN_B = new PublicKey("D5H3s2SAKQjLZQRFPNVxCAy7MK8svvAJcJ3VvXnbZvhc")
export const TICK_SPACE = 60
export const TOKEN_DECIMAL = 1000000000

export function KPFromFile(path: string): Keypair {
    const secret = fs.readFileSync(path, "utf-8");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const arr: Uint8Array = JSON.parse(secret);
    return Keypair.fromSecretKey(Uint8Array.from(arr));
}

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
        await swap.approve(USER_TOKEN_A, swap.tokenSwapInfo.tokenAMint, maximumAmountA, transferAuthority)
    }
    if (maximumAmountB.greaterThan(0)) {
        await swap.approve(USER_TOKEN_B, swap.tokenSwapInfo.tokenBMint, maximumAmountB, transferAuthority)
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
        await swap.approve(USER_TOKEN_A, swap.tokenSwapInfo.tokenAMint, amountIn.mul(1.05), transferAuthority) :
        await swap.approve(USER_TOKEN_B, swap.tokenSwapInfo.tokenBMint, amountIn.mul(1.05), transferAuthority)


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

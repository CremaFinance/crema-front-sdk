import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { struct, u8 } from 'buffer-layout'
import Decimal from 'decimal.js'
import { decimalU64 } from '../util/layout'
import { TokenSwapInstruction } from './instruction'

interface Data {
    instruction: number,
    amountIn: Decimal,
    // minimumAmountOut: Decimal,
    direction: number,
}

const DataLayout = struct<Data>(
    [
        u8("instruction"),
        decimalU64("amountIn"),
        // decimalU64("minimumAmountOut"),
        u8("direction")
    ]
)

export const simulateSwapInstruction = (
    programId: PublicKey,
    tokenSwapKey: PublicKey,
    ticksKey: PublicKey,
    amountIn: Decimal,
    // minimumAmountOut: Decimal,
    direction:number,
): TransactionInstruction => {
    let data = Buffer.alloc(DataLayout.span)
    DataLayout.encode(
        {
            instruction: TokenSwapInstruction.SimulateSwap,
            amountIn,
            // minimumAmountOut,
            direction
        },
        data
    )
    const keys = [
        { pubkey: tokenSwapKey, isSigner: false, isWritable: true },
        { pubkey: ticksKey, isSigner: false, isWritable: true },
    ]
    return new TransactionInstruction({
        keys,
        programId,
        data,
    })
}

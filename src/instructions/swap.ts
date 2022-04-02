import { struct, u8 } from "@solana/buffer-layout";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import { TransactionInstruction } from "@solana/web3.js";
import type Decimal from "decimal.js";

import { decimalU64 } from "../util/layout";
import { TokenSwapInstruction } from "./instruction";

interface Data {
  instruction: number;
  amountIn: Decimal;
  minimumAmountOut: Decimal;
}

const DataLayout = struct<Data>([
  u8("instruction"),
  decimalU64("amountIn"),
  decimalU64("minimumAmountOut"),
]);

export const swapInstruction = (
  programId: PublicKey,
  tokenSwapKey: PublicKey,
  authority: PublicKey,
  userTransferAuthority: PublicKey,
  userSource: PublicKey,
  userDestination: PublicKey,
  swapSource: PublicKey,
  swapDestination: PublicKey,
  ticksKey: PublicKey,
  amountIn: Decimal,
  minimumAmountOut: Decimal
): TransactionInstruction => {
  const data = Buffer.alloc(DataLayout.span);
  DataLayout.encode(
    {
      instruction: TokenSwapInstruction.Swap,
      amountIn,
      minimumAmountOut,
    },
    data
  );
  const keys = [
    { pubkey: tokenSwapKey, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: userSource, isSigner: false, isWritable: true },
    { pubkey: userDestination, isSigner: false, isWritable: true },
    { pubkey: swapSource, isSigner: false, isWritable: true },
    { pubkey: swapDestination, isSigner: false, isWritable: true },
    { pubkey: ticksKey, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

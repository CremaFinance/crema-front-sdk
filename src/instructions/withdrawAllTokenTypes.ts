import { struct, u8 } from "@solana/buffer-layout";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import { TransactionInstruction } from "@solana/web3.js";
import type Decimal from "decimal.js";

import { decimalU64, decimalU128 } from "../util/layout";
import { TokenSwapInstruction } from "./instruction";

interface Data {
  instruction: number;
  liquityAmount: Decimal;
  minimumTokenA: Decimal;
  minimumTokenB: Decimal;
  positionIndex: Decimal;
}

const DataLayout = struct<Data>([
  u8("instruction"),
  decimalU128("liquityAmount"),
  decimalU64("minimumTokenA"),
  decimalU64("minimumTokenB"),
  decimalU64("positionIndex"),
]);

export const withdrawAllTokenTypesInstruction = (
  programId: PublicKey,
  tokenSwapKey: PublicKey,
  authority: PublicKey,
  userTransferAuthority: PublicKey,
  swapTokenA: PublicKey,
  swapTokenB: PublicKey,
  userTokenA: PublicKey,
  userTokenB: PublicKey,
  nftMint: PublicKey,
  nftUser: PublicKey,
  ticksKey: PublicKey,
  positionsKey: PublicKey,
  liquityAmount: Decimal,
  minimumTokenA: Decimal,
  minimumTokenB: Decimal,
  positionIndex: Decimal
): TransactionInstruction => {
  const data = Buffer.alloc(DataLayout.span);
  DataLayout.encode(
    {
      instruction: TokenSwapInstruction.WithdrawAllTokenTypes,
      liquityAmount,
      minimumTokenA,
      minimumTokenB,
      positionIndex,
    },
    data
  );
  const keys = [
    { pubkey: tokenSwapKey, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: nftMint, isSigner: false, isWritable: true },
    { pubkey: nftUser, isSigner: false, isWritable: true },
    { pubkey: swapTokenA, isSigner: false, isWritable: true },
    { pubkey: swapTokenB, isSigner: false, isWritable: true },
    { pubkey: userTokenA, isSigner: false, isWritable: true },
    { pubkey: userTokenB, isSigner: false, isWritable: true },
    { pubkey: ticksKey, isSigner: false, isWritable: true },
    { pubkey: positionsKey, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

import { s32, struct, u8 } from "@solana/buffer-layout";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import { TransactionInstruction } from "@solana/web3.js";
import type Decimal from "decimal.js";

import { decimalU64 } from "../util/layout";
import { TokenSwapInstruction } from "./instruction";

export interface Data {
  instruction: number;
  isNewPosition: number;
  fixTokenType: number;
  tickLower: number;
  tickUpper: number;
  maximumTokenA: Decimal;
  maximumTokenB: Decimal;
  positionIndex: Decimal;
}

const DataLayout = struct<Data>([
  u8("instruction"),
  u8("isNewPosition"),
  u8("fixTokenType"),
  s32("tickLower"),
  s32("tickUpper"),
  decimalU64("maximumTokenA"),
  decimalU64("maximumTokenB"),
  decimalU64("positionIndex"),
]);

export const Decode = (data: Buffer): Data => {
  return DataLayout.decode(data);
};

export const depositFixTokenInstruction = (
  programId: PublicKey,
  tokenSwapKey: PublicKey,
  authority: PublicKey,
  userTransferAuthority: PublicKey,
  userTokenA: PublicKey,
  userTokenB: PublicKey,
  swapTokenA: PublicKey,
  swapTokenB: PublicKey,
  nftMint: PublicKey,
  nftUser: PublicKey,
  ticksKey: PublicKey,
  positionsKey: PublicKey,
  isNewPosition: number,
  fixTokenType: number,
  tickLower: number,
  tickUpper: number,
  maximumTokenA: Decimal,
  maximumTokenB: Decimal,
  positionIndex: Decimal
): TransactionInstruction => {
  const data = Buffer.alloc(DataLayout.span);
  DataLayout.encode(
    {
      instruction: TokenSwapInstruction.DepositFixToken,
      isNewPosition,
      fixTokenType,
      tickLower,
      tickUpper,
      maximumTokenA,
      maximumTokenB,
      positionIndex,
    },
    data
  );
  console.log({
    instruction: TokenSwapInstruction.DepositFixToken,
    isNewPosition,
    fixTokenType,
    tickLower,
    tickUpper,
    maximumTokenA: maximumTokenA.toString(),
    maximumTokenB: maximumTokenB.toString(),
    positionIndex: positionIndex.toString(),
  });
  const keys = [
    { pubkey: tokenSwapKey, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: userTokenA, isSigner: false, isWritable: true },
    { pubkey: userTokenB, isSigner: false, isWritable: true },
    { pubkey: swapTokenA, isSigner: false, isWritable: true },
    { pubkey: swapTokenB, isSigner: false, isWritable: true },
    { pubkey: nftMint, isSigner: false, isWritable: true },
    { pubkey: nftUser, isSigner: false, isWritable: true },
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

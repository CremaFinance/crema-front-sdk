import { struct, u8, u32 } from "@solana/buffer-layout";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import { TransactionInstruction } from "@solana/web3.js";
import Decimal from "decimal.js";

import { decimalU64, decimalU128 } from "../util/layout";
import { TokenSwapInstruction } from "./instruction";

interface Data {
  instruction: number;
  nonce: number;
  curveType: number;
  fee: Decimal;
  managerFee: Decimal;
  tickSpace: number;
  currentSqrtPrice: Decimal;
  currentLiquity: Decimal;
  feeGrowthGlobal0: Decimal;
  feeGrowthGlobal1: Decimal;
  managerFeeA: Decimal;
  managerFeeB: Decimal;
}

const DataLayout = struct<Data>([
  u8("instruction"),
  u8("nonce"),
  u8("curveType"),
  decimalU64("fee", 12),
  decimalU64("managerFee", 12),
  u32("tickSpace"),
  decimalU128("currentSqrtPrice", 12),
  decimalU128("currentLiquity"),
  decimalU128("feeGrowthGlobal0"),
  decimalU128("feeGrowthGlobal1"),
  decimalU128("managerFeeA"),
  decimalU128("managerFeeB"),
]);

export const initializeInstruction = (
  programId: PublicKey,
  tokenSwapKey: PublicKey,
  authority: PublicKey,
  manager: PublicKey,
  managerTokenA: PublicKey,
  managerTokenB: PublicKey,
  swapTokenA: PublicKey,
  swapTokenB: PublicKey,
  ticksKey: PublicKey,
  positionsKey: PublicKey,
  nonce: number,
  curveType: number,
  fee: Decimal,
  managerFee: Decimal,
  tickSpace: number,
  currentSqrtPrice: Decimal
): TransactionInstruction => {
  const data = Buffer.alloc(DataLayout.span);
  DataLayout.encode(
    {
      instruction: TokenSwapInstruction.Initialize,
      nonce,
      curveType,
      fee,
      managerFee,
      tickSpace,
      currentSqrtPrice,
      currentLiquity: new Decimal(0),
      feeGrowthGlobal0: new Decimal(0),
      feeGrowthGlobal1: new Decimal(0),
      managerFeeA: new Decimal(0),
      managerFeeB: new Decimal(0),
    },
    data
  );

  const keys = [
    { pubkey: tokenSwapKey, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: manager, isSigner: false, isWritable: false },
    { pubkey: managerTokenA, isSigner: false, isWritable: false },
    { pubkey: managerTokenB, isSigner: false, isWritable: false },
    { pubkey: swapTokenA, isSigner: false, isWritable: false },
    { pubkey: swapTokenB, isSigner: false, isWritable: false },
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

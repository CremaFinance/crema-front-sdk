import { struct, u8, u32 } from "@solana/buffer-layout";
import type { AccountInfo, PublicKey } from "@solana/web3.js";
import type Decimal from "decimal.js";

import type { Parser } from "../util/layout";
import { decimalU64, decimalU128, publicKey } from "../util/layout";

export const TOKEN_SWAP_ACCOUNT_TYPE = 0;

export interface TokenSwapAccount {
  version: number;
  tokenSwapKey: PublicKey;
  accountType: number;
  isInitialized: number;
  nonce: number;
  tokenProgramId: PublicKey;
  manager: PublicKey;
  managerTokenA: PublicKey;
  managerTokenB: PublicKey;
  swapTokenA: PublicKey;
  swapTokenB: PublicKey;
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  ticksKey: PublicKey;
  positionsKey: PublicKey;
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

export const TokenSwapAccountLayout = struct<TokenSwapAccount>(
  [
    u8("version"),
    publicKey("tokenSwapKey"),
    u8("accountType"),
    u8("isInitialized"),
    u8("nonce"),
    publicKey("tokenProgramId"),
    publicKey("manager"),
    publicKey("managerTokenA"),
    publicKey("managerTokenB"),
    publicKey("swapTokenA"),
    publicKey("swapTokenB"),
    publicKey("tokenAMint"),
    publicKey("tokenBMint"),
    publicKey("ticksKey"),
    publicKey("positionsKey"),
    u8("curveType"),
    decimalU64("fee", 12),
    decimalU64("managerFee", 12),
    u32("tickSpace"),
    decimalU128("currentSqrtPrice", 12),
    decimalU128("currentLiquity"),
    decimalU128("feeGrowthGlobal0", 16),
    decimalU128("feeGrowthGlobal1", 16),
    decimalU128("managerFeeA"),
    decimalU128("managerFeeB"),
  ],
  "tokenSwapAccount"
);

export const TOKEN_SWAP_ACCOUNT_SIZE = TokenSwapAccountLayout.span;

export const isTokenSwapAccount = (info: AccountInfo<Buffer>): boolean => {
  return info.data.readUInt8(33) === TOKEN_SWAP_ACCOUNT_TYPE;
};

export const parseTokenSwapAccount: Parser<TokenSwapAccount> = (
  pubkey: PublicKey,
  info: AccountInfo<Buffer>
) => {
  if (!isTokenSwapAccount(info)) {
    return;
  }

  const buffer = Buffer.from(info.data);
  const tokenSwapAccount = TokenSwapAccountLayout.decode(buffer);

  return {
    pubkey,
    info,
    data: tokenSwapAccount,
  };
};

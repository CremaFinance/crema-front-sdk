import { blob, s32, seq, struct, u8 } from "@solana/buffer-layout";
import type { AccountInfo, PublicKey } from "@solana/web3.js";
import type Decimal from "decimal.js";

import type { Parser } from "../util/layout";
import { decimalU128, publicKey } from "../util/layout";

export const POSITIONS_ACCOUNT_SIZE = 360000;
export const POSITIONS_ACCOUNT_TYPE = 2;

export interface Position {
  nftTokenId: PublicKey;
  lowerTick: number;
  upperTick: number;
  liquity: Decimal;
  feeGrowthInsideALast: Decimal;
  feeGrowthInsideBLast: Decimal;
  tokenAFee: Decimal;
  tokenBFee: Decimal;
}

export interface PositionsAccount {
  swapVersion: number;
  tokenSwapKey: PublicKey;
  accountType: number;
  len: number;
  positions: Position[];
}

/* @internal */
export interface PositionsAccountDataFlat {
  swapVersion: number;
  tokenSwapKey: PublicKey;
  accountType: number;
  len: number;
  dataFlat: Uint8Array;
}

export const PositionLayout = struct<Position>(
  [
    publicKey("nftTokenId"),
    s32("lowerTick"),
    s32("upperTick"),
    decimalU128("liquity"),
    decimalU128("feeGrowthInsideALast", 16),
    decimalU128("feeGrowthInsideBLast", 16),
    decimalU128("tokenAFee", 16),
    decimalU128("tokenBFee", 16),
  ],
  "position"
);

export const PositionsAccountLayout = struct<PositionsAccountDataFlat>(
  [
    u8("swapVersion"),
    publicKey("tokenSwapKey"),
    u8("accountType"),
    s32("len"),
    blob(POSITIONS_ACCOUNT_SIZE - 38, "dataFlat"),
  ],
  "positionsAccount"
);

export const MAX_ACCOUNT_POSITION_LENGTH = Math.floor(
  (POSITIONS_ACCOUNT_SIZE - 38) / PositionLayout.span
);

export const isPositionsAccount = (info: AccountInfo<Buffer>): boolean => {
  return info.data.readUInt8(33) === POSITIONS_ACCOUNT_TYPE;
};

export const parsePositionsAccount: Parser<PositionsAccount> = (
  pubkey: PublicKey,
  info: AccountInfo<Buffer>
) => {
  if (!isPositionsAccount(info)) return;

  const buffer = Buffer.from(info.data);
  const { swapVersion, tokenSwapKey, accountType, len, dataFlat } =
    PositionsAccountLayout.decode(buffer);

  const positionSpan = len * PositionLayout.span;
  const positionsBuffer = dataFlat.slice(0, positionSpan);
  const positions = seq(PositionLayout, len).decode(positionsBuffer);

  const positionsAccount: PositionsAccount = {
    swapVersion,
    tokenSwapKey,
    accountType,
    len,
    positions,
  };

  return {
    pubkey,
    info,
    data: positionsAccount,
  };
};

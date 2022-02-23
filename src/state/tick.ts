import { struct, s32, u8, blob, seq } from "@solana/buffer-layout";
import { decimal128, decimalU128, Parser, publicKey } from "../util/layout";
import Decimal from "decimal.js";
import { AccountInfo, PublicKey } from "@solana/web3.js";

// mainnet-beta
export const TICKS_ACCOUNT_SIZE = 504000;

// devnet
// export const TICKS_ACCOUNT_SIZE = 840000;

export interface Tick {
  tick: number;
  tickPrice: Decimal;
  liquityGross: Decimal;
  liquityNet: Decimal;
  feeGrowthOutside0: Decimal;
  feeGrowthOutside1: Decimal;
}

export interface TicksAccount {
  swapVersion: number;
  tokenSwapKey: PublicKey;
  accountType: number;
  len: number;
  ticks: Tick[];
}

/* @internal */
export interface TicksAccountDataFlat {
  swapVersion: number;
  tokenSwapKey: PublicKey;
  accountType: number;
  len: number;
  dataFlat: Uint8Array;
}

export const TickLayout = struct<Tick>(
  [
    s32("tick"),
    decimalU128("tickPrice", 12),
    decimalU128("liquityGross"),
    decimal128("liquityNet"),
    decimalU128("feeGrowthOutside0", 16),
    decimalU128("feeGrowthOutside1", 16),
  ],
  "tickInfo"
);

export const TicksAccountLayout = struct<TicksAccountDataFlat>(
  [
    u8("swapVersion"),
    publicKey("tokenSwapKey"),
    u8("accountType"),
    s32("len"),
    blob(TICKS_ACCOUNT_SIZE - 38, "dataFlat"),
  ],
  "ticksAccount"
);

export const isTicksAccount = (info: AccountInfo<Buffer>): boolean => {
  return info.data.length === TICKS_ACCOUNT_SIZE;
};

export const parseTicksAccount: Parser<TicksAccount> = (
  pubkey: PublicKey,
  info: AccountInfo<Buffer>
) => {
  if (!isTicksAccount(info)) return;

  const buffer = Buffer.from(info.data);
  const {
    swapVersion,
    tokenSwapKey,
    accountType,
    len,
    dataFlat,
  } = TicksAccountLayout.decode(buffer);

  const tickSpan = len * TickLayout.span;
  const ticksBuffer = dataFlat.slice(0, tickSpan);
  const ticks = seq(TickLayout, len).decode(ticksBuffer);

  const ticksAccount: TicksAccount = {
    swapVersion,
    tokenSwapKey,
    accountType,
    len,
    ticks,
  };

  return {
    pubkey,
    info,
    data: ticksAccount,
  };
};

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  getATAAddress,
  getTokenAccount,
  NATIVE_MINT,
} from "@saberhq/token-utils";
import type { PublicKey } from "@solana/web3.js";
import { printTable } from "console-table-printer";
import Decimal from "decimal.js";
import * as inquire from "inquirer";
import _ from "lodash";
import { exit } from "process";
import invariant from "tiny-invariant";

import { calculateTokenAmount, FIX_TOKEN_B } from "../src";
import { Decode } from "../src/instructions/depositFixToken";
import {
  loadSwapPair,
  printObjectJSON,
  printObjectTable,
  swapPairPositions,
} from ".";

export async function mintPosition({
  pairKey,
  lowerPrice,
  upperPrice,
  amountA,
  amountB,
  slid,
}: {
  pairKey: PublicKey;
  lowerPrice: Decimal;
  upperPrice: Decimal;
  amountA: Decimal | null;
  amountB: Decimal | null;
  slid: Decimal;
}) {
  const swap = await loadSwapPair(pairKey);
  const { lowerTick, upperTick } = swap.calculateEffectivTick(
    lowerPrice,
    upperPrice
  );

  const liquityResult = swap.calculateLiquityWithSlid({
    lowerTick,
    upperTick,
    amountA,
    amountB,
    slid,
  });

  const userTokenA = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenAMint,
    owner: swap.provider.wallet.publicKey,
  });
  const userTokenB = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenBMint,
    owner: swap.provider.wallet.publicKey,
  });

  const res = await swap.mintPosition(
    userTokenA,
    userTokenB,
    lowerTick,
    upperTick,
    liquityResult.liquity,
    liquityResult.maximumAmountA,
    liquityResult.maximumAmountB
  );

  printObjectTable({
    swap: pairKey,
    currentPrice: swap.uiPrice(),
    lowerPrice,
    upperPrice,
    positionId: res.positionId,
    positionAccount: res.positionAccount,
    positionsKey: res.positionsKey,
    desiredAmountA: swap.tokenAAmount(liquityResult.amountA),
    desiredAmountB: swap.tokenBAmount(liquityResult.amountB),
    maximumAmountA: swap.tokenAAmount(liquityResult.maximumAmountA),
    maximumAmountB: swap.tokenBAmount(liquityResult.maximumAmountB),
    minimumAmountA: swap.tokenAAmount(liquityResult.minimumAmountA),
    minimumAmountB: swap.tokenBAmount(liquityResult.minimumAmountB),
  });

  const getConfirm = await inquire.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message:
      "The above table is the position info and the cost expect, confirm it ?",
  });

  if (getConfirm.confirm) {
    const receipt = await res.tx.confirm();
    printObjectJSON({
      signature: receipt.signature.toString(),
      cmpuateUnits: receipt.computeUnits,
      positionInfo: {
        swap: pairKey,
        ..._.omit(res, "tx"),
      },
    });
  } else {
    exit(0);
  }
}

export async function mintPositionFix({
  pairKey,
  lowerPrice,
  upperPrice,
  amountA,
  amountB,
  slid,
  isDebug = true,
}: {
  pairKey: PublicKey;
  lowerPrice: Decimal;
  upperPrice: Decimal;
  amountA: Decimal | null;
  amountB: Decimal | null;
  slid: Decimal;
  isDebug: boolean;
}) {
  const swap = await loadSwapPair(pairKey);
  const { lowerTick, upperTick } = swap.calculateEffectivTick(
    lowerPrice,
    upperPrice
  );

  const userTokenB = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenBMint,
    owner: swap.provider.wallet.publicKey,
  });
  const userTokenA = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenAMint,
    owner: swap.provider.wallet.publicKey,
  });

  let balanceA = new Decimal(0);
  if (swap.tokenSwapInfo.tokenAMint.equals(NATIVE_MINT)) {
    const balanceSOL = await swap.provider.connection.getBalance(
      swap.provider.wallet.publicKey
    );
    balanceA =
      balanceSOL > 1000000 ? new Decimal(balanceSOL - 1000000) : balanceA;
  } else {
    await getTokenAccount(swap.provider, userTokenA)
      .then((resp) => {
        balanceA = new Decimal(resp.amount.toString());
      })
      .catch(() => {
        console.log(
          `You don't hava token account of ${swap.tokenSwapInfo.tokenAMint.toBase58()}`
        );
      });
  }

  let balanceB = new Decimal(0);
  if (swap.tokenSwapInfo.tokenBMint.equals(NATIVE_MINT)) {
    const balanceSOL = await swap.provider.connection.getBalance(
      swap.provider.wallet.publicKey
    );
    balanceB =
      balanceSOL > 1000000 ? new Decimal(balanceSOL - 1000000) : balanceB;
  } else {
    await getTokenAccount(swap.provider, userTokenB)
      .then((resp) => {
        balanceB = new Decimal(resp.amount.toString());
      })
      .catch(() => {
        console.log(
          `You don't hava token account of ${swap.tokenSwapInfo.tokenBMint.toBase58()}`
        );
      });
  }
  if (balanceA.lessThanOrEqualTo(0)) {
    if (isDebug) {
      balanceA = new Decimal(1000000000000000);
    } else {
      throw new Error("Not enough token A");
    }
  }
  if (balanceB.lessThanOrEqualTo(0)) {
    if (isDebug) {
      balanceB = new Decimal(1000000000000000);
    } else {
      throw new Error("Not enough token B");
    }
  }

  const {
    desiredAmountA,
    desiredAmountB,
    maxAmountA,
    maxAmountB,
    desiredDeltaLiquity,
    maxDeltaLiquity,
    fixTokenType,
    slidPrice,
  } = swap.calculateFixSideTokenAmount(
    lowerTick,
    upperTick,
    amountA,
    amountB,
    balanceA,
    balanceB,
    slid
  );

  const res = await swap.mintPositionFixToken(
    userTokenA,
    userTokenB,
    fixTokenType,
    lowerTick,
    upperTick,
    maxAmountA,
    maxAmountB
  );

  printObjectTable({
    swap: pairKey,
    currentPrice: swap.uiPrice(),
    slidPrice,
    lowerPrice,
    upperPrice,
    positionId: res.positionId,
    positionAccount: res.positionAccount,
    positionsKey: res.positionsKey,
    desiredAmountA: swap.tokenAAmount(desiredAmountA),
    maxAmountA: swap.tokenAAmount(maxAmountA),
    desiredAmountB: swap.tokenBAmount(desiredAmountB),
    maxAmountB: swap.tokenBAmount(maxAmountB),
    desiredDeltaLiquity,
    maxDeltaLiquity,
    fixToken: fixTokenType === FIX_TOKEN_B ? "tokenB" : "tokenA",
  });

  const getConfirm = await inquire.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message:
      "The above table is the position info and the cost expect, confirm it ?",
  });

  if (getConfirm.confirm) {
    const receipt = await res.tx.confirm();
    printObjectJSON({
      signature: receipt.signature.toString(),
      cmpuateUnits: receipt.computeUnits,
      positionInfo: {
        swap: pairKey,
        ..._.omit(res, "tx"),
      },
    });
  } else {
    exit(0);
  }
}

export async function increaseLiquity({
  pairKey,
  positionId,
  positionAccount,
  amountA,
  amountB,
  slid,
}: {
  pairKey: PublicKey;
  positionId: PublicKey;
  positionAccount: PublicKey | null;
  amountA: Decimal | null;
  amountB: Decimal | null;
  slid: Decimal;
}) {
  const swap = await loadSwapPair(pairKey);
  const position = swap.getPositionInfo(positionId);
  invariant(position !== undefined, "The position not found");
  const userTokenA = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenAMint,
    owner: swap.provider.wallet.publicKey,
  });
  const userTokenB = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenBMint,
    owner: swap.provider.wallet.publicKey,
  });

  const liquityResult = swap.calculateLiquityWithSlid({
    lowerTick: position.lowerTick,
    upperTick: position.upperTick,
    amountA,
    amountB,
    slid,
  });

  const tx = await swap.increaseLiquity(
    positionId,
    userTokenA,
    userTokenB,
    liquityResult.liquity,
    liquityResult.maximumAmountA,
    liquityResult.maximumAmountB,
    positionAccount
  );

  printObjectTable({
    swap: pairKey,
    positionId: position.positionId,
    currentPrice: swap.uiPrice(),
    lowerPrice: swap.tick2UiPrice(position.lowerTick),
    upperPrice: swap.tick2UiPrice(position.upperTick),
    desiredAmountA: swap.tokenAAmount(liquityResult.amountA),
    desiredAmountB: swap.tokenBAmount(liquityResult.amountB),
    maximumAmountA: swap.tokenAAmount(liquityResult.maximumAmountA),
    maximumAmountB: swap.tokenBAmount(liquityResult.maximumAmountB),
    minimumAmountA: swap.tokenAAmount(liquityResult.minimumAmountA),
    minimumAmountB: swap.tokenBAmount(liquityResult.minimumAmountB),
  });

  const getConfirm = await inquire.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message:
      "The above table is the position info and the cost expect, confirm it ?",
  });

  if (getConfirm.confirm) {
    const receipt = await tx.confirm();
    printObjectJSON({
      signature: receipt.signature.toString(),
      cmpuateUnits: receipt.computeUnits,
      message: "incease liquity success",
    });
  } else {
    exit(0);
  }
}

export async function increaseLiquityFix({
  pairKey,
  positionId,
  positionAccount,
  amountA,
  amountB,
  slid,
}: {
  pairKey: PublicKey;
  positionId: PublicKey;
  positionAccount: PublicKey | null;
  amountA: Decimal | null;
  amountB: Decimal | null;
  slid: Decimal;
}) {
  const swap = await loadSwapPair(pairKey);
  const position = swap.getPositionInfo(positionId);
  invariant(position !== undefined, "The position not found");
  const userTokenA = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenAMint,
    owner: swap.provider.wallet.publicKey,
  });
  const userTokenB = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenBMint,
    owner: swap.provider.wallet.publicKey,
  });
  const userTokenAInfo = await getTokenAccount(swap.provider, userTokenA);
  const userTokenBInfo = await getTokenAccount(swap.provider, userTokenB);

  const {
    desiredAmountA,
    desiredAmountB,
    maxAmountA,
    maxAmountB,
    desiredDeltaLiquity,
    maxDeltaLiquity,
    fixTokenType,
    slidPrice,
  } = swap.calculateFixSideTokenAmount(
    position.lowerTick,
    position.upperTick,
    amountA,
    amountB,
    new Decimal(userTokenAInfo.amount.toString()),
    new Decimal(userTokenBInfo.amount.toString()),
    slid
  );

  const tx = await swap.increaseLiquityFixToken(
    positionId,
    userTokenA,
    userTokenB,
    fixTokenType,
    maxAmountA,
    maxAmountB,
    positionAccount
  );

  printObjectTable({
    swap: pairKey,
    positionId: position.positionId,
    currentPrice: swap.uiPrice(),
    slidPrice,
    lowerPrice: swap.tick2UiPrice(position.lowerTick),
    upperPrice: swap.tick2UiPrice(position.upperTick),
    desiredAmountA: swap.tokenAAmount(desiredAmountA),
    maxAmountA: swap.tokenAAmount(maxAmountA),
    desiredAmountB: swap.tokenBAmount(desiredAmountB),
    maxAmountB: swap.tokenBAmount(maxAmountB),
    desiredDeltaLiquity,
    maxDeltaLiquity,
    fixToken: fixTokenType === FIX_TOKEN_B ? "tokenB" : "tokenA",
  });

  const getConfirm = await inquire.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message:
      "The above table is the position info and the cost expect, confirm it ?",
  });

  if (getConfirm.confirm) {
    const receipt = await tx.confirm();
    printObjectJSON({
      signature: receipt.signature.toString(),
      cmpuateUnits: receipt.computeUnits,
      message: "incease liquity success",
    });
  } else {
    exit(0);
  }
}

export async function decreaseLiquity({
  pairKey,
  positionId,
  positionAccount,
  percent,
  slid,
}: {
  pairKey: PublicKey;
  positionId: PublicKey;
  positionAccount: PublicKey | null;
  percent: Decimal;
  slid: Decimal;
}) {
  invariant(
    percent.greaterThan(0) && percent.lessThanOrEqualTo(1),
    `Invalid pencentage:${percent.toString()}`
  );
  const swap = await loadSwapPair(pairKey);
  const position = swap.getPositionInfo(positionId);
  invariant(position !== undefined, "The position not found");

  const positionValue = swap.calculatePositionValueWithSlid(
    positionId,
    percent,
    slid
  );

  const tx = await swap.decreaseLiquityAtomic(
    positionId,
    positionValue.liquity,
    positionValue.minAmountA,
    positionValue.minAmountB,
    positionAccount
  );

  printObjectTable({
    swap: pairKey,
    positionId: position.positionId,
    currentPrice: swap.uiPrice(),
    lowerPrice: swap.tick2UiPrice(position.lowerTick),
    upperPrice: swap.tick2UiPrice(position.upperTick),
    amountA: swap.tokenAAmount(positionValue.amountA),
    amountB: swap.tokenBAmount(positionValue.amountB),
    maximumAmountA: swap.tokenAAmount(positionValue.maxAmountA),
    maximumAmountB: swap.tokenBAmount(positionValue.maxAmountB),
    minimumAmountA: swap.tokenAAmount(positionValue.minAmountA),
    minimumAmountB: swap.tokenBAmount(positionValue.minAmountB),
  });

  const getConfirm = await inquire.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message:
      "The above table is the position info and expect token you will receive, confirm it ?",
  });

  if (getConfirm.confirm) {
    const receipt = await tx.confirm();
    printObjectJSON({
      signature: receipt.signature.toString(),
      cmpuateUnits: receipt.computeUnits,
      message: "decrease liquity success",
    });
  } else {
    exit(0);
  }
}

export async function fetchPostions({
  pairKey,
  owner,
}: {
  pairKey: PublicKey;
  owner: PublicKey | undefined | null;
}) {
  const swap = await loadSwapPair(pairKey);

  if (owner === undefined) {
    const positions = swapPairPositions(swap);
    printTable(positions);
  } else {
    owner = owner !== null ? owner : swap.provider.wallet.publicKey;
    const positions = await swap.getUserPositions(owner);
    const list: any[] = [];
    positions.forEach((v) => {
      const amount = calculateTokenAmount(
        v.lowerTick,
        v.upperTick,
        v.liquity,
        swap.tokenSwapInfo.currentSqrtPrice
      );
      list.push({
        ...v,
        amountA: swap.tokenAAmount(amount.amountA),
        amountB: swap.tokenBAmount(amount.amountB),
      });
    });
    printTable(list);
  }
}

export async function claim({
  pairKey,
  positionId,
}: {
  pairKey: PublicKey;
  positionId: PublicKey;
}) {
  const swap = await loadSwapPair(pairKey);
  const feeAmount = swap.preClaim(positionId);

  const tx = await swap.claimAtomic(positionId, positionId);

  printObjectTable({
    pendingFeeA: swap.tokenAAmount(feeAmount.amountA),
    pendingFeeB: swap.tokenBAmount(feeAmount.amountB),
  });

  const getConfirm = await inquire.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message:
      "The above table is the expect  pending fee you will receive, claim it ?",
  });

  if (getConfirm.confirm) {
    const receipt = await tx.confirm();
    printObjectJSON({
      signature: receipt.signature.toString(),
      cmpuateUnits: receipt.computeUnits,
      message: "claim fee success",
    });
  } else {
    exit(0);
  }
}

export async function fetchPostion({
  pairKey,
  positionId,
}: {
  pairKey: PublicKey;
  positionId: PublicKey;
}) {
  const swap = await loadSwapPair(pairKey);
  const position = swap.getPositionInfo(positionId);
  if (position === undefined) {
    console.log(`The position:${positionId.toBase58()} not found`);
    exit(0);
  }
  const amount = calculateTokenAmount(
    position.lowerTick,
    position.upperTick,
    position.liquity,
    swap.tokenSwapInfo.currentSqrtPrice
  );
  const feeAmount = swap.preClaim(positionId);

  printObjectTable({
    ...position,
    amountA: swap.tokenAAmount(amount.amountA),
    amountB: swap.tokenBAmount(amount.amountB),
    pendingFeeA: swap.tokenAAmount(feeAmount.amountA),
    pendingFeeB: swap.tokenBAmount(feeAmount.amountB),
  });
}

export function decodeDepositFixTokenLayout() {
  const buffer = Buffer.from([
    0x09, 0x00, 0x01, 0x2a, 0x01, 0x00, 0x00, 0x00, 0x03, 0x00, 0x00, 0x19,
    0x28, 0x30, 0x25, 0x01, 0x00, 0x00, 0x00, 0x00, 0x30, 0x1a, 0x1e, 0x01,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  const data = Decode(buffer);
  printObjectTable(data);
}

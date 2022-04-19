import { getATAAddress } from "@saberhq/token-utils";
import type { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import * as inquire from "inquirer";

import { SWAP_A2B, SWAP_B2A } from "../src";
import { loadSwapPair, printObjectJSON, printObjectTable } from ".";

export async function swapA2B({
  pairKey,
  amount,
  slid,
}: {
  pairKey: PublicKey;
  amount: Decimal;
  slid: Decimal;
}) {
  const swap = await loadSwapPair(pairKey);
  const lamports = swap.tokenALamports(amount);
  const fromATA = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenAMint,
    owner: swap.provider.wallet.publicKey,
  });
  const toATA = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenBMint,
    owner: swap.provider.wallet.publicKey,
  });
  const estimateResult = swap.preSwapA(lamports);
  printObjectTable({
    from: swap.tokenSwapInfo.tokenAMint,
    to: swap.tokenSwapInfo.tokenBMint,
    fromATA,
    toATA,
    amountOut: swap.tokenBAmount(estimateResult.amountOut),
    slid: slid,
    minAmountOut: swap.tokenBAmount(
      estimateResult.amountOut.div(slid.add(new Decimal(1)))
    ),
    amountUsed: swap.tokenAAmount(estimateResult.amountUsed),
    feeUsed: swap.tokenAAmount(estimateResult.feeUsed),
    afterLiquity: estimateResult.afterLiquity,
    impactA: estimateResult.impactA,
    impactB: estimateResult.impactB,
    transactionPriceA: estimateResult.transactionPriceA,
    transactionPriceB: estimateResult.transactionPriceB,
    afterPriceA: estimateResult.afterPriceA,
    afterPriceB: estimateResult.afterPriceB,
  });

  const getConfirm = await inquire.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message: "The above table is the emtimate swap result, confirm it ?",
  });
  if (getConfirm.confirm) {
    const minIncome = estimateResult.amountOut.div(new Decimal(1).add(slid));
    const res = await swap.swapAotmic(SWAP_A2B, lamports, minIncome);
    const receipt = await res.confirm();
    printObjectJSON({
      signature: receipt.signature.toString(),
      cmpuateUnits: receipt.computeUnits,
    });
  }
}

export async function swapB2A({
  pairKey,
  amount,
  slid,
}: {
  pairKey: PublicKey;
  amount: Decimal;
  slid: Decimal;
}) {
  const swap = await loadSwapPair(pairKey);
  const lamports = swap.tokenBLamports(amount);
  const fromATA = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenBMint,
    owner: swap.provider.wallet.publicKey,
  });
  const toATA = await getATAAddress({
    mint: swap.tokenSwapInfo.tokenAMint,
    owner: swap.provider.wallet.publicKey,
  });
  const estimateResult = swap.preSwapB(lamports);
  printObjectTable({
    outTokenMint: swap.tokenSwapInfo.tokenBMint,
    inTokenMint: swap.tokenSwapInfo.tokenAMint,
    toATA,
    fromATA,
    amountOut: swap.tokenAAmount(estimateResult.amountOut),
    slid: slid,
    minAmountOut: swap.tokenAAmount(
      estimateResult.amountOut.div(slid.add(new Decimal(1)))
    ),
    amountUsed: swap.tokenBAmount(estimateResult.amountUsed),
    feeUsed: swap.tokenBAmount(estimateResult.feeUsed),
    afterLiquity: estimateResult.afterLiquity,
    impactA: estimateResult.impactA,
    impactB: estimateResult.impactB,
    transactionPriceA: estimateResult.transactionPriceA,
    transactionPriceB: estimateResult.transactionPriceB,
    afterPriceA: estimateResult.afterPriceA,
    afterPriceB: estimateResult.afterPriceB,
  });

  const getConfirm = await inquire.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message: "The above table is the estimate swap result, confirm it ?",
  });
  if (getConfirm.confirm) {
    const minIncome = estimateResult.amountOut.div(new Decimal(1).add(slid));
    const res = await swap.swapAotmic(SWAP_B2A, lamports, minIncome);
    const receipt = await res.confirm();
    printObjectJSON({
      signature: receipt.signature.toString(),
      cmpuateUnits: receipt.computeUnits,
    });
  }
}

export async function simulateSwap({
  pairKey,
  amount,
  direct,
}: {
  pairKey: PublicKey;
  amount: Decimal;
  direct: number;
}) {
  const swap = await loadSwapPair(pairKey);
  const lamports = swap.tokenBLamports(amount);
  const estimateResult =
    direct === SWAP_A2B ? swap.preSwapA(lamports) : swap.preSwapB(lamports);
  console.log("The location estimate swap reuslt(with decimals)");
  printObjectTable({
    ...estimateResult,
  });
  console.log("The simulate swap result");
  await swap.simulateSwap(lamports, direct);
}

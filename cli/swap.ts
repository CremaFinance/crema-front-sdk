import { getATAAddress } from "@saberhq/token-utils";
import type { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";
import * as inquire from "inquirer";

import { SWAP_A2B, SWAP_B2A } from "../src/";
import { loadSwapPair, pairName } from "./pair";
import { mustGetTokenInfo, printObjectJSON, printObjectTable } from "./utils";

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
    pair: pairName(
      swap.tokenSwapInfo.tokenAMint,
      swap.tokenSwapInfo.tokenBMint
    ),
    from: `${
      mustGetTokenInfo(swap.tokenSwapInfo.tokenAMint).symbol
    } | ${swap.tokenSwapInfo.tokenAMint.toBase58()}`,
    to: `${
      mustGetTokenInfo(swap.tokenSwapInfo.tokenBMint).symbol
    } | ${swap.tokenSwapInfo.tokenBMint.toBase58()}`,
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
    revert: estimateResult.revert,
    revertReason: estimateResult.revertReason,
  });

  const getConfirm = await inquire.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message: "The above table is the emtimate swap result, confirm it ?",
  });
  if (getConfirm.confirm) {
    const minIncome = estimateResult.amountOut.div(new Decimal(1).add(slid));
    const res = await swap.swap(fromATA, toATA, SWAP_A2B, lamports, minIncome);
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
    pair: pairName(
      swap.tokenSwapInfo.tokenAMint,
      swap.tokenSwapInfo.tokenBMint
    ),
    from: `${
      mustGetTokenInfo(swap.tokenSwapInfo.tokenBMint).symbol
    } | ${swap.tokenSwapInfo.tokenBMint.toBase58()}`,
    to: `${
      mustGetTokenInfo(swap.tokenSwapInfo.tokenAMint).symbol
    } | ${swap.tokenSwapInfo.tokenAMint.toBase58()}`,
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
    revert: estimateResult.revert,
    revertReason: estimateResult.revertReason,
  });

  const getConfirm = await inquire.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message: "The above table is the estimate swap result, confirm it ?",
  });
  if (getConfirm.confirm) {
    const minIncome = estimateResult.amountOut.div(new Decimal(1).add(slid));
    const res = await swap.swap(fromATA, toATA, SWAP_B2A, lamports, minIncome);
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
    pair: pairName(
      swap.tokenSwapInfo.tokenAMint,
      swap.tokenSwapInfo.tokenBMint
    ),
    ...estimateResult,
  });
  console.log("The simulate swap result");
  await swap.simulateSwap(lamports, direct);
}

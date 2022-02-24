import { Connection, PublicKey } from "@solana/web3.js";
import { TokenSwap } from "../src/tokenSwap";
import { Decimal } from "decimal.js";
import { url } from "./url";

async function main() {
  let conn = new Connection(url, "recent");
  let programID = new PublicKey("6MLxLqiXaaSUpkgMnWDTuejNZEz3kE7k2woyHGVFw319");
  let swapKey = new PublicKey("FESPUeMZLHPGqQvpyJe2QCbNmqCtYPEr1fw2oUDGJN9Z");

  //let swapKey = new PublicKey("8J3avAjuRfL2CYFKKDwhhceiRoajhrHv9kN5nUiEnuBG");
  let swap = await new TokenSwap(conn, programID, swapKey, null).load();
  let amountIn = new Decimal(1000000_000_000);
  let res = swap.preSwapB(amountIn);

  console.log("SWAP A");
  console.log(
    "currentSqrtPrice   :",
    swap.tokenSwapInfo.currentSqrtPrice.toString()
  );
  console.log("tokenAMint         :", swap.tokenSwapInfo.tokenAMint.toBase58());
  console.log("tokenBMint         :", swap.tokenSwapInfo.tokenBMint.toBase58());
  console.log("swapTokenA         :", swap.tokenSwapInfo.swapTokenA.toBase58());
  console.log("swapTokenB         :", swap.tokenSwapInfo.swapTokenB.toBase58());
  console.log("feeRate            :", swap.tokenSwapInfo.fee.toString());
  console.log(
    "amountIn           :",
    res.amountUsed
      .div(1000000)
      .toFixed(10)
      .toString()
  );
  console.log(
    "amountOut          :",
    res.amountOut
      .div(1000000)
      .toFixed(10)
      .toString()
  );
  console.log("afterLiquity       :", res.afterLiquity.toString());
  console.log(
    "currentPriceA      :",
    swap.tokenSwapInfo.currentSqrtPrice.pow(2)
  );
  console.log(
    "currentPriceB      :",
    new Decimal(1).div(swap.tokenSwapInfo.currentSqrtPrice.pow(2)).toString()
  );
  console.log("transactionPriceA  :", res.transactionPriceA.toString());
  console.log("transactionPriceB  :", res.transactionPriceB.toString());
  console.log("afterPriceA        :", res.afterPriceA.toString());
  console.log("afterPriceB        :", res.afterPriceB.toString());
  console.log(
    "impactA            :",
    res.impactA
      .mul(100)
      .toDecimalPlaces(6)
      .toString(),
    "%"
  );
  console.log(
    "impactB            :",
    res.impactB
      .mul(100)
      .toDecimalPlaces(6)
      .toString(),
    "%"
  );
  console.log(
    "deltaLiquity       :",
    swap.tokenSwapInfo.currentLiquity.sub(res.afterLiquity).toString()
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  })
  .then(() => process.exit());

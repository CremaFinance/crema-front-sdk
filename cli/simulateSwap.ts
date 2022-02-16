import { Connection, PublicKey } from "@solana/web3.js";
import { TokenSwap } from "../src/tokenSwap";
import { Decimal } from "decimal.js";
import { KPFromFile } from "./utils";

async function main() {
  let url = "https://mercurial.rpcpool.com";
  let conn = new Connection(url, "recent");

  let programID = new PublicKey("6MLxLqiXaaSUpkgMnWDTuejNZEz3kE7k2woyHGVFw319");
  let swapKey = new PublicKey("8J3avAjuRfL2CYFKKDwhhceiRoajhrHv9kN5nUiEnuBG"); //CUSDT-CUSDC
  let payer = KPFromFile("./.secret");

  let swap = await new TokenSwap(conn, programID, swapKey, null).load();

  await swap.simulateSwap(new Decimal("1000000000000000000"), 1, payer);
  let res = swap.preSwapB(new Decimal("1000000000000000000"));

  console.log("USDT->USDC");
  console.log(
    "amountOut          :",
    res.amountOut.div(new Decimal("1000000")).toString()
  );
  console.log("-----------------------------------------");
  console.log(
    "currentSqrtPrice   :",
    swap.tokenSwapInfo.currentSqrtPrice.toString()
  );
  console.log("fee                :", swap.tokenSwapInfo.fee.toString());
  console.log(
    "amountUsed         :",
    res.amountUsed
      .toDP(0, Decimal.ROUND_DOWN)
      .div(1000000)
      .toString()
  );
  console.log(
    "feeUsed            :",
    res.feeUsed
      .toDP(0, Decimal.ROUND_DOWN)
      .div(1000000)
      .toString()
  );
  console.log("afterPrice         :", res.afterPrice.toString());
  console.log("afterLiquity       :", res.afterLiquity.toString());
  console.log(
    "deltaLiquity       :",
    swap.tokenSwapInfo.currentLiquity.sub(res.afterLiquity).toString()
  );
  console.log("------------------------------------------");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  })
  .then(() => process.exit());

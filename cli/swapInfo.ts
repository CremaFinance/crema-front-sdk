import { Connection, PublicKey } from "@solana/web3.js";
import { TokenSwap } from "../src/tokenSwap";
import { url } from "./url";

async function main() {
  let conn = new Connection(url, "recent");

  // devnet
  let programID = new PublicKey("6MLxLqiXaaSUpkgMnWDTuejNZEz3kE7k2woyHGVFw319");
  let swapKey = new PublicKey("FESPUeMZLHPGqQvpyJe2QCbNmqCtYPEr1fw2oUDGJN9Z");

  // mainnet-beta
  // let programID = new PublicKey("6MLxLqiXaaSUpkgMnWDTuejNZEz3kE7k2woyHGVFw319")
  // let swapKey = new PublicKey("8J3avAjuRfL2CYFKKDwhhceiRoajhrHv9kN5nUiEnuBG")

  let swap = await new TokenSwap(conn, programID, swapKey, null).load();

  swap.log();

  //console.log(swap.tokenSwapInfo.currentSqrtPrice.toString())
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  })
  .then(() => process.exit());

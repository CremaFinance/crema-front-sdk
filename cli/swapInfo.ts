import { Connection, PublicKey } from "@solana/web3.js";
import { TokenSwap } from "../src/tokenSwap";
import { url } from "./url";

async function main() {
  //let url = "https://connect.runnode.com/?apikey=cNPK9vJTf6ynARvcPaav"
  //let url = "https://mercurial.rpcpool.com"
  let conn = new Connection(url, "recent");

  // devnet
  let programID = new PublicKey("8vd36jeJ3R29TwQetKrwrv174PscM4NL5HFrrNxHgN3R");
  let swapKey = new PublicKey("YyCRh1kpAjGMXzxuAbgDHeV1GUNjS1MnQ2HT44y9LgC");

  // mainnet-beta
  // let programID = new PublicKey("6MLxLqiXaaSUpkgMnWDTuejNZEz3kE7k2woyHGVFw319")
  // let swapKey = new PublicKey("8J3avAjuRfL2CYFKKDwhhceiRoajhrHv9kN5nUiEnuBG")

  await new TokenSwap(conn, programID, swapKey, null).load();

  //console.log(swap.tokenSwapInfo.currentSqrtPrice.toString())
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  })
  .then(() => process.exit());

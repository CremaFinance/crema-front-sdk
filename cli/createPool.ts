import { Connection, PublicKey } from "@solana/web3.js";
import { TokenSwap } from "../src/tokenSwap";
import { Decimal } from "decimal.js";
import { url } from "./url";
import { KPFromFile } from "./utils";

async function main() {
  let conn = new Connection(url, "recent");
  let program_id = new PublicKey(
    "8vd36jeJ3R29TwQetKrwrv174PscM4NL5HFrrNxHgN3R"
  );
  let tokenAMint = new PublicKey(
    "Gcu9zjxrjez4xWGj8bi2gTLXYN8hD8Avu2tN8xfnV65Q"
  );
  let tokenBMint = new PublicKey(
    "GHStiPQDe4HEQxtDzyFFuNjP6Z6GqYhbPqJ6oiRFmGWT"
  );
  let fee = new Decimal(0.0001);
  let initializePrice = new Decimal(1);
  let managerFee = new Decimal(0.005);
  let tickSpace = 10;
  let payer = KPFromFile("./.secret");

  let res = await TokenSwap.createTokenSwap(
    conn,
    program_id,
    tokenAMint,
    tokenBMint,
    payer.publicKey,
    fee,
    managerFee,
    tickSpace,
    initializePrice,
    payer
  );
  res.log();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(-1);
  })
  .then(() => process.exit());

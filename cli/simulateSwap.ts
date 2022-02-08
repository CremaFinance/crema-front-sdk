import { Connection, PublicKey } from '@solana/web3.js';
import { TokenSwap } from "../src/tokenSwap";
import { Decimal } from "decimal.js"
import { KPFromFile } from "./utils"
// import { url } from "../src/util/url"


async function main() {
    let url = "https://mercurial.rpcpool.com"
    let conn = new Connection(url, 'recent')

    // devnet
    // let programID = new PublicKey("8vd36jeJ3R29TwQetKrwrv174PscM4NL5HFrrNxHgN3R")
    // let swapKey = new PublicKey("YyCRh1kpAjGMXzxuAbgDHeV1GUNjS1MnQ2HT44y9LgC")

    let programID = new PublicKey('6MLxLqiXaaSUpkgMnWDTuejNZEz3kE7k2woyHGVFw319');
    //let swapKey = new PublicKey('8BHKY3e1N2EmH89yXuxhYhd2aP2Ex5xhoZUJ4eUTsekY'); //CUSDT-CUSDC
    let swapKey = new PublicKey('8J3avAjuRfL2CYFKKDwhhceiRoajhrHv9kN5nUiEnuBG'); //CUSDT-CUSDC
    let payer = KPFromFile("./.secret")

    let swap = await new TokenSwap(conn, programID, swapKey, null).load()

    //await swap.simulateSwap(new Decimal(212229_000000), 0, payer)
    //let res = swap.preSwapA(new Decimal(212229_000000))

    await swap.simulateSwap(new Decimal(10000_000000), 1, payer)
    let res = swap.preSwapB(new Decimal(10000_000000))

    console.log("USDT->USDC")
    console.log("amountOut          :", res.amountOut.toString())
    console.log("-----------------------------------------")
    console.log("currentSqrtPrice   :", swap.tokenSwapInfo.currentSqrtPrice.toString())
    console.log("fee                :", swap.tokenSwapInfo.fee.toString())
    console.log("amountUsed         :", res.amountUsed.toDP(0, Decimal.ROUND_DOWN).div(1000000).toString())
    console.log("feeUsed            :", res.feeUsed.toDP(0, Decimal.ROUND_DOWN).div(1000000).toString())
    console.log("afterPrice         :", res.afterPrice.toString())
    console.log("afterLiquity       :", res.afterLiquity.toString())
    console.log("deltaLiquity       :", swap.tokenSwapInfo.currentLiquity.sub(res.afterLiquity).toString())
    console.log("------------------------------------------")
}

main().catch(err => {
    console.error(err);
    process.exit(-1);
}).then(() => process.exit());

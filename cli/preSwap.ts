import { Connection, PublicKey } from '@solana/web3.js';
import { TokenSwap } from "../src/tokenSwap";
import { Decimal } from "decimal.js"
import { url } from "../src/util/url"

async function main() {
    let conn = new Connection(url, 'recent')
    let programID = new PublicKey("6MLxLqiXaaSUpkgMnWDTuejNZEz3kE7k2woyHGVFw319")
    let swapKey = new PublicKey("8BHKY3e1N2EmH89yXuxhYhd2aP2Ex5xhoZUJ4eUTsekY")

    let swap = await new TokenSwap(conn, programID, swapKey, null).load()

    let res = swap.preSwapA(new Decimal(10_0000_0000))

    console.log("USDT->USDC")
    console.log("currentSqrtPrice   :", swap.tokenSwapInfo.currentSqrtPrice.toString())
    console.log("tokenAMint         :", swap.tokenSwapInfo.tokenAMint.toBase58())
    console.log("tokenBMint         :", swap.tokenSwapInfo.tokenBMint.toBase58())
    console.log("fee                :", swap.tokenSwapInfo.fee.toString())
    console.log("amountIn           :", res.amountUsed.div(1000000).toFixed(10).toString())
    console.log("amountOut          :", res.amountOut.div(1000000).toFixed(10).toString())
    console.log("afterPrice         :", res.afterPrice.toString())
    console.log("afterLiquity       :", res.afterLiquity.toString())
    console.log("deltaLiquity       :", swap.tokenSwapInfo.currentLiquity.sub(res.afterLiquity).toString())
}

main().catch(err => {
    console.error(err);
    process.exit(-1);
}).then(() => process.exit());

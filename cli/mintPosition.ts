import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { TokenSwap } from "../src/tokenSwap";
import { Decimal } from "decimal.js";
import { url } from "./url";
import { KPFromFile } from "./utils";

async function main() {
    let conn = new Connection(url, "recent");
    let programID = new PublicKey("8vd36jeJ3R29TwQetKrwrv174PscM4NL5HFrrNxHgN3R");
    let swapKey = new PublicKey("YyCRh1kpAjGMXzxuAbgDHeV1GUNjS1MnQ2HT44y9LgC");
    let payer = KPFromFile("./.secret");
    let userTokenA = new PublicKey(
        "5z92F2YZDdVzXuwEVh8FfpCS4LPwo6UyvTuVmiVv32WX"
    );
    let userTokenB = new PublicKey(
        "7RnbD9Nk14ZeT1h3KrfagF45eHaHZespssxdNpWbrd4i"
    );

    let swap = await new TokenSwap(conn, programID, swapKey, payer).load();
    swap.log();

    let tickLower = swap.getNearestTickByPrice(new Decimal(0.9));
    let tickUpper = swap.getNearestTickByPrice(new Decimal(1.1));
    let desiredAmountA = new Decimal(2000_00000000);
    let { desiredAmountB, liquity } = swap.calculateLiquityByTokenA(
        tickLower,
        tickUpper,
        desiredAmountA
    );
    let maximumAmountA = desiredAmountA.mul(1.2);
    let maximumAmountB = desiredAmountB.mul(1.2);
    let transferAuthority = new Keypair();
    if (maximumAmountA.greaterThan(0)) {
        await swap.approve(
            userTokenA,
            swap.tokenSwapInfo.tokenAMint,
            maximumAmountA,
            transferAuthority
        );
    }
    if (maximumAmountB.greaterThan(0)) {
        await swap.approve(
            userTokenB,
            swap.tokenSwapInfo.tokenBMint,
            maximumAmountB,
            transferAuthority
        );
    }
    console.log({
        tickLower: tickLower.toString(),
        tickUpper: tickUpper.toString(),
        userTokenA: userTokenA.toString(),
        userTokenB: userTokenB.toString(),
        maximumAmountA: maximumAmountA.toString(),
        maximumAmountB: maximumAmountB.toString(),
    });
    let tx = await swap.mintPosition(
        userTokenA,
        userTokenB,
        tickLower,
        tickUpper,
        liquity,
        maximumAmountA,
        maximumAmountB,
        transferAuthority
    );
    if (tx != null) {
        console.log(tx);
    }
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(-1);
    })
    .then(() => process.exit());

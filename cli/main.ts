import { url } from "../src/util/url";
import { getTokenAccount } from "../src/util";
import { Connection, PublicKey, Keypair, VOTE_PROGRAM_ID } from '@solana/web3.js';
import { TokenSwap } from "../src/tokenSwap";
import { USER_TOKEN_A, createTokenSwap, PROGRAM_ID, TOKEN_SWAP_KEY, PAYER, mintPosition, increaseLiquity, decreaseLiquity, swap as exchange, swap } from "./tokenSwapTest"
import { tokenToString } from "typescript";
import { maxAmountA, maxAmountB, price2Tick, swapA2B, swapB2A, calculateSwapA2B, calculateSwapB2A, calculateLiquity, calculateLiquityTable } from '../src/math'
import Decimal from 'decimal.js'
import { Tick } from '../src/state'

/* token swap
{
    "programId": "5Pj7hESxMKuoZGztQL5Ab3KtDsGsKL5MxkypY4k7PeFE",
    "tokenSwapKey": "2xiK9cKwamxfhyUwJPoSEN3pihdnK9NZ7Svos96fnBEE",
    "payer": "3rWRocctCZ3CZZb31zQ5C9rrJNnPCqMWYS2ujpUyDkCn",
    "authority": "4MnxvUFWrdCsmstkiaLBwemoFg6FEYHq3N79okFJpk3p",
    "tokenSwapInfo": {
        "accountType": 239,
        "version": 0,
        "isInitialized": 1,
        "nonce": 253,
        "manager": "3rWRocctCZ3CZZb31zQ5C9rrJNnPCqMWYS2ujpUyDkCn",
        "managerTokenA": "Gwv36X1tA3bzJNi8zdznBHVhaUcJNAzMCDkPNoctDJCu",
        "managerTokenB": "D5H3s2SAKQjLZQRFPNVxCAy7MK8svvAJcJ3VvXnbZvhc",
        "swapTokenA": "HadEmfjUNa4YAPCBzQQs1EdPxScfh8edL1W6mmUnx5pC",
        "swapTokenB": "CV1UAmKPMN5XSS1y41ruxervCRYbpG9pEYLjM9JPATkE",
        "tokenAMint": "5smfGJccdpeetdReFzX8qTvvxRAQMy64swym8DSPhvRp",
        "tokenBMint": "6LtDq6wKa1a585os9xxFrVdpWWNGxG37K9dxe6en8mTn",
        "ticksKey": "HXQxrfNb9daQ6fHxs6XvXRsLhQsuMBP7T6UcypqM3TA6",
        "positionsKey": "ktZ2kFucvX88G18airJMvQBeAjCuUnj8krbeQhGzTkr",
        "curveType": 0,
        "fee": "0.05",
        "managerFee": "0.005",
        "tickSpace": 60,
        "currentSqrtPrice": "1",
        "currentLiquity": "0",
        "feeGrowthGlobal0": "0",
        "feeGrowthGlobal1": "0",
        "managerFeeA": "0",
        "managerFeeB": "0"
    },
    "positions": {
        "ktZ2kFucvX88G18airJMvQBeAjCuUnj8krbeQhGzTkr": []
    },
    "ticks": []
}
*/


async function main() {
    let conn = new Connection(url, 'recent')

    // create a token swap
    //let tokenSwap = await createTokenSwap(conn)
    //if (tokenSwap !== null) {
    //    tokenSwap.log()
    //}

    let swap = await new TokenSwap(conn, PROGRAM_ID, TOKEN_SWAP_KEY, PAYER).load()
    //swap.log()

    let positions = await swap.getUserPositions()
    console.log(positions)


    // mint positons
    //await mintPosition(swap);
    //(await swap.load()).log();

    // increase positons
    //await increaseLiquity(swap, new PublicKey("DiwRvwyquMT6r6iXfCTBU1oTaX3a6wkahNt6fjn5KWCB"));
    //(await swap.load()).log()

    // decrease positons
    //await decreaseLiquity(swap, new PublicKey("DiwRvwyquMT6r6iXfCTBU1oTaX3a6wkahNt6fjn5KWCB"));
    //(await swap.load()).log()

    // swap
    //await exchange(swap);
    //(await swap.load()).log()

    //let userTokenA = await getTokenAccount(conn, USER_TOKEN_A)

    //console.log(userTokenA)

    //math()
}

function math() {
    //let amountA = maxAmountA(new Decimal(0.5), new Decimal(2.5), new Decimal(10))
    //let amountB = maxAmountB(new Decimal(0.5), new Decimal(2.5), new Decimal(10))
    //console.log(amountA, amountB)
    //
    //console.log(swapA2B(new Decimal(0.5), new Decimal(2.5), new Decimal(10), new Decimal(6)))
    //console.log(swapB2A(new Decimal(0.5), new Decimal(2.5), new Decimal(10), new Decimal(5)))
    //console.log(swapB2A(new Decimal(0.5), new Decimal(2.5), new Decimal(10), new Decimal(8.6)))
    //console.log(swapB2A(new Decimal(0.5), new Decimal(2.5), new Decimal(10), new Decimal(12.32)))
    //console.log(swapA2B(new Decimal(0.5), new Decimal(2.5), new Decimal(10), new Decimal(1.77)))
    //console.log(swapB2A(new Decimal(0.5), new Decimal(2.5), new Decimal(10), new Decimal(8.96)))

    let positions = [
        {
            lowerPrice: new Decimal(0.48),
            upperPrice: new Decimal(5.22),
            liquity: new Decimal(500).sqrt()
        },
        {
            lowerPrice: new Decimal(5.87),
            upperPrice: new Decimal(11.18),
            liquity: new Decimal(396.5).sqrt()
        }
    ]

    let ticks: Tick[] = [
        {
            tick: price2Tick(positions[0].lowerPrice),
            tickPrice: positions[0].lowerPrice,
            liquityGross: positions[0].liquity,
            liquityNet: positions[0].liquity,
            feeGrowthOutside0: new Decimal(0),
            feeGrowthOutside1: new Decimal(0),
        },
        {

            tick: price2Tick(positions[0].upperPrice),
            tickPrice: positions[0].upperPrice,
            liquityGross: positions[0].liquity,
            liquityNet: positions[0].liquity.neg(),
            feeGrowthOutside0: new Decimal(0),
            feeGrowthOutside1: new Decimal(0),
        },
        {
            tick: price2Tick(positions[1].lowerPrice),
            tickPrice: positions[1].lowerPrice,
            liquityGross: positions[1].liquity,
            liquityNet: positions[1].liquity,
            feeGrowthOutside0: new Decimal(0),
            feeGrowthOutside1: new Decimal(0),
        },
        {

            tick: price2Tick(positions[1].upperPrice),
            tickPrice: positions[1].upperPrice,
            liquityGross: positions[1].liquity,
            liquityNet: positions[1].liquity.neg(),
            feeGrowthOutside0: new Decimal(0),
            feeGrowthOutside1: new Decimal(0),
        }
    ]


    let liquity = positions[0].liquity
    let pc = new Decimal(2.9)
    let fee = new Decimal(0.03)
    let amountIn = new Decimal(100)
    console.log(ticks)
    let currentSqrtPrice = (pc).sqrt()
    if (pc.lessThan(positions[0].lowerPrice) || pc.greaterThan(positions[positions.length - 1].upperPrice)) {
        liquity = new Decimal(0)
    }

    let table = calculateLiquityTable(ticks)
    console.log(table)

    //let res = calculateSwapB2A(ticks, currentSqrtPrice, fee, liquity, amountIn)
    //console.log(res)
    //let resB2A = calculateSwapB2A(ticks, resA2B.afterPrice.sqrt(), fee, resA2B.afterLiquity, amountBIn)
    //console.log(resB2A)
}

main().catch(err => {
    console.error(err);
    process.exit(-1);
}).then(() => process.exit());
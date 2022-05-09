#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import { PublicKey } from "@solana/web3.js";
import { Command } from "commander";
import Decimal from "decimal.js";

import { SWAP_A2B, SWAP_B2A } from "../src";
import * as math from "../src/math";
import * as swap from "./";
import {
  catchFinallyExit,
  decodeDepositFixTokenLayout,
  printObjectTable,
} from "./";

export const program = new Command().name("crema-swap");

// The pair command
// --------------------------------------------------------------------------------------------------
const pairCommand = program
  .command("pair")
  .description("The swap pair commands");

// Create a swap pair config template
pairCommand
  .command("new-template")
  .description(`Create a token swap pair config template`)
  .option(
    "-o --output <output>",
    "The config file output path",
    "./swap-pair-template.yaml"
  )
  .action((arg) => {
    swap.createSwapPairTemplate(arg.output);
  });

// Create a swap pair
pairCommand
  .command("create")
  .description(`Create a token swap pair by swap pair config`)
  .option("-c --config <config>", "The swap pair config file path")
  .action((arg) => {
    if (arg.config !== undefined) {
      catchFinallyExit(swap.createSwapPairByConfig(arg.config));
    } else {
      catchFinallyExit(swap.createSwapPairByPrompt());
    }
  });

// Fetch the swap pair information
pairCommand
  .command("info")
  .description(`Fetch the swap pair information`)
  .argument("<pair>", "The swap pair key")
  .option("-p --position", "Is output the positions, default is false")
  .option("-t --tick", "Is output the ticks, default is false")
  .option("-f --format <format>", "The out format, default is table", "table")
  .action((pair: string, arg: any) => {
    const pairKey = new PublicKey(pair);
    const opt = {
      positions: arg.position,
      ticks: arg.tick,
      format: arg.format,
    };
    catchFinallyExit(swap.fetchSwapPair(pairKey, opt));
  });

// Fetch the swap pair list
pairCommand
  .command("list")
  .description("Fetch the swap pair list in the program")
  .action(() => {
    catchFinallyExit(swap.fetchSwapPairs());
  });

// TODO: Check if the swap pair amount is correct
pairCommand
  .command("check-amount")
  .description("Check the swap pair token amount");

// TODO: Check if the swap pair current liquity is correct
pairCommand
  .command("check-current-liquity")
  .description("Check the swap pair current liquity");

// TODO: Check if the swap pair ticks is correct
pairCommand
  .command("check-pos-tick")
  .description("Check the swap pair positon and tick");

// The position command
// --------------------------------------------------------------------------------------------------
const posCommand = program
  .command("pos")
  .description("The swap pair position's command");

// Add a position
posCommand
  .command("mint")
  .description("Create a position in swap pair")
  .requiredOption("-p --pair <pair>", "The swap pair key")
  .requiredOption("-l --lower <lower>", "The lower price")
  .requiredOption("-u --upper <upper>", "the upper price")
  .option("-a --amountA <amountA>", "The amount of token A")
  .option("-b --amountB <amountB>", "The amount of token B")
  .option("-s --slid <sild>", "The slid rate")
  .option(
    "--fix",
    "If fix the token amount, default it will fix the liquity amount"
  )
  .option("-d --debug", "Is debug, if debug will not check balance", false)
  .action((arg) => {
    catchFinallyExit(
      arg.fix
        ? swap.mintPositionFix({
            pairKey: new PublicKey(arg.pair),
            lowerPrice: new Decimal(arg.lower),
            upperPrice: new Decimal(arg.upper),
            amountA:
              arg.amountA !== undefined ? new Decimal(arg.amountA) : null,
            amountB:
              arg.amountB !== undefined ? new Decimal(arg.amountB) : null,
            slid:
              arg.slid !== undefined
                ? new Decimal(arg.slid)
                : new Decimal(0.01),
            isDebug: arg.debug,
          })
        : swap.mintPosition({
            pairKey: new PublicKey(arg.pair),
            lowerPrice: new Decimal(arg.lower),
            upperPrice: new Decimal(arg.upper),
            amountA:
              arg.amountA !== undefined ? new Decimal(arg.amountA) : null,
            amountB:
              arg.amountB !== undefined ? new Decimal(arg.amountB) : null,
            slid:
              arg.slid !== undefined
                ? new Decimal(arg.slid)
                : new Decimal(0.01),
          })
    );
  });

// Increase liquity on a position
posCommand
  .command("incr")
  .description("Add liquity on a position")
  .requiredOption("-p --pair <pair>", "The swap pair key")
  .argument("<positionId>", "The position id")
  .option("-a --amountA <amountA>", "The amount of token A")
  .option("-b --amountB <amountB>", "The amount of token B")
  .option("-s --slid <sild>", "The slid rate")
  .option(
    "--fix",
    "If fix the token amount, default it will fix the liquity amount"
  )
  .action((positionId, arg) => {
    catchFinallyExit(
      arg.fix
        ? swap.increaseLiquityFix({
            pairKey: new PublicKey(arg.pair),
            positionId: new PublicKey(positionId),
            positionAccount: null,
            amountA:
              arg.amountA !== undefined ? new Decimal(arg.amountA) : null,
            amountB:
              arg.amountB !== undefined ? new Decimal(arg.amountB) : null,
            slid:
              arg.slid !== undefined
                ? new Decimal(arg.slid)
                : new Decimal(0.01),
          })
        : swap.increaseLiquity({
            pairKey: new PublicKey(arg.pair),
            positionId: new PublicKey(positionId),
            positionAccount: null,
            amountA:
              arg.amountA !== undefined ? new Decimal(arg.amountA) : null,
            amountB:
              arg.amountB !== undefined ? new Decimal(arg.amountB) : null,
            slid:
              arg.slid !== undefined
                ? new Decimal(arg.slid)
                : new Decimal(0.01),
          })
    );
  });

// Decrease liquity on a position
posCommand
  .command("decr")
  .description("Add liquity on a position")
  .requiredOption("-p --pair <pair>", "The swap pair key")
  .argument("<positionId>", "The position id")
  .option("-per --percent <percent>", "The percent of liquity")
  .option("-s --slid <sild>", "The slid rate")
  .action((positionId, arg) => {
    catchFinallyExit(
      swap.decreaseLiquity({
        pairKey: new PublicKey(arg.pair),
        positionId: new PublicKey(positionId),
        positionAccount: null,
        percent: new Decimal(arg.percent),
        slid:
          arg.slid !== undefined ? new Decimal(arg.slid) : new Decimal(0.01),
      })
    );
  });

// Collect fee on a position
posCommand
  .command("claim")
  .description("Claim the exchange fee on a position")
  .requiredOption("-p --pair <pair>", "The swap pair key")
  .argument("<positionId>", "The position id")
  .action((positionId, arg) => {
    catchFinallyExit(
      swap.claim({
        pairKey: new PublicKey(arg.pair),
        positionId: new PublicKey(positionId),
      })
    );
  });

// Fetch the positions of a swap pair
posCommand
  .command("list")
  .description("fetch the position list")
  .requiredOption("-p --pair <pair>", "The swap pair key")
  .option("-o --owner <owner>", "The position's owner")
  .action((arg) => {
    let owner: PublicKey | undefined | null = null;
    if (arg.owner === undefined) {
      owner = undefined;
    } else if (arg.owner === true) {
      owner = null;
    } else {
      owner = new PublicKey(arg.owner);
    }
    catchFinallyExit(
      swap.fetchPostions({
        pairKey: new PublicKey(arg.pair),
        owner,
      })
    );
  });

// Fetch the detail of a position
posCommand
  .command("info")
  .description("Fetch the position detail info")
  .requiredOption("-p --pair <pair>", "The swap pair key")
  .argument("<positionId>", "The position id")
  .action((positionId, arg) => {
    catchFinallyExit(
      swap.fetchPostion({
        pairKey: new PublicKey(arg.pair),
        positionId: new PublicKey(positionId),
      })
    );
  });

// The swap command
// --------------------------------------------------------------------------------------------------
program
  .command("a2b")
  .description("Swap token A and B, cost tokenA receive tokenB")
  .requiredOption("-p --pair <pair>", "The swap pair key")
  .requiredOption("-a --amount <amount>", "The token A amount")
  .option("-s --slid <slid>", "The price slid", "0.01")
  .option("--simulate", "Is the simulate transaction", false)
  .action((arg) => {
    if (arg.simulate === true) {
      catchFinallyExit(
        swap.simulateSwap({
          pairKey: new PublicKey(arg.pair),
          amount: new Decimal(arg.amount),
          direct: SWAP_A2B,
        })
      );
    } else {
      catchFinallyExit(
        swap.swapA2B({
          pairKey: new PublicKey(arg.pair),
          amount: new Decimal(arg.amount),
          slid: new Decimal(arg.slid),
        })
      );
    }
  });

program
  .command("b2a")
  .description("Swap token A and B, cost tokenA receive tokenB")
  .requiredOption("-p --pair <pair>", "The swap pair key")
  .requiredOption("-a --amount <amount>", "The token A amount")
  .option("-s --slid <slid>", "The price slid", "0.01")
  .option("--simulate", "Is the simulate transaction", false)
  .action((arg) => {
    if (arg.simulate === true) {
      catchFinallyExit(
        swap.simulateSwap({
          pairKey: new PublicKey(arg.pair),
          amount: new Decimal(arg.amount),
          direct: SWAP_B2A,
        })
      );
    } else {
      catchFinallyExit(
        swap.swapB2A({
          pairKey: new PublicKey(arg.pair),
          amount: new Decimal(arg.amount),
          slid: new Decimal(arg.slid),
        })
      );
    }
  });

// TODO: The math command
// --------------------------------------------------------------------------------------------------
const mathCommand = program
  .command("math")
  .description("The swap math command");

mathCommand
  .command("token-amount")
  .description("Calculate the liquity amount")
  .requiredOption("-l --lower <lower>", "The lower tick")
  .requiredOption("-u --upper <lower>", "The upper tick")
  .requiredOption("-c --currentPrice <currentPrice>", "The current price")
  .argument("<liquity>", "The liquity amount")
  .action((l, arg) => {
    const lowerTick: number = +arg.lower;
    const upperTick: number = +arg.upper;
    const currentSqrtPrice = new Decimal(arg.currentPrice).sqrt();
    const liquity = new Decimal(l);
    const res = math.calculateTokenAmount(
      lowerTick,
      upperTick,
      currentSqrtPrice,
      liquity
    );
    printObjectTable(res);
  });

mathCommand
  .command("liquity")
  .description("Calculate the liquity")
  .requiredOption("-l --lower <lower>", "The lower tick")
  .requiredOption("-u --upper <upper>", "The upper tick")
  .requiredOption("-c --currentPrice <currentPrice>", "The current price")
  .option("-a --amountA <amountA>", "The amount of token A")
  .option("-b --amountB <amountB>", "The amount of token B")
  .action((arg) => {
    const lowerTick: number = +arg.lower;
    const upperTick: number = +arg.upper;
    const currentPrice = new Decimal(arg.currentPrice);
    if (currentPrice.lessThanOrEqualTo(0)) {
      console.log("Invalid current price, current price must in (0, maxU64]");
      return;
    }
    const currentSqrtPrice = currentPrice.sqrt();
    const amountA = new Decimal(arg.amountA);
    const amountB = new Decimal(arg.amountB);
    if (currentSqrtPrice.greaterThan(math.tick2SqrtPrice(upperTick))) {
      const res = math.calculateLiquityOnlyB(lowerTick, upperTick, amountB);
      printObjectTable({
        side: "tokenB",
        lowerPrice: math.tick2Price(lowerTick),
        upperPrice: math.tick2Price(upperTick),
        specialAmountSrc: amountB,
        liquity: res,
      });
    } else if (currentSqrtPrice.lessThan(math.tick2SqrtPrice(lowerTick))) {
      const res = math.calculateLiquityOnlyA(lowerTick, upperTick, amountA);
      printObjectTable({
        side: "tokenA",
        lowerPrice: math.tick2Price(lowerTick),
        upperPrice: math.tick2Price(upperTick),
        specialAmountSrc: amountA,
        liquity: res,
      });
    } else {
      const resA = math.calculateLiquity(
        lowerTick,
        upperTick,
        amountA,
        currentSqrtPrice,
        0
      );
      printObjectTable({
        side: "tokenA",
        lowerPrice: math.tick2Price(lowerTick),
        upperPrice: math.tick2Price(upperTick),
        specialAmountSrc: amountA,
        ...resA,
      });

      const resB = math.calculateLiquity(
        lowerTick,
        upperTick,
        amountB,
        currentSqrtPrice,
        1
      );
      printObjectTable({
        side: "tokenB",
        lowerPrice: math.tick2Price(lowerTick),
        upperPrice: math.tick2Price(upperTick),
        specialAmountSrc: amountB,
        ...resA,
        ...resB,
      });
    }
  });

mathCommand.command("decode-deposit-fix-token").action(() => {
  decodeDepositFixTokenLayout();
});
//
// mathCommand
//   .command("tick2price")
//   .description("Calculate the price by tick")
//   .argument("<tick>", "the tick")
//   .option("--decimalsA <decimalsA>", "The token A decimals", "9")
//   .option("--decimalsB <decimalsB>", "The token B decimals", "9");
//
// mathCommand
//   .command("price2tick")
//   .description("Calculate the tick by price")
//   .argument("<price>", "the price")
//   .option("--decimalsA <decimalsA>", "The token A decimals", "9")
//   .option("--decimalsB <decimalsB>", "The token B decimals", "9");

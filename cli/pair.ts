/* eslint-disable @typescript-eslint/no-explicit-any */
import { TokenAugmentedProvider } from "@saberhq/token-utils";
import { PublicKey } from "@solana/web3.js";
import { printTable } from "console-table-printer";
import Decimal from "decimal.js";
import * as fs from "fs";
import inquirer from "inquirer";
import _ from "lodash";
import invariant from "tiny-invariant";
import * as YAML from "yaml";

import { TokenSwap } from "../src";
import {
  calculateLiquityTable,
  calculateTokenAmount,
  lamportPrice2uiPrice,
  uiPrice2LamportPrice,
} from "../src/math";
import { loadTokens } from "./tokenList";
import {
  confirmTx,
  getSigner,
  loadProvider,
  mustGetTokenInfo,
  printObjectJSON,
  printObjectTable,
  receiptLog,
} from "./utils";

export const DEFAULT_SWAP_PROGRAM_ID =
  "6MLxLqiXaaSUpkgMnWDTuejNZEz3kE7k2woyHGVFw319";

const keyValidate = function (input: any): boolean {
  const p = new PublicKey(input);
  if (p === undefined) {
    return false;
  }
  return true;
};

// Get the program id of crema swap
export function swapProgramId(): PublicKey {
  invariant(process.env.HOME !== undefined);
  const home: string = process.env.HOME;
  const path = `${home}/.crema_swap_program`;
  let programId = PublicKey.default;

  try {
    fs.accessSync(path, fs.constants.R_OK);
    const data = fs.readFileSync(path);
    programId = new PublicKey(data);
  } catch (_) {
    programId = new PublicKey(DEFAULT_SWAP_PROGRAM_ID);
  }

  return programId;
}

// load crema swap
export async function loadSwapPair(pairKey: PublicKey): Promise<TokenSwap> {
  const provider = loadProvider();
  const pair = new TokenSwap(provider, swapProgramId(), pairKey);
  await loadTokens();
  await pair.load();
  return pair;
}

export function pairName(mintA: PublicKey, mintB: PublicKey): string {
  return `${mustGetTokenInfo(mintA).symbol}-${mustGetTokenInfo(mintB).symbol}`;
}

// The option of fetch swap pair
export interface FetchSwapPairOpt {
  positions: boolean;
  ticks: boolean;
  format: string;
}

export interface SwapPairConfig {
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  manager: PublicKey;
  fee: Decimal;
  managerFee: Decimal;
  tickSpace: number;
  tickAccountSize: number;
  initializePrice: Decimal;
}

// Fetch the swap pair list
export async function fetchSwapPairs() {
  await loadTokens();
  const list = await TokenSwap.fetchSwapPairs(loadProvider(), swapProgramId());
  const output: any[] = [];
  list.forEach((v) => {
    output.push({
      pair: pairName(v.tokenAMint, v.tokenBMint),
      swapKey: v.tokenSwapKey.toBase58(),
      manager: v.manager.toBase58(),
      tokenAMint: v.tokenAMint.toBase58(),
      tokenBMint: v.tokenBMint.toBase58(),
      tickSpace: v.tickSpace,
      currentSqrtPrice: v.currentSqrtPrice.toString(),
      fee: v.fee.toNumber(),
      managerFee: v.managerFee.toNumber(),
    });
  });
  printTable(output);
}

// Fetch the crema swap info
export async function fetchSwapPair(
  pairKey: PublicKey,
  opt = {
    positions: false,
    ticks: false,
    format: "table",
  }
) {
  const swapPair = await loadSwapPair(pairKey);
  const ext: Map<string, any> = new Map();
  if (opt.positions) {
    ext.set("positions", swapPairPositions(swapPair));
  }
  if (opt.ticks) {
    ext.set("ticks", swapPairTicks(swapPair));
  }
  if (opt.format === "table") {
    printObjectTable({
      pair: pairName(
        swapPair.tokenSwapInfo.tokenAMint,
        swapPair.tokenSwapInfo.tokenBMint
      ),
      ...swapPair.tokenSwapInfo,
      uiPrice: swapPair.uiPrice(),
      uiReversePrice: swapPair.uiReversePrice(),
    });
    ext.forEach((v, _) => {
      printTable(v);
    });
  } else if (opt.format === "json") {
    ext.set("swapInfo", swapPair.tokenSwapInfo);
    console.log(
      JSON.stringify(
        {
          pair: pairName(
            swapPair.tokenSwapInfo.tokenAMint,
            swapPair.tokenSwapInfo.tokenBMint
          ),
          swapInfo: {
            uiPrice: swapPair.uiPrice(),
            uiReversePrice: swapPair.uiReversePrice(),
            ...swapPair.tokenSwapInfo,
          },
          positions: ext.get("positions"),
          ticks: ext.get("ticks"),
        },
        null,
        2
      )
    );
  }
}

// Create a swap pair template for create
export function createSwapPairTemplate(outpath: string) {
  const data = YAML.stringify({
    tokenAMint: "<input token a mint address>",
    tokenBMint: "<input token b mint address>",
    manager: getSigner().publicKey.toBase58(),
    fee: 0.0001,
    managerFee: 0.00002,
    tickSpace: 10,
    tickAccountSize: 504000,
    initializePrice: 1.0,
  });
  fs.writeFileSync(outpath, data);
}

// Read the swap pair from config file for create swap pair
function getSwapConfigByFile(configPath: string): SwapPairConfig {
  const configFile = fs.readFileSync(configPath, "utf8");
  const data = YAML.parse(configFile);
  return {
    tokenAMint: new PublicKey(data.tokenAMint),
    tokenBMint: new PublicKey(data.tokenBMint),
    manager: new PublicKey(data.manager),
    fee: new Decimal(data.fee),
    managerFee: new Decimal(data.managerFee),
    tickSpace: new Decimal(data.tickSpace).toNumber(),
    tickAccountSize: new Decimal(data.tickAccountSize).toNumber(),
    initializePrice: new Decimal(data.initializePrice),
  };
}

const getSwapConfigPrompt = () => {
  const promptList = [
    {
      type: "input",
      name: "tokenAMint",
      message: "token A mint address:",
      validate: keyValidate,
    },
    {
      type: "input",
      name: "tokenBMint",
      message: "token B mint address:",
      validate: keyValidate,
    },
    {
      type: "input",
      name: "manager",
      message: "token manager address:",
      default: "BJ9NL8PCaNkPLC25xwiACqaNeEzfeWp8uxSDKi1EBZnh",
      validate: keyValidate,
    },
    {
      type: "input",
      name: "initializePrice",
      message: "The initialize price of swap pair:",
      default: "1",
    },
    {
      type: "input",
      name: "fee",
      default: "0.0001",
      message: "The exchange fee rate:",
    },
    {
      type: "input",
      name: "managerFee",
      message: "The manager fee rate:",
      default: "0.00002",
    },
    {
      type: "input",
      name: "tickSpace",
      message: "The tick space:",
      default: "5",
    },
    {
      type: "input",
      name: "tickAccountSize",
      message: "The tick size:",
      default: "504000",
    },
  ];
  return inquirer.prompt(promptList);
};

export async function createSwapPairByConfig(configPath: string) {
  const config = getSwapConfigByFile(configPath);
  await loadTokens();
  await createSwapPair(config);
}

export async function createSwapPairByPrompt() {
  const answers = await getSwapConfigPrompt();
  const config = {
    tokenAMint: new PublicKey(answers.tokenAMint),
    tokenBMint: new PublicKey(answers.tokenBMint),
    manager: new PublicKey(answers.manager),
    fee: new Decimal(answers.fee),
    managerFee: new Decimal(answers.managerFee),
    tickSpace: new Decimal(answers.tickSpace).toNumber(),
    tickAccountSize: new Decimal(answers.tickAccountSize).toNumber(),
    initializePrice: new Decimal(answers.initializePrice),
  };
  await loadTokens();
  await createSwapPair(config);
}

// Create a swap pair in crema swap
async function createSwapPair(config: {
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  manager: PublicKey;
  fee: Decimal;
  managerFee: Decimal;
  tickSpace: number;
  tickAccountSize: number;
  initializePrice: Decimal;
}) {
  const tokenProvider = new TokenAugmentedProvider(loadProvider());
  const mintA = await tokenProvider.fetchMint(config.tokenAMint);
  const mintB = await tokenProvider.fetchMint(config.tokenBMint);

  invariant(mintA !== null, "The token A mint account not found");
  invariant(mintB !== null, "The token B mint account not found");

  config.initializePrice = uiPrice2LamportPrice(
    config.initializePrice,
    mintA.decimals,
    mintB.decimals
  );

  printObjectTable({
    pair: pairName(config.tokenAMint, config.tokenBMint),
    ..._.omit(config, "initializePrice"),
    initializePrice: lamportPrice2uiPrice(
      config.initializePrice,
      mintA.decimals,
      mintB.decimals
    ),
  });
  const getConfirm = await inquirer.prompt({
    type: "confirm",
    name: "confirm",
    prefix: "",
    message: "The above table is the swap pair information, confirm it ?",
  });

  if (getConfirm.confirm) {
    const res = await TokenSwap.createTokenSwap({
      provider: loadProvider(),
      programId: swapProgramId(),
      ...config,
    });
    const receipt = await confirmTx(res.tx);
    printObjectJSON({
      ...receiptLog(receipt),
      swapInfo: {
        ..._.omit(res, "tx"),
        initializePriceWithDecimals: config.initializePrice,
        decimalsA: mintA?.decimals,
        decimalsB: mintB?.decimals,
      },
    });
  }
}

export function swapPairPositions(swapPair: TokenSwap): any[] {
  const list: any[] = [];
  swapPair.positions.forEach((v) => {
    const amount = calculateTokenAmount(
      v.lowerTick,
      v.upperTick,
      v.liquity,
      swapPair.tokenSwapInfo.currentSqrtPrice
    );
    list.push({
      ...v,
      amountA: swapPair.tokenAAmount(amount.amountA.toDP(0)).toString(),
      amountB: swapPair.tokenBAmount(amount.amountB.toDP(0)).toString(),
    });
  });
  return list;
}

function swapPairTicks(swapPair: TokenSwap): any[] {
  const list: any[] = [];
  const res = calculateLiquityTable(swapPair.ticks);
  res.liquitys.forEach((v) => {
    const amount = calculateTokenAmount(
      v.lowerTick,
      v.upperTick,
      v.amount,
      swapPair.tokenSwapInfo.currentSqrtPrice
    );
    list.push({
      lowerTick: v.lowerTick,
      upperTick: v.upperTick,
      liquity: v.amount,
      amountA: swapPair.tokenAAmount(amount.amountA.toDP(0)).toString(),
      amountB: swapPair.tokenBAmount(amount.amountB.toDP(0)).toString(),
    });
  });
  return list;
}

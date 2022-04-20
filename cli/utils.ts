import type {
  BroadcastOptions,
  Provider,
  TransactionEnvelope,
  TransactionReceipt,
} from "@saberhq/solana-contrib";
import { SignerWallet, SolanaProvider } from "@saberhq/solana-contrib";
import { deserializeAccount } from "@saberhq/token-utils";
import type { AccountInfo } from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type {
  AccountInfo as BaseAccountInfo,
  PublicKey,
  Signer,
  TokenAccountsFilter,
} from "@solana/web3.js";
import { clusterApiUrl, Connection, Keypair } from "@solana/web3.js";
import BN from "bn.js";
import { Table } from "console-table-printer";
import * as fs from "fs";
import { exit } from "process";
import invariant from "tiny-invariant";
import { parse } from "yaml";

import type { TokenInfo } from "./tokenList";
import { getTokenInfo } from "./tokenList";

export function keypairFromFile(path: string): Keypair {
  const secret = fs.readFileSync(path, "utf-8");
  const arr: Uint8Array = JSON.parse(secret);
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

export function loadProvider(): Provider {
  invariant(process.env.HOME !== undefined);
  const home: string = process.env.HOME;
  const configFile = fs.readFileSync(
    `${home}/.config/solana/cli/config.yml`,
    "utf8"
  );
  const config = parse(configFile);
  const url = getURL(config.json_rpc_url);
  const wallet = new SignerWallet(keypairFromFile(config.keypair_path));
  const provider = SolanaProvider.init({
    connection: new Connection(url, {
      commitment: "recent",
      disableRetryOnRateLimit: true,
      confirmTransactionInitialTimeout: 60 * 1000,
    }),
    wallet,
    opts: {
      preflightCommitment: "recent",
      commitment: "recent",
    },
  });
  return provider;
}

export function getSigner(): Signer {
  invariant(process.env.HOME !== undefined);
  const home: string = process.env.HOME;
  const configFile = fs.readFileSync(
    `${home}/.config/solana/cli/config.yml`,
    "utf8"
  );
  const config = parse(configFile);
  return keypairFromFile(config.keypair_path);
}

function getURL(cluster: string): string {
  switch (cluster) {
    case "devnet":
    case "testnet":
    case "mainnet-beta": {
      return clusterApiUrl(cluster, true);
    }
    case "localnet": {
      return "http://localhost:8899";
    }
  }
  return cluster;
}

export async function currentTs(connection: Connection): Promise<BN> {
  const solt = await connection.getSlot();
  const ts = await connection.getBlockTime(solt);
  invariant(ts !== null, "Get block time failed");
  return new BN(ts?.toString());
}

/*eslint-disable  @typescript-eslint/no-explicit-any */
export function printObjectTable(ins?: any) {
  const table = new Table({
    columns: [
      { name: "key", alignment: "left", color: "blue" },
      { name: "value", alignment: "left", color: "green" },
    ],
  });
  for (const key in ins) {
    table.addRow({ key: key, value: ins[key] });
  }
  table.printTable();
}

/*eslint-disable  @typescript-eslint/no-explicit-any */
export function printObjectJSON(ins?: any, maxDeep = 1) {
  let d = 0;
  const convertObjt = (ins?: any, deep = 0) => {
    const data = new Map<string, any>();
    for (const key in ins) {
      /*eslint-disable  @typescript-eslint/no-unsafe-call*/
      if (typeof ins[key] === "object" && deep < maxDeep) {
        d += 1;
        data.set(key, convertObjt(ins[key], d));
      } else {
        /*eslint-disable  @typescript-eslint/no-unsafe-call*/
        if (ins[key] === null) {
          data.set(key.toString(), null);
          continue;
        }
        data.set(key.toString(), ins[key].toString());
      }
    }
    return Object.fromEntries(data);
  };
  console.log(JSON.stringify(convertObjt(ins, d), null, 4));
}

export async function getTokenAccountsByOwner(
  conn: Connection,
  owner: PublicKey
): Promise<Array<AccountInfo>> {
  const filter: TokenAccountsFilter = {
    programId: TOKEN_PROGRAM_ID,
  };
  const tokenAccounts: Array<AccountInfo> = [];
  const resp = await conn.getTokenAccountsByOwner(owner, filter);
  for (const accountInfo of resp.value) {
    tokenAccounts.push(deserializeTokenAccount(accountInfo));
  }
  return tokenAccounts;
}

export async function getTokenAccountsByOwnerAndMint(
  conn: Connection,
  owner: PublicKey,
  mint: PublicKey
): Promise<Array<AccountInfo>> {
  const filter: TokenAccountsFilter = {
    mint,
    programId: TOKEN_PROGRAM_ID,
  };
  const tokenAccounts: Array<AccountInfo> = [];
  const resp = await conn.getTokenAccountsByOwner(owner, filter);
  for (const accountInfo of resp.value) {
    tokenAccounts.push(deserializeTokenAccount(accountInfo));
  }
  return tokenAccounts;
}

export function deserializeTokenAccount(accountInfo: {
  pubkey: PublicKey;
  account: BaseAccountInfo<Buffer>;
}): AccountInfo {
  return {
    address: accountInfo.pubkey,
    ...deserializeAccount(accountInfo.account.data),
  };
}

export function catchFinallyExit(pending: Promise<any>) {
  pending
    .catch((err) => {
      console.log(err);
    })
    .finally(() => {
      exit(0);
    });
}

export async function confirmTx(
  tx: TransactionEnvelope
): Promise<TransactionReceipt> {
  const opt: BroadcastOptions = {
    skipPreflight: true,
    commitment: "confirmed",
    preflightCommitment: "confirmed",
    maxRetries: 30,
    printLogs: true,
  };

  const pendingTx = await tx.send(opt);
  console.log("%s  confirming...", pendingTx.signature.toString());

  return await pendingTx.wait({
    commitment: "confirmed",
    useWebsocket: true,
    retries: 30,
  });
}

export function receiptLog(receipt: TransactionReceipt): {
  signature: string;
  computeUnits: number;
  blockTime: number | null | undefined;
  solt: number;
} {
  return {
    signature: receipt.signature.toString(),
    computeUnits: receipt.computeUnits,
    blockTime: receipt.response.blockTime,
    solt: receipt.response.slot,
  };
}

export function mustGetTokenInfo(address: PublicKey): TokenInfo {
  const info = getTokenInfo(address);
  return info !== undefined
    ? info
    : {
        symbol: "unkown",
        name: "unkown",
        address: address.toBase58(),
        decimals: 9,
      };
}

import * as fs from "fs";
import { Keypair } from "@solana/web3.js";

export function KPFromFile(path: string): Keypair {
  const secret = fs.readFileSync(path, "utf-8");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const arr: Uint8Array = JSON.parse(secret);
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

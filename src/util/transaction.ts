import type {
  Connection,
  Signer,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";
import { sendAndConfirmTransaction as realSendAndConfirmTransaction } from "@solana/web3.js";

/**
 * Send and confirm trnasaction with default option
 * @param conn The connection to use
 * @param transaction The transaction
 * @param signers The signers array
 * @returns
 */
export async function sendAndConfirmTransaction(
  conn: Connection,
  transaction: Transaction,
  ...signers: Signer[]
): Promise<TransactionSignature> {
  return realSendAndConfirmTransaction(conn, transaction, signers, {
    skipPreflight: false,
    commitment: "recent",
    preflightCommitment: "recent",
  });
}

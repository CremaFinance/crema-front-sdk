/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { struct, u8 } from "@solana/buffer-layout";
import type { AccountInfo } from "@solana/spl-token";
import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
  u64,
} from "@solana/spl-token";
import type {
  AccountInfo as BaseAccountInfo,
  Connection,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  PublicKey,
  TransactionInstruction as TransactionInstructionClass,
} from "@solana/web3.js";
import invariant from "tiny-invariant";

/**
 * Get a authority token account address
 * @param tokenMint The mint of token
 * @param owner The owner associated token address
 * @returns
 */
export async function getAssociatedTokenAddress(
  tokenMint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  return await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    tokenMint,
    owner,
    true
  );
}

/**
 * Get a create associated token account instruction
 * @param tokenMint The mint of token
 * @param owner The owner associated token address
 * @param payer The pays for transaction
 * @returns
 */
export function createAssociatedTokenAccountInstruction(
  tokenMint: PublicKey,
  associatedAccount: PublicKey,
  owner: PublicKey,
  payer: PublicKey
): TransactionInstruction {
  return Token.createAssociatedTokenAccountInstruction(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    tokenMint,
    associatedAccount,
    owner,
    payer
  );
}

/**
 * Get the token account info by address
 * @param conn The connection to use
 * @param address The token account address
 * @returns
 */
export async function getTokenAccount(
  conn: Connection,
  address: PublicKey
): Promise<AccountInfo> {
  const account = await conn.getAccountInfo(address);
  invariant(
    account?.data !== null,
    `The token account:${address.toBase58()} data is null`
  );
  invariant(account !== null, "the account is null");
  const accountInfo = parseTokenAccount(account);
  accountInfo.address = address;
  return accountInfo;
}

/**
 * Get the token accounts by owner
 * @param conn The connection to use
 * @param owner The owner address
 * @returns The token accounts
 */
export async function getTokenAccounts(
  conn: Connection,
  owner: PublicKey
): Promise<AccountInfo[]> {
  const accounts = await conn.getTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });
  const accountInfos: AccountInfo[] = [];
  accounts.value.forEach((v) => {
    invariant(
      v.account.data !== null,
      `The token account:${v.pubkey.toBase58()} data is null`
    );
    const accountInfo = parseTokenAccount(v.account);
    accountInfo.address = v.pubkey;
    accountInfos.push(accountInfo);
  });
  return accountInfos;
}

export function parseTokenAccountData(data: Buffer): AccountInfo {
  const accountInfo = AccountLayout.decode(data);
  accountInfo.mint = new PublicKey(accountInfo.mint);
  accountInfo.owner = new PublicKey(accountInfo.owner);
  accountInfo.amount = u64.fromBuffer(accountInfo.amount);

  if (accountInfo.delegateOption === 0) {
    accountInfo.delegate = null;
    accountInfo.delegatedAmount = new u64(0);
  } else {
    accountInfo.delegate = new PublicKey(accountInfo.delegate);
    accountInfo.delegatedAmount = u64.fromBuffer(accountInfo.delegatedAmount);
  }

  accountInfo.isInitialized = accountInfo.state !== 0;
  accountInfo.isFrozen = accountInfo.state === 2;

  if (accountInfo.isNativeOption === 1) {
    accountInfo.rentExemptReserve = u64.fromBuffer(accountInfo.isNative);
    accountInfo.isNative = true;
  } else {
    accountInfo.rentExemptReserve = null;
    accountInfo.isNative = false;
  }

  if (accountInfo.closeAuthorityOption === 0) {
    accountInfo.closeAuthority = null;
  } else {
    accountInfo.closeAuthority = new PublicKey(accountInfo.closeAuthority);
  }

  return accountInfo;
}

export function parseTokenAccount(
  account: BaseAccountInfo<Buffer>
): AccountInfo {
  invariant(account?.data !== null, `The account data is null`);
  const accountInfo = AccountLayout.decode(account?.data);
  accountInfo.mint = new PublicKey(accountInfo.mint);
  accountInfo.owner = new PublicKey(accountInfo.owner);
  accountInfo.amount = u64.fromBuffer(accountInfo.amount);

  if (accountInfo.delegateOption === 0) {
    accountInfo.delegate = null;
    accountInfo.delegatedAmount = new u64(0);
  } else {
    accountInfo.delegate = new PublicKey(accountInfo.delegate);
    accountInfo.delegatedAmount = u64.fromBuffer(accountInfo.delegatedAmount);
  }

  accountInfo.isInitialized = accountInfo.state !== 0;
  accountInfo.isFrozen = accountInfo.state === 2;

  if (accountInfo.isNativeOption === 1) {
    accountInfo.rentExemptReserve = u64.fromBuffer(accountInfo.isNative);
    accountInfo.isNative = true;
  } else {
    accountInfo.rentExemptReserve = null;
    accountInfo.isNative = false;
  }

  if (accountInfo.closeAuthorityOption === 0) {
    accountInfo.closeAuthority = null;
  } else {
    accountInfo.closeAuthority = new PublicKey(accountInfo.closeAuthority);
  }

  return accountInfo;
}

// createSyncNativeInstruction implement （refer to spl-token2.0）

/** Instructions defined by the program */
export declare enum TokenInstruction {
  InitializeMint = 0,
  InitializeAccount = 1,
  InitializeMultisig = 2,
  Transfer = 3,
  Approve = 4,
  Revoke = 5,
  SetAuthority = 6,
  MintTo = 7,
  Burn = 8,
  CloseAccount = 9,
  FreezeAccount = 10,
  ThawAccount = 11,
  TransferChecked = 12,
  ApproveChecked = 13,
  MintToChecked = 14,
  BurnChecked = 15,
  InitializeAccount2 = 16,
  SyncNative = 17,
  InitializeAccount3 = 18,
  InitializeMultisig2 = 19,
  InitializeMint2 = 20,
}

export interface SyncNativeInstructionData {
  instruction: TokenInstruction.SyncNative;
}

/** TODO: docs */
export const syncNativeInstructionData = struct<SyncNativeInstructionData>([
  u8("instruction"),
]);

/**
 * Construct a SyncNative instruction
 *
 * @param account   Native account to sync lamports from
 * @param programId SPL Token program account
 *
 * @return Instruction to add to a transaction
 */
export function createSyncNativeInstruction(
  account: PublicKey,
  programId = TOKEN_PROGRAM_ID
): TransactionInstruction {
  const keys = [{ pubkey: account, isSigner: false, isWritable: true }];

  const data = Buffer.alloc(syncNativeInstructionData.span);
  syncNativeInstructionData.encode(
    { instruction: TokenInstruction.SyncNative },
    data
  );

  return new TransactionInstructionClass({ keys, programId, data });
}

import { struct, u8 } from "@solana/buffer-layout";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { PublicKey } from "@solana/web3.js";
import { TransactionInstruction } from "@solana/web3.js";

import { TokenSwapInstruction } from "./instruction";

interface Data {
  instruction: number;
}

const DataLayout = struct<Data>([u8("instruction")]);

export const managerClaimInstruction = (
  programId: PublicKey,
  tokenSwapKey: PublicKey,
  authority: PublicKey,
  userTransferAuthority: PublicKey,
  swapTokenA: PublicKey,
  swapTokenB: PublicKey,
  userTokenA: PublicKey,
  userTokenB: PublicKey
): TransactionInstruction => {
  const data = Buffer.alloc(DataLayout.span);
  DataLayout.encode(
    {
      instruction: TokenSwapInstruction.ManagerClaim,
    },
    data
  );
  const keys = [
    { pubkey: tokenSwapKey, isSigner: false, isWritable: true },
    { pubkey: authority, isSigner: false, isWritable: false },
    { pubkey: userTransferAuthority, isSigner: true, isWritable: false },
    { pubkey: swapTokenA, isSigner: false, isWritable: true },
    { pubkey: swapTokenB, isSigner: false, isWritable: true },
    { pubkey: userTokenA, isSigner: false, isWritable: true },
    { pubkey: userTokenB, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    keys,
    programId,
    data,
  });
};

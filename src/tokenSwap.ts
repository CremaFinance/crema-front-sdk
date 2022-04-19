import type { Provider } from "@saberhq/solana-contrib";
import { TransactionEnvelope } from "@saberhq/solana-contrib";
import {
  createATAInstruction,
  createMintInstructions,
  getATAAddress,
  getOrCreateATA,
  getTokenAccount,
} from "@saberhq/token-utils";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type {
  GetProgramAccountsConfig,
  TransactionInstruction,
} from "@solana/web3.js";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import * as bs58 from "bs58";
import Decimal from "decimal.js";
import invariant from "tiny-invariant";

import {
  addUserPositionInstruction,
  claimInstruction,
  depositAllTokenTypesInstruction,
  initializeInstruction,
  managerClaimInstruction,
  simulateSwapInstruction,
  swapInstruction,
  withdrawAllTokenTypesInstruction,
} from "./instructions";
import { depositFixTokenInstruction } from "./instructions/depositFixToken";
import {
  calculateLiquity,
  calculateLiquityOnlyA,
  calculateLiquityOnlyB,
  calculateSlidTokenAmount,
  calculateSwapA2B,
  calculateSwapB2A,
  calculateTokenAmount,
  getNearestTickByPrice,
  lamportPrice2uiPrice,
  sqrtPrice2Tick,
  tick2SqrtPrice,
  tick2UiPrice,
  uiPrice2LamportPrice,
  uiPrice2Tick,
} from "./math";
import type { Tick, TokenSwapAccount } from "./state";
import {
  isPositionsAccount,
  isTicksAccount,
  isTokenSwapAccount,
  MAX_ACCOUNT_POSITION_LENGTH,
  parsePositionsAccount,
  parseTicksAccount,
  parseTokenSwapAccount,
  POSITIONS_ACCOUNT_SIZE,
  TOKEN_SWAP_ACCOUNT_SIZE,
} from "./state";
import { getTokenAccounts } from "./util/token";

export const INIT_KEY = new PublicKey("11111111111111111111111111111111");
export const SWAP_B2A = 1;
export const SWAP_A2B = 0;
export const FIX_TOKEN_A = 0;
export const FIX_TOKEN_B = 1;

export interface PositionInfo {
  positionsKey: PublicKey;
  index: Decimal;
  positionId: PublicKey;
  lowerTick: number;
  upperTick: number;
  liquity: Decimal;
  feeGrowthInsideALast: Decimal;
  feeGrowthInsideBLast: Decimal;
  tokenAFee: Decimal;
  tokenBFee: Decimal;
}

export interface SwapPairInfo extends TokenSwapAccount {
  tokenADecimals: number;
  tokenBDecimals: number;
}

Decimal.config({
  precision: 64,
  rounding: Decimal.ROUND_HALF_DOWN,
  toExpNeg: -64,
  toExpPos: 64,
});

export interface PendingCreateSwapPair {
  swapKey: PublicKey;
  positionsKey: PublicKey;
  ticksKey: PublicKey;
  swapTokenA: PublicKey;
  swapTokenB: PublicKey;
  managerTokenA: PublicKey;
  managerTokenB: PublicKey;
  authority: PublicKey;
  tx: TransactionEnvelope;
}

export interface PendingMintPosition {
  positionId: PublicKey;
  positionAccount: PublicKey;
  positionsKey: PublicKey;
  tx: TransactionEnvelope;
}

/**
 * The token swap class
 */
export class TokenSwap {
  provider: Provider;
  programId: PublicKey = INIT_KEY;
  tokenSwapKey: PublicKey = INIT_KEY;
  authority: PublicKey = INIT_KEY;
  isLoaded = false;
  currentTick = 0;
  tokenSwapInfo: SwapPairInfo = {
    tokenSwapKey: INIT_KEY,
    accountType: 0,
    version: 0,
    isInitialized: 0,
    nonce: 0,
    tokenProgramId: TOKEN_PROGRAM_ID,
    manager: INIT_KEY,
    managerTokenA: INIT_KEY,
    managerTokenB: INIT_KEY,
    swapTokenA: INIT_KEY,
    swapTokenB: INIT_KEY,
    tokenAMint: INIT_KEY,
    tokenBMint: INIT_KEY,
    ticksKey: INIT_KEY,
    positionsKey: INIT_KEY,
    curveType: 0,
    fee: new Decimal(0),
    managerFee: new Decimal(0),
    tickSpace: 0,
    currentSqrtPrice: new Decimal(0),
    currentLiquity: new Decimal(0),
    feeGrowthGlobal0: new Decimal(0),
    feeGrowthGlobal1: new Decimal(0),
    managerFeeA: new Decimal(0),
    managerFeeB: new Decimal(0),
    tokenADecimals: 0,
    tokenBDecimals: 0,
  };
  ticks: Tick[] = [];
  positions: Map<string, PositionInfo>;
  positionsKeys: Map<PublicKey, number>;

  /**
   * The constructor of TokenSwap
   * @param programId The token swap program id
   * @param tokenSwapKey The token swap key
   */
  constructor(
    provider: Provider,
    programId: PublicKey,
    tokenSwapKey: PublicKey
  ) {
    this.provider = provider;
    this.tokenSwapKey = tokenSwapKey;
    this.programId = programId;
    this.positions = new Map();
    this.positionsKeys = new Map();
  }

  /**
   * Load the token swap info
   */
  async load(): Promise<TokenSwap> {
    const config: GetProgramAccountsConfig = {
      encoding: "base64",
      filters: [
        {
          memcmp: {
            offset: 1,
            bytes: this.tokenSwapKey.toBase58(),
          },
        },
      ],
    };
    const accounts = await this.provider.connection.getProgramAccounts(
      this.programId,
      config
    );
    accounts.map((item) => {
      if (isTokenSwapAccount(item.account)) {
        const info = parseTokenSwapAccount(item.pubkey, item.account);
        invariant(
          info?.data !== undefined,
          "The token swap account parse failed"
        );
        this.tokenSwapInfo = {
          ...info.data,
          tokenADecimals: this.tokenSwapInfo.tokenADecimals,
          tokenBDecimals: this.tokenSwapInfo.tokenBDecimals,
        };
      } else if (isTicksAccount(item.account)) {
        const info = parseTicksAccount(item.pubkey, item.account);
        invariant(info?.data !== undefined, "The tick account parse failed");
        this.ticks = info.data.ticks;
      } else if (isPositionsAccount(item.account)) {
        const info = parsePositionsAccount(item.pubkey, item.account);
        invariant(
          info?.data !== undefined,
          "The position account data parse failed"
        );
        this.positionsKeys.set(item.pubkey, info.data.positions.length);
        for (let i = 0; i < info.data.positions.length; i++) {
          const p = info.data.positions[i];
          invariant(p !== undefined);
          this.positions.set(p.nftTokenId.toBase58(), {
            positionsKey: item.pubkey,
            index: new Decimal(i),
            positionId: p.nftTokenId,
            lowerTick: p.lowerTick,
            upperTick: p.upperTick,
            liquity: p.liquity,
            feeGrowthInsideALast: p.feeGrowthInsideALast,
            feeGrowthInsideBLast: p.feeGrowthInsideBLast,
            tokenAFee: p.tokenAFee,
            tokenBFee: p.tokenBFee,
          });
        }
      } else {
        console.log(
          "the account:%s length:%d unkown",
          item.pubkey.toString(),
          item.account.data.length
        );
      }
    });
    if (this.authority.toString() === INIT_KEY.toString()) {
      const [authority] = await PublicKey.findProgramAddress(
        [this.tokenSwapKey.toBuffer()],
        this.programId
      );
      this.authority = authority;
    }
    if (!this.isLoaded) {
      const tokenASupply = await this.provider.connection.getTokenSupply(
        this.tokenSwapInfo.tokenAMint
      );
      const tokenBSupply = await this.provider.connection.getTokenSupply(
        this.tokenSwapInfo.tokenBMint
      );
      this.tokenSwapInfo.tokenADecimals = tokenASupply.value.decimals;
      this.tokenSwapInfo.tokenBDecimals = tokenBSupply.value.decimals;
    }
    this.isLoaded = true;
    this.currentTick = sqrtPrice2Tick(this.tokenSwapInfo.currentSqrtPrice);
    return this;
  }

  /**
   * Fetch the swap list
   */
  static async fetchSwapPairs(
    provider: Provider,
    programId: PublicKey
  ): Promise<Array<TokenSwapAccount>> {
    const config: GetProgramAccountsConfig = {
      filters: [
        {
          memcmp: {
            offset: 33,
            bytes: bs58.encode(new BN(0).toArrayLike(Buffer, "le", 1)),
          },
        },
        {
          dataSize: TOKEN_SWAP_ACCOUNT_SIZE,
        },
      ],
    };
    const accounts = await provider.connection.getProgramAccounts(
      programId,
      config
    );
    const list: TokenSwapAccount[] = [];
    accounts.forEach((v) => {
      if (isTokenSwapAccount(v.account)) {
        const info = parseTokenSwapAccount(v.pubkey, v.account);
        invariant(
          info?.data !== undefined,
          "The token swap account parse failed"
        );
        list.push(info.data);
      }
    });
    return list;
  }

  static async createTokenSwap({
    provider,
    programId,
    tokenAMint,
    tokenBMint,
    manager,
    fee,
    managerFee,
    tickSpace,
    tickAccountSize,
    initializePrice,
  }: {
    provider: Provider;
    programId: PublicKey;
    tokenAMint: PublicKey;
    tokenBMint: PublicKey;
    manager: PublicKey;
    fee: Decimal;
    managerFee: Decimal;
    tickSpace: number;
    tickAccountSize: number;
    initializePrice: Decimal;
  }): Promise<PendingCreateSwapPair> {
    // generate account create instruction that token swap need
    const instructions: TransactionInstruction[] = [];
    const swapAccount = Keypair.generate();
    const ticksAccount = Keypair.generate();
    const positionsAccount = Keypair.generate();
    const [authority, nonce] = await PublicKey.findProgramAddress(
      [swapAccount.publicKey.toBuffer()],
      programId
    );
    const ticksAccountLamports =
      await provider.connection.getMinimumBalanceForRentExemption(
        tickAccountSize
      );
    const positionsAccountLarports =
      await provider.connection.getMinimumBalanceForRentExemption(
        POSITIONS_ACCOUNT_SIZE
      );
    const swapAccountLamports =
      await provider.connection.getMinimumBalanceForRentExemption(
        TOKEN_SWAP_ACCOUNT_SIZE
      );
    // generate create token swap authority token account instruction
    const swapTokenA = await getATAAddress({
      mint: tokenAMint,
      owner: authority,
    });
    const swapTokenB = await getATAAddress({
      mint: tokenBMint,
      owner: authority,
    });
    instructions.push(
      SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: swapAccount.publicKey,
        lamports: swapAccountLamports,
        space: TOKEN_SWAP_ACCOUNT_SIZE,
        programId: programId,
      }),
      SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: ticksAccount.publicKey,
        lamports: ticksAccountLamports,
        space: tickAccountSize,
        programId: programId,
      }),
      SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey: positionsAccount.publicKey,
        lamports: positionsAccountLarports,
        space: POSITIONS_ACCOUNT_SIZE,
        programId: programId,
      })
    );

    // generate create token swap authority token account instruction
    instructions.push(
      createATAInstruction({
        address: swapTokenA,
        mint: tokenAMint,
        owner: authority,
        payer: provider.wallet.publicKey,
      }),
      createATAInstruction({
        address: swapTokenB,
        mint: tokenBMint,
        owner: authority,
        payer: provider.wallet.publicKey,
      })
    );

    // generate token swap initialize instruction
    const currentSqrtPrice = initializePrice.sqrt();
    const managerTokenA = await getATAAddress({
      mint: tokenAMint,
      owner: manager,
    });
    const managerTokenB = await getATAAddress({
      mint: tokenBMint,
      owner: manager,
    });
    const curveType = 0;
    instructions.push(
      initializeInstruction(
        programId,
        swapAccount.publicKey,
        authority,
        manager,
        managerTokenA,
        managerTokenB,
        swapTokenA,
        swapTokenB,
        ticksAccount.publicKey,
        positionsAccount.publicKey,
        nonce,
        curveType,
        fee,
        managerFee,
        tickSpace,
        currentSqrtPrice
      )
    );
    return {
      swapKey: swapAccount.publicKey,
      positionsKey: positionsAccount.publicKey,
      ticksKey: ticksAccount.publicKey,
      swapTokenA,
      swapTokenB,
      managerTokenA,
      managerTokenB,
      authority,
      tx: new TransactionEnvelope(provider, instructions, [
        swapAccount,
        ticksAccount,
        positionsAccount,
      ]),
    };
  }

  /**
   *
   * @param userTokenA The user address of token A
   * @param userTokenB The user address of token B
   * @param lowerTick The lower tick
   * @param upperTick The upper tick
   * @param liquity The liquity amount
   * @param maximumAmountA The maximum amount of Token A
   * @param maximumAmountB The maximum amount of Token B
   * @returns
   */
  async mintPosition(
    userTokenA: PublicKey,
    userTokenB: PublicKey,
    lowerTick: number,
    upperTick: number,
    liquity: Decimal,
    maximumAmountA: Decimal,
    maximumAmountB: Decimal
  ): Promise<PendingMintPosition> {
    if (this.isLoaded) {
      await this.load();
    }
    invariant(
      lowerTick < upperTick,
      "The lowerTick must be less than upperTick"
    );

    const instructions: TransactionInstruction[] = [];

    // Generate create position nft token instructions
    const positionNftMint = Keypair.generate();
    const positionAccount = await getATAAddress({
      mint: positionNftMint.publicKey,
      owner: this.provider.wallet.publicKey,
    });

    const nftMintInstructions = await createMintInstructions(
      this.provider,
      this.authority,
      positionNftMint.publicKey,
      0
    );
    instructions.push(...nftMintInstructions);
    instructions.push(
      createATAInstruction({
        address: positionAccount,
        mint: positionNftMint.publicKey,
        owner: this.provider.wallet.publicKey,
        payer: this.provider.wallet.publicKey,
      })
    );

    const positionsKey = this.choosePosition();
    invariant(positionsKey !== null, "The position account space if full");
    // Generate mint positon instruction
    instructions.push(
      depositAllTokenTypesInstruction(
        this.programId,
        this.tokenSwapKey,
        this.authority,
        this.provider.wallet.publicKey,
        userTokenA,
        userTokenB,
        this.tokenSwapInfo.swapTokenA,
        this.tokenSwapInfo.swapTokenB,
        positionNftMint.publicKey,
        positionAccount,
        this.tokenSwapInfo.ticksKey,
        positionsKey,
        0,
        lowerTick,
        upperTick,
        liquity,
        maximumAmountA,
        maximumAmountB,
        new Decimal(0)
      )
    );

    return {
      positionId: positionNftMint.publicKey,
      positionAccount,
      positionsKey,
      tx: new TransactionEnvelope(this.provider, instructions, [
        positionNftMint,
      ]),
    };
  }

  /**
   * Mint a position and you can specified a fix token amount.
   * @param userTokenA The user address of token A
   * @param userTokenB The user address of token B
   * @param fixTokenType 0-FixTokenA 1-FixTokenB
   * @param lowerTick The lower tick
   * @param upperTick The upper tick
   * @param maximumAmountA The maximum amount of Token A
   * @param maximumAmountB The maximum amount of Token B
   * @returns
   */
  async mintPositionFixToken(
    userTokenA: PublicKey,
    userTokenB: PublicKey,
    fixTokenType: number,
    lowerTick: number,
    upperTick: number,
    maximumAmountA: Decimal,
    maximumAmountB: Decimal
  ): Promise<PendingMintPosition> {
    if (this.isLoaded) {
      await this.load();
    }
    invariant(
      lowerTick < upperTick,
      "The lowerTick must be less than upperTick"
    );

    const instructions: TransactionInstruction[] = [];

    // Generate create position nft token instructions
    const positionNftMint = Keypair.generate();
    const positionAccount = await getATAAddress({
      mint: positionNftMint.publicKey,
      owner: this.provider.wallet.publicKey,
    });

    const nftMintInstructions = await createMintInstructions(
      this.provider,
      this.authority,
      positionNftMint.publicKey,
      0
    );
    instructions.push(...nftMintInstructions);
    instructions.push(
      createATAInstruction({
        address: positionAccount,
        mint: positionNftMint.publicKey,
        owner: this.provider.wallet.publicKey,
        payer: this.provider.wallet.publicKey,
      })
    );

    const positionsKey = this.choosePosition();
    invariant(positionsKey !== null, "The position account space if full");
    // Generate mint positon instruction
    instructions.push(
      depositFixTokenInstruction(
        this.programId,
        this.tokenSwapKey,
        this.authority,
        this.provider.wallet.publicKey,
        userTokenA,
        userTokenB,
        this.tokenSwapInfo.swapTokenA,
        this.tokenSwapInfo.swapTokenB,
        positionNftMint.publicKey,
        positionAccount,
        this.tokenSwapInfo.ticksKey,
        positionsKey,
        0,
        fixTokenType,
        lowerTick,
        upperTick,
        maximumAmountA,
        maximumAmountB,
        new Decimal(0)
      )
    );

    return {
      positionId: positionNftMint.publicKey,
      positionAccount,
      positionsKey,
      tx: new TransactionEnvelope(this.provider, instructions, [
        positionNftMint,
      ]),
    };
  }

  /**
   * Increase liquity on a exist position
   * @param positionId The position id (nft mint address)
   * @param userTokenA The user address of token A
   * @param userTokenB The user address of token B
   * @param liquity The liquity amount
   * @param maximumAmountA The maximum of token A
   * @param maximumAmountB The maximum of token B
   * @returns
   */
  async increaseLiquity(
    positionId: PublicKey,
    userTokenA: PublicKey,
    userTokenB: PublicKey,
    liquity: Decimal,
    maximumAmountA: Decimal,
    maximumAmountB: Decimal,
    positionAccount: PublicKey | null = null
  ): Promise<TransactionEnvelope> {
    if (!this.isLoaded) {
      await this.load();
    }
    const position = await this._checkUserPositionAccount(
      positionId,
      positionAccount
    );

    return new TransactionEnvelope(this.provider, [
      depositAllTokenTypesInstruction(
        this.programId,
        this.tokenSwapKey,
        this.authority,
        this.provider.wallet.publicKey,
        userTokenA,
        userTokenB,
        this.tokenSwapInfo.swapTokenA,
        this.tokenSwapInfo.swapTokenB,
        positionId,
        position.positionAccount,
        this.tokenSwapInfo.ticksKey,
        position.positionInfo.positionsKey,
        1,
        position.positionInfo.lowerTick,
        position.positionInfo.upperTick,
        liquity,
        maximumAmountA,
        maximumAmountB,
        position.positionInfo.index
      ),
    ]);
  }

  /**
   * Increase liquity on a exist position and you can specified a fix token amount.
   * @param positionId The position id (nft mint address)
   * @param userTokenA The user address of token A
   * @param userTokenB The user address of token B
   * @param fixTokenType The liquity amount
   * @param maximumAmountA The maximum of token A
   * @param maximumAmountB The maximum of token B
   * @returns
   */
  async increaseLiquityFixToken(
    positionId: PublicKey,
    userTokenA: PublicKey,
    userTokenB: PublicKey,
    fixTokenType: number,
    maximumAmountA: Decimal,
    maximumAmountB: Decimal,
    positionAccount: PublicKey | null = null
  ): Promise<TransactionEnvelope> {
    if (!this.isLoaded) {
      await this.load();
    }
    const position = await this._checkUserPositionAccount(
      positionId,
      positionAccount
    );

    return new TransactionEnvelope(this.provider, [
      depositFixTokenInstruction(
        this.programId,
        this.tokenSwapKey,
        this.authority,
        this.provider.wallet.publicKey,
        userTokenA,
        userTokenB,
        this.tokenSwapInfo.swapTokenA,
        this.tokenSwapInfo.swapTokenB,
        positionId,
        position.positionAccount,
        this.tokenSwapInfo.ticksKey,
        position.positionInfo.positionsKey,
        1,
        fixTokenType,
        position.positionInfo.lowerTick,
        position.positionInfo.upperTick,
        maximumAmountA,
        maximumAmountB,
        position.positionInfo.index
      ),
    ]);
  }

  /**
   * Decrease liquity, after decrease if liquity amount is zero the position will be remove
   * @param positionId The position id (nft mint address)
   * @param userTokenA The user address of token A
   * @param userTokenB The user address of token B
   * @param liquity The liquity amount
   * @param minimumAmountA The minimum amount of token A want recv
   * @param minimumAmountB The minimum amount of token b want recv
   * @returns
   */
  async decreaseLiquity(
    positionId: PublicKey,
    userTokenA: PublicKey,
    userTokenB: PublicKey,
    liquity: Decimal,
    minimumAmountA: Decimal,
    minimumAmountB: Decimal,
    positionAccount: PublicKey | null = null
  ): Promise<TransactionEnvelope> {
    if (!this.isLoaded) {
      await this.load();
    }

    const position = await this._checkUserPositionAccount(
      positionId,
      positionAccount
    );

    // Create withdrawAllTokenTypes instruction
    return new TransactionEnvelope(this.provider, [
      withdrawAllTokenTypesInstruction(
        this.programId,
        this.tokenSwapKey,
        this.authority,
        this.provider.wallet.publicKey,
        this.tokenSwapInfo.swapTokenA,
        this.tokenSwapInfo.swapTokenB,
        userTokenA,
        userTokenB,
        positionId,
        position.positionAccount,
        this.tokenSwapInfo.ticksKey,
        position.positionInfo.positionsKey,
        liquity,
        minimumAmountA,
        minimumAmountB,
        position.positionInfo.index
      ),
    ]);
  }

  /**
   * Decrease liquity, after decrease if liquity amount is zero the position will be remove,
   * if user ATA not exist, it will be create.
   * @param positionId The position id (nft mint address)
   * @param liquity The liquity amount
   * @param minimumAmountA The minimum amount of token A want recv
   * @param minimumAmountB The minimum amount of token b want recv
   * @returns
   */
  async decreaseLiquityAtomic(
    positionId: PublicKey,
    liquity: Decimal,
    minimumAmountA: Decimal,
    minimumAmountB: Decimal,
    positionAccount: PublicKey | null = null
  ): Promise<TransactionEnvelope> {
    const { address: tokenAATA, instruction: tokenAATAInstruction } =
      await getOrCreateATA({
        provider: this.provider,
        mint: this.tokenSwapInfo.tokenAMint,
        owner: this.provider.wallet.publicKey,
        payer: this.provider.wallet.publicKey,
      });
    const { address: tokenBATA, instruction: tokenBATAInstruction } =
      await getOrCreateATA({
        provider: this.provider,
        mint: this.tokenSwapInfo.tokenBMint,
        owner: this.provider.wallet.publicKey,
        payer: this.provider.wallet.publicKey,
      });
    const instructions: TransactionInstruction[] = [];
    if (tokenAATAInstruction !== null) {
      instructions.push(tokenAATAInstruction);
    }
    if (tokenBATAInstruction !== null) {
      instructions.push(tokenBATAInstruction);
    }

    const tx = await this.decreaseLiquity(
      positionId,
      tokenAATA,
      tokenBATA,
      liquity,
      minimumAmountA,
      minimumAmountB,
      positionAccount
    );

    tx.instructions.unshift(...instructions);

    return tx;
  }

  /**
   *
   * @param userSource The token that user want swap out
   * @param userDestination The token that user want swap in
   * @param direct 0-A swap B, 1-B swap A
   * @param amountIn The amount in
   * @param minimumAmountOut The minimum amount out
   * @returns
   */
  async swap(
    userSource: PublicKey,
    userDestination: PublicKey,
    direct: number,
    amountIn: Decimal,
    minimumAmountOut: Decimal
  ): Promise<TransactionEnvelope> {
    if (!this.isLoaded) {
      await this.load();
    }
    const { swapSrc, swapDst } =
      direct === SWAP_A2B
        ? {
            swapSrc: this.tokenSwapInfo.swapTokenA,
            swapDst: this.tokenSwapInfo.swapTokenB,
          }
        : {
            swapSrc: this.tokenSwapInfo.swapTokenB,
            swapDst: this.tokenSwapInfo.swapTokenA,
          };

    return new TransactionEnvelope(this.provider, [
      swapInstruction(
        this.programId,
        this.tokenSwapKey,
        this.authority,
        this.provider.wallet.publicKey,
        userSource,
        userDestination,
        swapSrc,
        swapDst,
        this.tokenSwapInfo.ticksKey,
        amountIn,
        minimumAmountOut
      ),
    ]);
  }

  /**
   * Token swap, if the dst ATA not exist it will create it.
   * @param direct 0-A swap B, 1-B swap A
   * @param amountIn The amount in
   * @param minimumAmountOut The minimum amount out
   * @returns
   */
  async swapAtomic(
    direct: number,
    amountIn: Decimal,
    minimumAmountOut: Decimal
  ): Promise<TransactionEnvelope> {
    const { srcMint, dstMint } =
      direct === SWAP_A2B
        ? {
            srcMint: this.tokenSwapInfo.tokenAMint,
            dstMint: this.tokenSwapInfo.tokenBMint,
          }
        : {
            srcMint: this.tokenSwapInfo.tokenBMint,
            dstMint: this.tokenSwapInfo.tokenAMint,
          };
    const { address: dstATA, instruction: dstATAInstruction } =
      await getOrCreateATA({
        provider: this.provider,
        mint: dstMint,
        owner: this.provider.wallet.publicKey,
        payer: this.provider.wallet.publicKey,
      });
    const instructions: TransactionInstruction[] = [];
    if (dstATAInstruction !== null) {
      instructions.push(dstATAInstruction);
    }
    const srcATA = await getATAAddress({
      mint: srcMint,
      owner: this.provider.wallet.publicKey,
    });

    const swapTx = await this.swap(
      srcATA,
      dstATA,
      direct,
      amountIn,
      minimumAmountOut
    );

    swapTx.instructions.unshift(...instructions);

    return swapTx;
  }

  async simulateSwap(amountIn: Decimal, direction: number) {
    if (!this.isLoaded) {
      await this.load();
    }
    const tx = new TransactionEnvelope(this.provider, [
      simulateSwapInstruction(
        this.programId,
        this.tokenSwapKey,
        this.tokenSwapInfo.ticksKey,
        amountIn,
        direction
      ),
    ]);

    const res = await tx.simulate();

    console.log(res);
  }

  /**
   *
   * Claim fee from specified position
   * @param positionId The NFT token public key of position
   * @param userTokenA The user address of token A
   * @param userTokenB The user address of token B
   * @param positionAccount The token account of position NFT.
   * @returns
   */
  async claim(
    positionId: PublicKey,
    userTokenA: PublicKey,
    userTokenB: PublicKey,
    positionAccount: PublicKey | null = null
  ): Promise<TransactionEnvelope> {
    if (!this.isLoaded) {
      await this.load();
    }
    const position = await this._checkUserPositionAccount(
      positionId,
      positionAccount
    );

    return new TransactionEnvelope(this.provider, [
      claimInstruction(
        this.programId,
        this.tokenSwapKey,
        this.authority,
        this.provider.wallet.publicKey,
        this.tokenSwapInfo.swapTokenA,
        this.tokenSwapInfo.swapTokenB,
        userTokenA,
        userTokenB,
        positionId,
        position.positionAccount,
        this.tokenSwapInfo.ticksKey,
        position.positionInfo.positionsKey,
        position.positionInfo.index
      ),
    ]);
  }

  /**
   *
   * Claim fee from specified position, if user ATA not exist it will create.
   * @param positionId The NFT token public key of position
   * @param positionAccount The token account of position NFT.
   * @returns
   */
  async claimAtomic(
    positionId: PublicKey,
    positionAccount: PublicKey | null = null
  ): Promise<TransactionEnvelope> {
    const { address: tokenAATA, instruction: tokenAATAInstruction } =
      await getOrCreateATA({
        provider: this.provider,
        mint: this.tokenSwapInfo.tokenAMint,
        owner: this.provider.wallet.publicKey,
        payer: this.provider.wallet.publicKey,
      });
    const { address: tokenBATA, instruction: tokenBATAInstruction } =
      await getOrCreateATA({
        provider: this.provider,
        mint: this.tokenSwapInfo.tokenBMint,
        owner: this.provider.wallet.publicKey,
        payer: this.provider.wallet.publicKey,
      });
    const instructions: TransactionInstruction[] = [];
    if (tokenAATAInstruction !== null) {
      instructions.push(tokenAATAInstruction);
    }
    if (tokenBATAInstruction !== null) {
      instructions.push(tokenBATAInstruction);
    }

    const tx = await this.claim(
      positionId,
      tokenAATA,
      tokenBATA,
      positionAccount
    );

    tx.instructions.unshift(...instructions);

    return tx;
  }

  /**
   * Claim the manager fee
   * @returns
   */
  async managerClaim(): Promise<TransactionEnvelope> {
    if (!this.isLoaded) {
      await this.load();
    }
    return new TransactionEnvelope(this.provider, [
      managerClaimInstruction(
        this.programId,
        this.tokenSwapKey,
        this.authority,
        this.provider.wallet.publicKey,
        this.tokenSwapInfo.swapTokenA,
        this.tokenSwapInfo.swapTokenB,
        this.tokenSwapInfo.managerTokenA,
        this.tokenSwapInfo.managerTokenB
      ),
    ]);
  }

  /**
   * Add a positions account for token swap
   * @returns
   */
  async addPositionsAccount(): Promise<TransactionEnvelope> {
    if (!this.isLoaded) {
      await this.load();
    }
    const positionsAccount = Keypair.generate();
    const lamports =
      await this.provider.connection.getMinimumBalanceForRentExemption(
        POSITIONS_ACCOUNT_SIZE
      );
    return new TransactionEnvelope(this.provider, [
      SystemProgram.createAccount({
        fromPubkey: this.provider.wallet.publicKey,
        newAccountPubkey: positionsAccount.publicKey,
        lamports,
        space: POSITIONS_ACCOUNT_SIZE,
        programId: this.programId,
      }),
      addUserPositionInstruction(
        this.programId,
        this.authority,
        positionsAccount.publicKey
      ),
    ]);
  }

  /**
   * Get user's positions
   * @param owner The owner of position
   * @returns The positions list
   */
  async getUserPositions(
    owner = this.provider.wallet.publicKey
  ): Promise<PositionInfo[]> {
    invariant(this.isLoaded, "The token swap not load");
    const tokenAccounts = await getTokenAccounts(
      this.provider.connection,
      owner
    );
    const positions: PositionInfo[] = [];
    tokenAccounts.forEach((v) => {
      const position = this.positions.get(v.mint.toBase58());
      if (position !== undefined) {
        positions.push(position);
      }
    });
    return positions;
  }

  /**
   * Calculate the liquity and token A amount, when the token swap currentTick < upperTick
   * @param tickLower The lower tick
   * @param tickUpper the upper tick
   * @param desiredAmountA The desired token A amount
   * @returns
   */
  calculateLiquityByTokenA(
    tickLower: number,
    tickUpper: number,
    desiredAmountA: Decimal,
    currentSqrtPrice = this.tokenSwapInfo.currentSqrtPrice
  ): { desiredAmountB: Decimal; liquity: Decimal } {
    const currentTick = sqrtPrice2Tick(currentSqrtPrice);
    invariant(this.isLoaded, "The token swap not load");
    invariant(
      currentTick <= tickUpper,
      "when current price greater than upper price, can only add token b"
    );
    if (currentTick < tickLower) {
      return {
        desiredAmountB: new Decimal(0),
        liquity: calculateLiquityOnlyA(tickLower, tickUpper, desiredAmountA),
      };
    } else {
      const res = calculateLiquity(
        tickLower,
        tickUpper,
        desiredAmountA,
        currentSqrtPrice,
        0
      );
      return {
        desiredAmountB: res.desiredAmountDst,
        liquity: res.deltaLiquity,
      };
    }
  }

  /**
   * Calculate the liquity and token B amount, when the token swap currentTick < upperTick
   * @param tickLower The lower tick
   * @param tickUpper the upper tick
   * @returns
   */
  calculateLiquityByTokenB(
    tickLower: number,
    tickUpper: number,
    desiredAmountB: Decimal,
    currentSqrtPrice = this.tokenSwapInfo.currentSqrtPrice
  ): { desiredAmountA: Decimal; liquity: Decimal } {
    const currentTick = sqrtPrice2Tick(currentSqrtPrice);
    invariant(this.isLoaded, "The token swap not load");
    invariant(
      currentTick >= tickLower,
      "when current price less than lower price, can only add token a"
    );
    if (currentTick > tickUpper) {
      return {
        desiredAmountA: new Decimal(0),
        liquity: calculateLiquityOnlyB(tickLower, tickUpper, desiredAmountB),
      };
    } else {
      const res = calculateLiquity(
        tickLower,
        tickUpper,
        desiredAmountB,
        currentSqrtPrice,
        1
      );
      return {
        desiredAmountA: res.desiredAmountDst,
        liquity: res.deltaLiquity,
      };
    }
  }

  // Calculate the liquity with price slid
  calculateLiquityWithSlid({
    lowerTick,
    upperTick,
    amountA = null,
    amountB = null,
    slid = new Decimal(0.01),
  }: {
    lowerTick: number;
    upperTick: number;
    amountA: Decimal | null;
    amountB: Decimal | null;
    slid: Decimal;
  }): {
    liquity: Decimal;
    amountA: Decimal;
    amountB: Decimal;
    maximumAmountA: Decimal;
    maximumAmountB: Decimal;
    minimumAmountA: Decimal;
    minimumAmountB: Decimal;
  } {
    invariant(amountA !== null || amountB !== null, "the amout is null");
    let liquity = new Decimal(0);

    const lamportA =
      amountA !== null ? this.tokenALamports(amountA).toDecimalPlaces(0) : null;
    const lamportB =
      amountB !== null ? this.tokenBLamports(amountB).toDecimalPlaces(0) : null;

    if (lamportA !== null) {
      liquity = this.calculateLiquityByTokenA(
        lowerTick,
        upperTick,
        lamportA
      ).liquity;
    } else {
      invariant(lamportB !== null);
      liquity = this.calculateLiquityByTokenB(
        lowerTick,
        upperTick,
        lamportB
      ).liquity;
    }

    const slidRes = calculateSlidTokenAmount(
      lowerTick,
      upperTick,
      liquity,
      this.tokenSwapInfo.currentSqrtPrice,
      slid
    );
    return {
      liquity: liquity.toDecimalPlaces(0),
      amountA: slidRes.amountA.toDecimalPlaces(0),
      amountB: slidRes.amountB.toDecimalPlaces(0),
      maximumAmountA: slidRes.maxAmountA.toDecimalPlaces(0),
      maximumAmountB: slidRes.maxAmountB.toDecimalPlaces(0),
      minimumAmountA: slidRes.minAmountA.toDecimalPlaces(0),
      minimumAmountB: slidRes.minAmountB.toDecimalPlaces(0),
    };
  }

  /**
   * Calculate the position current value
   * @param positionId The position id
   * @returns The amount of token A and token B
   */
  calculatePositionValue(positionId: PublicKey): {
    liquity: Decimal;
    amountA: Decimal;
    amountB: Decimal;
  } {
    invariant(this.isLoaded, "The token swap not load");
    const positionInfo = this.getPositionInfo(positionId);
    invariant(
      positionInfo !== undefined,
      `The position:${positionId.toBase58()} not found`
    );
    const { amountA, amountB } = calculateTokenAmount(
      positionInfo.lowerTick,
      positionInfo.upperTick,
      positionInfo.liquity,
      this.tokenSwapInfo.currentSqrtPrice
    );
    return {
      liquity: positionInfo.liquity,
      amountA,
      amountB,
    };
  }

  calculatePositionValueWithSlid(
    positionId: PublicKey,
    percentage: Decimal = new Decimal(1),
    slid: Decimal = new Decimal(0.01)
  ): {
    liquity: Decimal;
    maxAmountA: Decimal;
    minAmountA: Decimal;
    maxAmountB: Decimal;
    minAmountB: Decimal;
    amountA: Decimal;
    amountB: Decimal;
  } {
    invariant(this.isLoaded, "The token swap not load");
    invariant(
      percentage.greaterThan(0) && percentage.lessThanOrEqualTo(1),
      `Invalid pencentage:${percentage.toString()}`
    );
    const positionInfo = this.getPositionInfo(positionId);
    invariant(
      positionInfo !== undefined,
      `The position:${positionId.toBase58()} not found`
    );
    const liquity = positionInfo.liquity.mul(percentage).toDecimalPlaces(0);
    const res = calculateSlidTokenAmount(
      positionInfo.lowerTick,
      positionInfo.upperTick,
      liquity,
      this.tokenSwapInfo.currentSqrtPrice,
      slid
    );
    return {
      liquity,
      ...res,
    };
  }

  /**
   * prepare calculate claim amount of token A and B
   * @param positionId The position id
   * @returns the amount of token A and B
   */
  preClaim(positionId: PublicKey): { amountA: Decimal; amountB: Decimal } {
    invariant(this.isLoaded, "The token swap not load");
    const positionInfo = this.getPositionInfo(positionId);
    invariant(
      positionInfo !== undefined,
      `The position:${positionId.toBase58()} not found`
    );
    let lowerTick: Tick | null = null;
    let upperTick: Tick | null = null;
    for (let i = 0; i < this.ticks.length; i++) {
      const tick = this.ticks[i];
      invariant(tick !== undefined);
      if (tick.tick === positionInfo.lowerTick) {
        lowerTick = tick;
      }
      if (tick.tick === positionInfo.upperTick) {
        upperTick = tick;
      }
    }
    invariant(
      lowerTick !== null,
      `The position lower tick:${positionInfo.lowerTick} not found`
    );
    invariant(
      upperTick !== null,
      `The position upper tick:${positionInfo.upperTick} not found`
    );

    let lowerFeeOutSideA = new Decimal(0);
    let lowerFeeOutSideB = new Decimal(0);
    let upperFeeOutSideA = new Decimal(0);
    let upperFeeOutSideB = new Decimal(0);
    const currentSqrtPrice = this.tokenSwapInfo.currentSqrtPrice;

    if (lowerTick.tickPrice.lessThan(currentSqrtPrice)) {
      lowerFeeOutSideA = lowerTick.feeGrowthOutside0;
      lowerFeeOutSideB = lowerTick.feeGrowthOutside1;
    } else {
      lowerFeeOutSideA = this.tokenSwapInfo.feeGrowthGlobal0.sub(
        lowerTick.feeGrowthOutside0
      );
      lowerFeeOutSideB = this.tokenSwapInfo.feeGrowthGlobal1.sub(
        lowerTick.feeGrowthOutside1
      );
    }

    if (upperTick.tickPrice.lessThan(currentSqrtPrice)) {
      upperFeeOutSideA = this.tokenSwapInfo.feeGrowthGlobal0.sub(
        upperTick.feeGrowthOutside0
      );
      upperFeeOutSideB = this.tokenSwapInfo.feeGrowthGlobal1.sub(
        upperTick.feeGrowthOutside1
      );
    } else {
      upperFeeOutSideA = upperTick.feeGrowthOutside0;
      upperFeeOutSideB = upperTick.feeGrowthOutside1;
    }

    return {
      amountA: this.tokenSwapInfo.feeGrowthGlobal0
        .sub(lowerFeeOutSideA)
        .sub(upperFeeOutSideA)
        .sub(positionInfo.feeGrowthInsideALast)
        .mul(positionInfo.liquity)
        .add(positionInfo.tokenAFee),
      amountB: this.tokenSwapInfo.feeGrowthGlobal1
        .sub(lowerFeeOutSideB)
        .sub(upperFeeOutSideB)
        .sub(positionInfo.feeGrowthInsideBLast)
        .mul(positionInfo.liquity)
        .add(positionInfo.tokenBFee),
    };
  }

  /**
   * Prepare calculate A swap B
   * @param amountIn The amount input of token A
   * @returns amountOut:The amount out of token B, amountUsed:The used of amountIn, afterPrice:The price after calculate, afterLiquity: The liquity after calculate
   */
  preSwapA(amountIn: Decimal): {
    amountOut: Decimal;
    amountUsed: Decimal;
    feeUsed: Decimal;
    afterLiquity: Decimal;
    impactA: Decimal;
    impactB: Decimal;
    transactionPriceA: Decimal;
    transactionPriceB: Decimal;
    afterPriceA: Decimal;
    afterPriceB: Decimal;
  } {
    invariant(this.isLoaded, "The token swap not load");
    const res = calculateSwapA2B(
      this.ticks,
      this.tokenSwapInfo.currentSqrtPrice,
      this.tokenSwapInfo.fee,
      this.tokenSwapInfo.currentLiquity,
      amountIn
    );
    const currentPriceA = this.uiPrice();
    const currentPriceB = this.uiReversePrice();
    const transactionPriceA = res.amountOut.div(res.amountUsed);
    const transactionPriceB = res.amountUsed.div(res.amountOut);
    const impactA = transactionPriceA
      .sub(currentPriceA)
      .div(currentPriceA)
      .abs();
    const impactB = transactionPriceB
      .sub(currentPriceB)
      .div(currentPriceB)
      .abs();

    const afterPriceA = res.afterPrice.pow(2);
    const afterPriceB = new Decimal(1).div(afterPriceA);

    return {
      amountOut: res.amountOut,
      amountUsed: res.amountUsed,
      feeUsed: res.feeUsed,
      afterPriceA,
      afterPriceB,
      afterLiquity: res.afterLiquity,
      impactA,
      impactB,
      transactionPriceA,
      transactionPriceB,
    };
  }

  /**
   * Prepare calculate B swap A
   * @param amountIn The amount input of token B
   * @returns amountOut:The amount out of token A, amountUsed:The used of amountIn, afterPrice:The price after calculate, afterLiquity: The liquity after calculate
   */
  preSwapB(amountIn: Decimal): {
    amountOut: Decimal;
    amountUsed: Decimal;
    feeUsed: Decimal;
    afterLiquity: Decimal;
    impactA: Decimal;
    impactB: Decimal;
    transactionPriceA: Decimal;
    transactionPriceB: Decimal;
    afterPriceA: Decimal;
    afterPriceB: Decimal;
  } {
    invariant(this.isLoaded, "The token swap not load");
    const res = calculateSwapB2A(
      this.ticks,
      this.tokenSwapInfo.currentSqrtPrice,
      this.tokenSwapInfo.fee,
      this.tokenSwapInfo.currentLiquity,
      amountIn
    );
    const currentPriceA = this.tokenSwapInfo.currentSqrtPrice.pow(2);
    const currentPriceB = new Decimal(1).div(currentPriceA);
    const transactionPriceA = res.amountUsed.div(res.amountOut);
    const transactionPriceB = res.amountOut.div(res.amountUsed);
    const impactA = transactionPriceA
      .sub(currentPriceA)
      .div(currentPriceA)
      .abs();
    const impactB = transactionPriceB
      .sub(currentPriceB)
      .div(currentPriceB)
      .abs();
    const afterPriceA = res.afterPrice.pow(2);
    const afterPriceB = new Decimal(1).div(afterPriceA);

    return {
      amountOut: res.amountOut,
      amountUsed: res.amountUsed,
      feeUsed: res.feeUsed,
      afterLiquity: res.afterLiquity,
      impactA,
      impactB,
      transactionPriceA,
      transactionPriceB,
      afterPriceA,
      afterPriceB,
    };
  }

  /**
   * Get nearest tick by price
   * @param price The price
   * @returns The tick
   */
  getNearestTickByPrice(price: Decimal): number {
    invariant(this.isLoaded, "The token swap not load");
    return getNearestTickByPrice(price, this.tokenSwapInfo.tickSpace);
  }

  /* @internal */
  getPositionInfo(positionId: PublicKey): PositionInfo | undefined {
    invariant(this.isLoaded, "The token swap not load");
    return this.positions.get(positionId.toBase58());
  }

  /* @internal */
  choosePosition(): PublicKey | null {
    invariant(this.isLoaded, "The token swap not load");
    for (const [key, val] of this.positionsKeys) {
      if (val < MAX_ACCOUNT_POSITION_LENGTH) {
        return key;
      }
    }
    return null;
  }

  uiPrice(): Decimal {
    invariant(this.isLoaded, "The token swap not load");
    return lamportPrice2uiPrice(
      this.tokenSwapInfo.currentSqrtPrice.pow(2),
      this.tokenSwapInfo.tokenADecimals,
      this.tokenSwapInfo.tokenBDecimals
    );
  }

  uiReversePrice(): Decimal {
    invariant(this.isLoaded, "The token swap not load");
    return new Decimal(1).div(this.uiPrice());
  }

  uiPrice2SwapPrice(price: Decimal): Decimal {
    invariant(this.isLoaded, "The token swap not load");
    return uiPrice2LamportPrice(
      price,
      this.tokenSwapInfo.tokenADecimals,
      this.tokenSwapInfo.tokenBDecimals
    );
  }

  uiPrice2SwapSqrtPrice(price: Decimal): Decimal {
    invariant(this.isLoaded, "The token swap not load");
    return uiPrice2LamportPrice(
      price,
      this.tokenSwapInfo.tokenADecimals,
      this.tokenSwapInfo.tokenBDecimals
    ).sqrt();
  }

  uiReversePrice2SwapPrice(price: Decimal): Decimal {
    invariant(this.isLoaded, "The token swap not load");
    return uiPrice2LamportPrice(
      new Decimal(1).div(price),
      this.tokenSwapInfo.tokenADecimals,
      this.tokenSwapInfo.tokenBDecimals
    );
  }

  uiReversePrice2SwapSqrtPrice(price: Decimal): Decimal {
    invariant(this.isLoaded, "The token swap not load");
    return uiPrice2LamportPrice(
      new Decimal(1).div(price),
      this.tokenSwapInfo.tokenADecimals,
      this.tokenSwapInfo.tokenBDecimals
    ).sqrt();
  }

  uiPrice2Tick(price: Decimal): number {
    invariant(this.isLoaded, "The token swap not load");
    return uiPrice2Tick(
      price,
      this.tokenSwapInfo.tokenADecimals,
      this.tokenSwapInfo.tokenBDecimals
    );
  }

  uiReversePrice2Tick(price: Decimal): number {
    invariant(this.isLoaded, "The token swap not load");
    return uiPrice2Tick(
      new Decimal(1).div(price),
      this.tokenSwapInfo.tokenADecimals,
      this.tokenSwapInfo.tokenBDecimals
    );
  }

  uiPrice2NearestTick(price: Decimal): number {
    invariant(this.isLoaded, "The token swap not load");
    const swapPrice = uiPrice2LamportPrice(
      price,
      this.tokenSwapInfo.tokenADecimals,
      this.tokenSwapInfo.tokenBDecimals
    );
    return this.getNearestTickByPrice(swapPrice);
  }

  uiReversePrice2NearestTick(price: Decimal): number {
    invariant(this.isLoaded, "The token swap not load");
    const swapPrice = uiPrice2LamportPrice(
      new Decimal(1).div(price),
      this.tokenSwapInfo.tokenADecimals,
      this.tokenSwapInfo.tokenBDecimals
    );
    return this.getNearestTickByPrice(swapPrice);
  }

  tick2UiPrice(tick: number): Decimal {
    invariant(this.isLoaded, "The token swap not load");
    return tick2UiPrice(
      tick,
      this.tokenSwapInfo.tokenADecimals,
      this.tokenSwapInfo.tokenBDecimals
    );
  }

  tick2UiReversePrice(tick: number): Decimal {
    invariant(this.isLoaded, "The token swap not load");
    return new Decimal(1).div(
      tick2UiPrice(
        tick,
        this.tokenSwapInfo.tokenADecimals,
        this.tokenSwapInfo.tokenBDecimals
      )
    );
  }

  tokenALamports(amount: Decimal): Decimal {
    return amount
      .mul(new Decimal(10).pow(this.tokenSwapInfo.tokenADecimals))
      .toDecimalPlaces(0);
  }

  tokenBLamports(amount: Decimal): Decimal {
    return amount
      .mul(new Decimal(10).pow(this.tokenSwapInfo.tokenBDecimals))
      .toDecimalPlaces(0);
  }

  tokenAAmount(lamport: Decimal): Decimal {
    return lamport
      .toDecimalPlaces(0)
      .div(new Decimal(10).pow(this.tokenSwapInfo.tokenADecimals));
  }

  tokenBAmount(lamport: Decimal): Decimal {
    return lamport
      .toDecimalPlaces(0)
      .div(new Decimal(10).pow(this.tokenSwapInfo.tokenBDecimals));
  }

  calculateEffectivTick(
    lowerPrice: Decimal,
    upperPrice: Decimal
  ): {
    lowerTick: number;
    upperTick: number;
  } {
    invariant(
      upperPrice.greaterThan(lowerPrice),
      "The upper price must greater than lower price"
    );
    let lowerTick = this.uiPrice2NearestTick(lowerPrice);
    let upperTick = this.uiPrice2NearestTick(upperPrice);
    if (lowerTick === upperTick) {
      const realLowerTick = this.uiPrice2Tick(lowerPrice);
      const realUpperTick = this.uiPrice2Tick(upperPrice);
      if (
        Math.abs(realUpperTick - lowerTick) >
        Math.abs(realLowerTick - lowerTick)
      ) {
        upperTick += this.tokenSwapInfo.tickSpace;
      } else {
        lowerTick -= this.tokenSwapInfo.tickSpace;
      }
    }
    return {
      lowerTick,
      upperTick,
    };
  }

  calculateFixSideTokenAmount(
    lowerTick: number,
    upperTick: number,
    amountA: Decimal | null,
    amountB: Decimal | null,
    slid: Decimal = new Decimal(0.01)
  ): {
    desiredAmountA: Decimal;
    desiredAmountB: Decimal;
    maxAmountA: Decimal;
    maxAmountB: Decimal;
    desiredDeltaLiquity: Decimal;
    maxDeltaLiquity: Decimal;
    fixTokenType: number;
    slidPrice: Decimal;
  } {
    let maxAmountA = new Decimal(0);
    let maxAmountB = new Decimal(0);
    let desiredAmountA = new Decimal(0);
    let desiredAmountB = new Decimal(0);
    let desiredDeltaLiquity = new Decimal(0);
    let maxDeltaLiquity = new Decimal(0);
    let fixTokenType = FIX_TOKEN_A;
    let slidSqrtPrice = new Decimal(0);
    // Fix token a
    if (amountA !== null) {
      const lamportsA = this.tokenALamports(amountA);
      desiredAmountA = lamportsA;
      maxAmountA = lamportsA;
      const res = this.calculateLiquityByTokenA(
        lowerTick,
        upperTick,
        lamportsA
      );
      desiredAmountB = res.desiredAmountB;
      desiredDeltaLiquity = res.liquity;

      slidSqrtPrice = this.tokenSwapInfo.currentSqrtPrice.mul(
        new Decimal(1).add(slid).sqrt()
      );
      if (slidSqrtPrice.greaterThanOrEqualTo(tick2SqrtPrice(upperTick))) {
        // FIX: Here will be crash, need change to another value
        slidSqrtPrice = tick2SqrtPrice(upperTick);
      }
      const slidRes = this.calculateLiquityByTokenA(
        lowerTick,
        upperTick,
        lamportsA,
        slidSqrtPrice
      );
      maxAmountB = slidRes.desiredAmountB;
      maxDeltaLiquity = slidRes.liquity;
    } else {
      invariant(
        amountB !== null,
        "You must specified the amount of token A or token B"
      );
      const lamportsB = this.tokenBLamports(amountB);
      fixTokenType = FIX_TOKEN_B;
      desiredAmountB = lamportsB;
      maxAmountB = lamportsB;
      const res = this.calculateLiquityByTokenB(
        lowerTick,
        upperTick,
        lamportsB
      );
      desiredAmountA = res.desiredAmountA;
      desiredDeltaLiquity = res.liquity;

      slidSqrtPrice = this.tokenSwapInfo.currentSqrtPrice.mul(
        new Decimal(1).sub(slid).sqrt()
      );
      if (slidSqrtPrice.lessThanOrEqualTo(tick2SqrtPrice(lowerTick))) {
        // FIX: Here will be crash, need change to another value
        slidSqrtPrice = tick2SqrtPrice(lowerTick);
      }
      const slidRes = this.calculateLiquityByTokenB(
        lowerTick,
        upperTick,
        lamportsB,
        slidSqrtPrice
      );
      maxAmountA = slidRes.desiredAmountA;
      maxDeltaLiquity = slidRes.liquity;
    }

    return {
      desiredAmountA,
      desiredAmountB,
      maxAmountA,
      maxAmountB,
      desiredDeltaLiquity,
      maxDeltaLiquity,
      fixTokenType,
      slidPrice: this.tick2UiPrice(sqrtPrice2Tick(slidSqrtPrice)),
    };
  }

  private async _checkUserPositionAccount(
    positionId: PublicKey,
    positionAccount: PublicKey | null
  ): Promise<{
    positionInfo: PositionInfo;
    positionAccount: PublicKey;
  }> {
    if (!this.isLoaded) {
      await this.load();
    }
    const positionInfo = this.getPositionInfo(positionId);
    invariant(
      positionInfo !== undefined,
      `Position:${positionId.toString()} not found`
    );
    if (positionAccount === null) {
      positionAccount = await getATAAddress({
        mint: positionId,
        owner: this.provider.wallet.publicKey,
      });
    }
    const positionAccountInfo = await getTokenAccount(
      this.provider,
      positionAccount
    );
    invariant(
      positionAccountInfo.mint.toString() === positionId.toString(),
      `Invalid position account:${positionAccount.toBase58()}`
    );
    invariant(
      positionAccountInfo.amount.toNumber() === 1,
      `You not hold this position:${positionId.toBase58()}`
    );
    return {
      positionInfo,
      positionAccount,
    };
  }
}

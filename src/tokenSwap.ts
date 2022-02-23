import Decimal from "decimal.js";
import invariant from "tiny-invariant";
import { sendAndConfirmTransaction } from "./util";
import { TransactionSignature } from "@solana/web3.js";
import { MintLayout, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  addUserPositionInstruction,
  claimInstruction,
  depositAllTokenTypesInstruction,
  initializeInstruction,
  managerClaimInstruction,
  swapInstruction,
  withdrawAllTokenTypesInstruction,
  simulateSwapInstruction,
} from "./instructions";
import {
  TICKS_ACCOUNT_SIZE,
  POSITIONS_ACCOUNT_SIZE,
  TOKEN_SWAP_ACCOUNT_SIZE,
  MAX_ACCOUNT_POSITION_LENGTH,
} from "./state";
import {
  Connection,
  PublicKey,
  Signer,
  Keypair,
  GetProgramAccountsConfig,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  isPositionsAccount,
  isTicksAccount,
  isTokenSwapAccount,
  parsePositionsAccount,
  parseTicksAccount,
  parseTokenSwapAccount,
  Tick,
  TokenSwapAccount,
} from "./state";
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getTokenAccounts,
} from "./util/token";
import {
  sqrtPrice2Tick,
  calculateLiquity,
  calculateLiquityOnlyA,
  calculateLiquityOnlyB,
  getNearestTickByPrice,
  calculateTokenAmount,
  calculateSwapA2B,
  calculateSwapB2A,
} from "./math";

export const INIT_KEY = new PublicKey("11111111111111111111111111111111");

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

Decimal.config({
  precision: 64,
  rounding: Decimal.ROUND_HALF_DOWN,
  toExpNeg: -64,
  toExpPos: 64,
});

/**
 * The token swap class
 */
export class TokenSwap {
  private conn: Connection;
  private programId: PublicKey = INIT_KEY;
  private tokenSwapKey: PublicKey = INIT_KEY;
  public payer: Signer | null;
  public authority: PublicKey = INIT_KEY;
  public isLoaded: boolean = false;
  public currentTick: number = 0;
  public tokenSwapInfo: TokenSwapAccount = {
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
  };
  public ticks: Tick[] = [];
  public positions: Map<string, PositionInfo>;
  public positionsKeys: Map<PublicKey, number>;

  /**
   * The constructor of TokenSwap
   * @param conn The connection to use
   * @param programId The token swap program id
   * @param tokenSwapKey The token swap key
   * @param payer The default pays for the transaction
   */
  constructor(
    conn: Connection,
    programId: PublicKey,
    tokenSwapKey: PublicKey,
    payer: Signer | null
  ) {
    this.conn = conn;
    this.tokenSwapKey = tokenSwapKey;
    this.programId = programId;
    this.payer = payer;
    this.positions = new Map();
    this.positionsKeys = new Map();
  }

  /**
   * Set the default payer
   * @returns
   */
  setDefaultPayer(payer: Signer) {
    this.payer = payer;
  }

  /**
   * Load the token swap info
   */
  async load(): Promise<TokenSwap> {
    let config: GetProgramAccountsConfig = {
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
    let accounts = await this.conn.getProgramAccounts(this.programId, config);
    accounts.map((item) => {
      if (isTokenSwapAccount(item.account)) {
        let info = parseTokenSwapAccount(item.pubkey, item.account);
        invariant(
          info?.data !== undefined,
          "The token swap account parse failed"
        );
        this.tokenSwapInfo = info.data;
      } else if (isTicksAccount(item.account)) {
        let info = parseTicksAccount(item.pubkey, item.account);
        invariant(info?.data !== undefined, "The tick account parse failed");
        this.ticks = info.data.ticks;
      } else if (isPositionsAccount(item.account)) {
        let info = parsePositionsAccount(item.pubkey, item.account);
        invariant(
          info?.data !== undefined,
          "The position account data parse failed"
        );
        this.positionsKeys.set(item.pubkey, info.data.positions.length);
        for (let i = 0; i < info.data.positions.length; i++) {
          let p = info.data.positions[i];
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
    this.isLoaded = true;
    this.currentTick = sqrtPrice2Tick(this.tokenSwapInfo.currentSqrtPrice);
    return this;
  }

  /**
   * Create a new token swap
   * @param conn The connection to use
   * @param programId The token swap program id
   * @param payer Pays for the transaction
   * @param tokenAMint The token A mint
   * @param tokenBMint The token B mint
   * @param manager The manager
   * @param fee The fee of token swap
   * @param managerFee The manager(protocol) fee of token swap
   * @param tickSpace The tick space
   * @param initializePrice The initilized price of token swap
   * @param payer The pays for the transaction
   */
  static async createTokenSwap(
    conn: Connection,
    programId: PublicKey,
    tokenAMint: PublicKey,
    tokenBMint: PublicKey,
    manager: PublicKey,
    fee: Decimal,
    managerFee: Decimal,
    tickSpace: number,
    initializePrice: Decimal,
    payer: Signer,
    isDebug: boolean = false
  ): Promise<TokenSwap> {
    // generate account create instruction that token swap need
    const tokenSwapAccount = Keypair.generate();
    const ticksAccount = Keypair.generate();
    const positionsAccount = Keypair.generate();
    const [authority, nonce] = await PublicKey.findProgramAddress(
      [tokenSwapAccount.publicKey.toBuffer()],
      programId
    );
    const ticksAccountLamports = await conn.getMinimumBalanceForRentExemption(
      TICKS_ACCOUNT_SIZE
    );
    const positionsAccountLarports = await conn.getMinimumBalanceForRentExemption(
      POSITIONS_ACCOUNT_SIZE
    );
    const tokenSwapAccountLamports = await conn.getMinimumBalanceForRentExemption(
      TOKEN_SWAP_ACCOUNT_SIZE
    );
    let transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: tokenSwapAccount.publicKey,
        lamports: tokenSwapAccountLamports,
        space: TOKEN_SWAP_ACCOUNT_SIZE,
        programId: programId,
      }),
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: ticksAccount.publicKey,
        lamports: ticksAccountLamports,
        space: TICKS_ACCOUNT_SIZE,
        programId: programId,
      }),
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: positionsAccount.publicKey,
        lamports: positionsAccountLarports,
        space: POSITIONS_ACCOUNT_SIZE,
        programId: programId,
      })
    );

    // generate create token swap authority token account instruction
    let swapTokenA = await getAssociatedTokenAddress(tokenAMint, authority);
    let swapTokenB = await getAssociatedTokenAddress(tokenBMint, authority);
    transaction.add(
      createAssociatedTokenAccountInstruction(
        tokenAMint,
        swapTokenA,
        authority,
        payer.publicKey
      ),
      createAssociatedTokenAccountInstruction(
        tokenBMint,
        swapTokenB,
        authority,
        payer.publicKey
      )
    );

    // generate token swap initialize instruction
    const currentSqrtPrice = initializePrice.sqrt();
    const tokenA = new Token(conn, tokenAMint, TOKEN_PROGRAM_ID, payer);
    const tokenB = new Token(conn, tokenBMint, TOKEN_PROGRAM_ID, payer);
    const managerTokenA = await tokenA.getOrCreateAssociatedAccountInfo(
      manager
    );
    const managerTokenB = await tokenB.getOrCreateAssociatedAccountInfo(
      manager
    );

    const curveType = 0;
    transaction.add(
      initializeInstruction(
        programId,
        tokenSwapAccount.publicKey,
        authority,
        manager,
        managerTokenA.address,
        managerTokenB.address,
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

    // send and confirm transaction
    const tx = await sendAndConfirmTransaction(
      conn,
      transaction,
      payer,
      tokenSwapAccount,
      ticksAccount,
      positionsAccount
    );
    if (isDebug) {
      console.log(tx);
    }

    return await new TokenSwap(
      conn,
      programId,
      tokenSwapAccount.publicKey,
      payer
    ).load();
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
   * @param userTransferAuthroity The pays for the transaction
   * @returns
   */
  async mintPosition(
    userTokenA: PublicKey,
    userTokenB: PublicKey,
    lowerTick: number,
    upperTick: number,
    liquity: Decimal,
    maximumAmountA: Decimal,
    maximumAmountB: Decimal,
    userTransferAuthroity: Signer,
    payer: Signer | null = null
  ): Promise<TransactionSignature | null> {
    if (this.isLoaded) {
      await this.load();
    }
    invariant(
      lowerTick < upperTick,
      "The lowerTick must be less than upperTick"
    );
    payer = payer != null ? payer : this.payer;
    invariant(payer != null, "The payer is null");

    // Generate create position nft token instructions
    const nftMintAccount = Keypair.generate();
    const nftUser = await getAssociatedTokenAddress(
      nftMintAccount.publicKey,
      payer.publicKey
    );
    const accountLamports = await Token.getMinBalanceRentForExemptAccount(
      this.conn
    );
    const positionsKey = this.choosePosition();
    invariant(positionsKey != null, "The position account space is full");
    let transaction = new Transaction();
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: nftMintAccount.publicKey,
        lamports: accountLamports,
        space: MintLayout.span,
        programId: TOKEN_PROGRAM_ID,
      }),
      Token.createInitMintInstruction(
        TOKEN_PROGRAM_ID,
        nftMintAccount.publicKey,
        0,
        this.authority,
        null
      ),
      createAssociatedTokenAccountInstruction(
        nftMintAccount.publicKey,
        nftUser,
        payer.publicKey,
        payer.publicKey
      )
    );

    // Generate mint positon instruction
    transaction.add(
      depositAllTokenTypesInstruction(
        this.programId,
        this.tokenSwapKey,
        this.authority,
        userTransferAuthroity.publicKey,
        userTokenA,
        userTokenB,
        this.tokenSwapInfo.swapTokenA,
        this.tokenSwapInfo.swapTokenB,
        nftMintAccount.publicKey,
        nftUser,
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

    // send and confirm transaction
    return await sendAndConfirmTransaction(
      this.conn,
      transaction,
      payer,
      userTransferAuthroity,
      nftMintAccount
    );
  }

  /**
   * Increase liquity on a exist position
   * @param positionId The position id (nft mint address)
   * @param userTokenA The user address of token A
   * @param userTokenB The user address of token B
   * @param lowerTick The lower tick
   * @param upperTick The upper tick
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
    payer: Signer | null = null
  ): Promise<TransactionSignature | null> {
    if (!this.isLoaded) {
      await this.load();
    }
    const positionInfo = this.getPositionInfo(positionId);
    invariant(positionInfo != undefined, `Position:${positionId} not found`);
    payer = payer != null ? payer : this.payer;
    invariant(payer !== null, "The payer is null");

    let nftToken = new Token(this.conn, positionId, TOKEN_PROGRAM_ID, payer);
    let nftUser = await nftToken.getAccountInfo(
      await getAssociatedTokenAddress(nftToken.publicKey, payer.publicKey)
    );
    invariant(
      nftUser.amount.toNumber() === 1,
      `You not hold this position:${nftToken.publicKey.toBase58()}`
    );

    // Generate mint positon instruction
    let transaction = new Transaction();
    transaction.add(
      depositAllTokenTypesInstruction(
        this.programId,
        this.tokenSwapKey,
        this.authority,
        payer.publicKey,
        userTokenA,
        userTokenB,
        this.tokenSwapInfo.swapTokenA,
        this.tokenSwapInfo.swapTokenB,
        positionId,
        nftUser.address,
        this.tokenSwapInfo.ticksKey,
        positionInfo.positionsKey,
        1,
        positionInfo.lowerTick,
        positionInfo.upperTick,
        liquity,
        maximumAmountA,
        maximumAmountB,
        positionInfo.index
      )
    );

    // send and confirm transaction
    return await sendAndConfirmTransaction(this.conn, transaction, payer);
  }

  /**
   * Decrease liquity, after decrease if liquity amount is zero the position will be remove
   * @param positionId The position id (nft mint address)
   * @param userTokenA The user address of token A
   * @param userTokenB The user address of token B
   * @param liquity The liquity amount
   * @param minimumAmountA The minimum amount of token A want recv
   * @param minimumAmountB The minimum amount of token b want recv
   * @param userAuthroity The pays for the transaction
   * @returns
   */
  async decreaseLiquity(
    positionId: PublicKey,
    userTokenA: PublicKey,
    userTokenB: PublicKey,
    liquity: Decimal,
    minimumAmountA: Decimal,
    minimumAmountB: Decimal,
    payer: Signer | null = null
  ): Promise<TransactionSignature | null> {
    if (!this.isLoaded) {
      await this.load();
    }
    const positionInfo = this.getPositionInfo(positionId);
    invariant(positionInfo != undefined, `Position:${positionId} not found`);
    payer = payer != null ? payer : this.payer;
    invariant(payer !== null, "The payer is null");
    let nftToken = new Token(this.conn, positionId, TOKEN_PROGRAM_ID, payer);
    let nftUser = await nftToken.getAccountInfo(
      await getAssociatedTokenAddress(nftToken.publicKey, payer.publicKey)
    );
    invariant(
      nftUser.amount.toNumber() === 1,
      `You not hold this position:${nftToken.publicKey.toBase58()}`
    );

    // Create withdrawAllTokenTypes instruction
    let transaction = new Transaction().add(
      withdrawAllTokenTypesInstruction(
        this.programId,
        this.tokenSwapKey,
        this.authority,
        payer.publicKey,
        this.tokenSwapInfo.swapTokenA,
        this.tokenSwapInfo.swapTokenB,
        userTokenA,
        userTokenB,
        positionId,
        nftUser.address,
        this.tokenSwapInfo.ticksKey,
        positionInfo.positionsKey,
        liquity,
        minimumAmountA,
        minimumAmountB,
        positionInfo.index
      )
    );

    // send and confirm transaction
    return await sendAndConfirmTransaction(this.conn, transaction, payer);
  }

  /**
   *
   * @param userSource The token that user want swap out
   * @param userDestination The token that user want swap in
   * @param direct 0-A swap B, 1-B swap A
   * @param amountIn The amount in
   * @param minimumAmountOut The minimum amount out
   * @param userTransactionAuthority Account delegated to transfer user's tokens
   * @returns
   */
  async swap(
    userSource: PublicKey,
    userDestination: PublicKey,
    direct: number,
    amountIn: Decimal,
    minimumAmountOut: Decimal,
    userTransferAuthority: Signer,
    payer: Signer | null = null
  ): Promise<TransactionSignature | null> {
    if (!this.isLoaded) {
      await this.load();
    }
    payer = payer != null ? payer : this.payer;
    invariant(payer !== null, "The payer is null");
    let { swapSrc, swapDst } =
      direct === 1
        ? {
            swapSrc: this.tokenSwapInfo.swapTokenA,
            swapDst: this.tokenSwapInfo.swapTokenB,
          }
        : {
            swapSrc: this.tokenSwapInfo.swapTokenB,
            swapDst: this.tokenSwapInfo.swapTokenA,
          };

    let transaction = new Transaction().add(
      swapInstruction(
        this.programId,
        this.tokenSwapKey,
        this.authority,
        userTransferAuthority.publicKey,
        userSource,
        userDestination,
        swapSrc,
        swapDst,
        this.tokenSwapInfo.ticksKey,
        amountIn,
        minimumAmountOut
      )
    );

    // send and confirm transaction
    return await sendAndConfirmTransaction(
      this.conn,
      transaction,
      payer,
      userTransferAuthority
    );
  }

  async simulateSwap(amountIn: Decimal, direction: number, payer: Signer) {
    if (!this.isLoaded) {
      await this.load();
    }
    let transaction = new Transaction().add(
      simulateSwapInstruction(
        this.programId,
        this.tokenSwapKey,
        this.tokenSwapInfo.ticksKey,
        amountIn,
        direction
      )
    );

    let res = await this.conn.simulateTransaction(transaction, [payer]);
    console.log(res);
  }

  /**
   *
   * Collect fee from specified position
   * @param positionID The NFT token public key of position
   * @param userTokenA The user address of token A
   * @param userTokenB The user address of token B
   * @param userAuthroity The pays for the transaction
   * @returns
   */
  async collect(
    positionId: PublicKey,
    userTokenA: PublicKey,
    userTokenB: PublicKey,
    payer: Signer | null = null
  ): Promise<TransactionSignature | null> {
    if (!this.isLoaded) {
      await this.load();
    }
    const positionInfo = this.getPositionInfo(positionId);
    invariant(positionInfo != undefined, `Position:${positionId} not found`);
    payer = payer != null ? payer : this.payer;
    invariant(payer !== null, "The payer is null");
    let nftToken = new Token(this.conn, positionId, TOKEN_PROGRAM_ID, payer);
    let nftUser = await nftToken.getAccountInfo(
      await getAssociatedTokenAddress(nftToken.publicKey, payer.publicKey)
    );
    invariant(
      nftUser.amount.toNumber() === 1,
      `You not hold this position:${nftToken.publicKey.toBase58()}`
    );

    let transaction = new Transaction().add(
      claimInstruction(
        this.programId,
        this.tokenSwapKey,
        this.authority,
        payer.publicKey,
        this.tokenSwapInfo.swapTokenB,
        this.tokenSwapInfo.swapTokenB,
        userTokenA,
        userTokenB,
        positionId,
        nftUser.address,
        this.tokenSwapInfo.ticksKey,
        positionInfo.positionsKey,
        positionInfo.index
      )
    );

    // send and confirm transaction
    return await sendAndConfirmTransaction(this.conn, transaction, payer);
  }

  /**
   * Collect the manager fee
   * @param userTokenA The manager address of token A
   * @param userTokenB The manager address of token B
   * @param userAuthroity The pays for the transaction
   * @returns
   */
  async managerCollect(
    userTokenA: PublicKey,
    userTokenB: PublicKey,
    payer: Signer | null = null
  ): Promise<TransactionSignature | null> {
    if (!this.isLoaded) {
      await this.load();
    }
    payer = payer != null ? payer : this.payer;
    invariant(payer !== null, "The payer is null");
    let transaction = new Transaction().add(
      managerClaimInstruction(
        this.programId,
        this.tokenSwapKey,
        this.authority,
        payer.publicKey,
        this.tokenSwapInfo.swapTokenA,
        this.tokenSwapInfo.swapTokenB,
        userTokenA,
        userTokenB
      )
    );

    // send and confirm transaction
    return await sendAndConfirmTransaction(this.conn, transaction, payer);
  }

  /**
   * Add a positions account for token swap
   * @param payer The pays for transaction
   * @returns
   */
  async addPositionsAccount(
    payer: Signer | null = null
  ): Promise<TransactionSignature | null> {
    if (!this.isLoaded) {
      await this.load();
    }
    payer = payer != null ? payer : this.payer;
    invariant(payer !== null, "The payer is null");
    let positionsAccount = Keypair.generate();
    let lamports = await this.conn.getMinimumBalanceForRentExemption(
      POSITIONS_ACCOUNT_SIZE
    );
    let transaction = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: positionsAccount.publicKey,
        lamports,
        space: POSITIONS_ACCOUNT_SIZE,
        programId: this.programId,
      }),
      addUserPositionInstruction(
        this.programId,
        this.authority,
        positionsAccount.publicKey
      )
    );

    return await sendAndConfirmTransaction(
      this.conn,
      transaction,
      payer,
      positionsAccount
    );
  }

  async approve(
    userToken: PublicKey,
    tokenMint: PublicKey,
    amount: Decimal,
    authority: Signer,
    payer: Signer | null = null
  ): Promise<void> {
    payer = payer != null ? payer : this.payer;
    invariant(payer !== null, "The payer is null");
    let token = new Token(this.conn, tokenMint, TOKEN_PROGRAM_ID, payer);
    await token.approve(
      userToken,
      authority.publicKey,
      payer,
      [],
      amount.toNumber()
    );
  }

  /**
   * Get user's positions
   * @param owner The owner of position
   * @returns The positions list
   */
  async getUserPositions(
    owner: PublicKey | undefined = undefined
  ): Promise<PositionInfo[] | null> {
    invariant(this.isLoaded, "The token swap not load");
    owner = owner != undefined ? owner : this.payer?.publicKey;
    invariant(owner !== undefined, "The owner is undefined");
    let tokenAccounts = await getTokenAccounts(this.conn, owner);
    let positions: PositionInfo[] = [];
    for (let i = 0; i < tokenAccounts.length; i++) {
      let position = this.positions.get(tokenAccounts[i].mint.toBase58());
      if (position !== undefined) {
        positions.push(position);
      }
    }
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
    desiredAmountA: Decimal
  ): { desiredAmountB: Decimal; liquity: Decimal } {
    invariant(this.isLoaded, "The token swap not load");
    invariant(
      this.currentTick <= tickUpper,
      "The current price must less than lower price"
    );
    if (this.currentTick < tickLower) {
      return {
        desiredAmountB: new Decimal(0),
        liquity: calculateLiquityOnlyA(tickLower, tickUpper, desiredAmountA),
      };
    } else {
      let res = calculateLiquity(
        tickLower,
        tickUpper,
        desiredAmountA,
        this.tokenSwapInfo.currentSqrtPrice,
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
   * @param desiredAmountA The desired token B amount
   * @returns
   */
  calculateLiquityByTokenB(
    tickLower: number,
    tickUpper: number,
    desiredAmountB: Decimal
  ): { desiredAmountA: Decimal; liquity: Decimal } {
    invariant(this.isLoaded, "The token swap not load");
    invariant(
      this.currentTick >= tickLower,
      "The current price must less than lower price"
    );
    if (this.currentTick < tickUpper) {
      return {
        desiredAmountA: new Decimal(0),
        liquity: calculateLiquityOnlyB(tickLower, tickUpper, desiredAmountB),
      };
    } else {
      let res = calculateLiquity(
        tickLower,
        tickUpper,
        desiredAmountB,
        this.tokenSwapInfo.currentSqrtPrice,
        1
      );
      return {
        desiredAmountA: res.desiredAmountDst,
        liquity: res.deltaLiquity,
      };
    }
  }

  /**
   * Calculate the position current value
   * @param positionId The position id
   * @returns The amount of token A and token B
   */
  calculatePositionValue(
    positionId: PublicKey
  ): { liquity: Decimal; amountA: Decimal; amountB: Decimal } {
    invariant(this.isLoaded, "The token swap not load");
    const positionInfo = this.getPositionInfo(positionId);
    invariant(
      positionInfo !== undefined,
      `The position:${positionId.toBase58()} not found`
    );
    let { amountA, amountB } = calculateTokenAmount(
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

  /**
   * prepare calculate collect amount of token A and B
   * @param positionId The position id
   * @returns the amount of token A and B
   */
  preCollect(positionId: PublicKey): { amountA: Decimal; amountB: Decimal } {
    invariant(this.isLoaded, "The token swap not load");
    const positionInfo = this.getPositionInfo(positionId);
    invariant(
      positionInfo !== undefined,
      `The position:${positionId.toBase58()} not found`
    );
    let lowerTick: Tick | null = null;
    let upperTick: Tick | null = null;
    for (let i = 0; i < this.ticks.length; i++) {
      if (this.ticks[i].tick == positionInfo.lowerTick) {
        lowerTick = this.ticks[i];
      }
      if (this.ticks[i].tick == positionInfo.upperTick) {
        upperTick = this.ticks[i];
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
    let currentSqrtPrice = this.tokenSwapInfo.currentSqrtPrice;

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
        .mul(positionInfo.liquity),
      amountB: this.tokenSwapInfo.feeGrowthGlobal1
        .sub(lowerFeeOutSideB)
        .sub(upperFeeOutSideB)
        .sub(positionInfo.feeGrowthInsideBLast)
        .mul(positionInfo.liquity),
    };
  }

  /**
   * Prepare calculate A swap B
   * @param amountIn The amount input of token A
   * @returns amountOut:The amount out of token B, amountUsed:The used of amountIn, afterPrice:The price after calculate, afterLiquity: The liquity after calculate
   */
  preSwapA(
    amountIn: Decimal
  ): {
    amountOut: Decimal;
    amountUsed: Decimal;
    feeUsed: Decimal;
    afterPrice: Decimal;
    afterLiquity: Decimal;
    impactA: Decimal;
    impactB: Decimal;
  } {
    invariant(this.isLoaded, "The token swap not load");
    const res = calculateSwapA2B(
      this.ticks,
      this.tokenSwapInfo.currentSqrtPrice,
      this.tokenSwapInfo.fee,
      this.tokenSwapInfo.currentLiquity,
      amountIn
    );
    let currentPriceA = this.tokenSwapInfo.currentSqrtPrice.pow(2);
    let afterPriceA = res.afterPrice.pow(2);
    let impactA = afterPriceA
      .sub(currentPriceA)
      .div(currentPriceA)
      .abs();
    let one = new Decimal(1);
    let currentPriceB = one.div(currentPriceA);
    let afterPriceB = one.div(afterPriceA);
    let impactB = afterPriceB
      .sub(currentPriceB)
      .div(currentPriceB)
      .abs();

    return {
      amountOut: res.amountOut,
      amountUsed: res.amountUsed,
      feeUsed: res.feeUsed,
      afterPrice: res.afterPrice,
      afterLiquity: res.afterLiquity,
      impactA,
      impactB,
    };
  }

  /**
   * Prepare calculate B swap A
   * @param amountIn The amount input of token B
   * @returns amountOut:The amount out of token A, amountUsed:The used of amountIn, afterPrice:The price after calculate, afterLiquity: The liquity after calculate
   */
  preSwapB(
    amountIn: Decimal
  ): {
    amountOut: Decimal;
    amountUsed: Decimal;
    feeUsed: Decimal;
    afterPrice: Decimal;
    afterLiquity: Decimal;
    impactA: Decimal;
    impactB: Decimal;
  } {
    invariant(this.isLoaded, "The token swap not load");
    const res = calculateSwapB2A(
      this.ticks,
      this.tokenSwapInfo.currentSqrtPrice,
      this.tokenSwapInfo.fee,
      this.tokenSwapInfo.currentLiquity,
      amountIn
    );
    let currentPriceA = this.tokenSwapInfo.currentSqrtPrice.pow(2);
    let afterPriceA = res.afterPrice.pow(2);
    let impactA = afterPriceA
      .sub(currentPriceA)
      .div(currentPriceA)
      .abs();
    let one = new Decimal(1);
    let currentPriceB = one.div(currentPriceA);
    let afterPriceB = one.div(afterPriceA);
    let impactB = afterPriceB
      .sub(currentPriceB)
      .div(currentPriceB)
      .abs();

    return {
      amountOut: res.amountOut,
      amountUsed: res.amountUsed,
      feeUsed: res.feeUsed,
      afterPrice: res.afterPrice,
      afterLiquity: res.afterLiquity,
      impactA,
      impactB,
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
    for (let [key, val] of this.positionsKeys) {
      if (val < MAX_ACCOUNT_POSITION_LENGTH) {
        return key;
      }
    }
    return null;
  }

  /* for debug */
  log() {
    let payer = this.payer !== null ? this.payer.publicKey.toBase58() : "null";
    console.log(
      JSON.stringify(
        {
          programId: this.programId.toString(),
          tokenSwapKey: this.tokenSwapKey.toString(),
          payer: payer,
          authority: this.authority.toString(),
          currentTick: this.currentTick,
          currentPrice: this.tokenSwapInfo.currentSqrtPrice.pow(2).toString(),
          tokenSwapInfo: {
            accountType: this.tokenSwapInfo.accountType,
            version: this.tokenSwapInfo.version,
            isInitialized: this.tokenSwapInfo.isInitialized,
            nonce: this.tokenSwapInfo.nonce,
            manager: this.tokenSwapInfo.manager.toString(),
            managerTokenA: this.tokenSwapInfo.managerTokenA.toString(),
            managerTokenB: this.tokenSwapInfo.managerTokenB.toString(),
            swapTokenA: this.tokenSwapInfo.swapTokenA.toString(),
            swapTokenB: this.tokenSwapInfo.swapTokenB.toString(),
            tokenAMint: this.tokenSwapInfo.tokenAMint.toString(),
            tokenBMint: this.tokenSwapInfo.tokenBMint.toString(),
            ticksKey: this.tokenSwapInfo.ticksKey.toString(),
            positionsKey: this.tokenSwapInfo.positionsKey.toString(),
            curveType: this.tokenSwapInfo.curveType,
            fee: this.tokenSwapInfo.fee,
            managerFee: this.tokenSwapInfo.managerFee,
            tickSpace: this.tokenSwapInfo.tickSpace,
            currentSqrtPrice: this.tokenSwapInfo.currentSqrtPrice,
            currentLiquity: this.tokenSwapInfo.currentLiquity,
            feeGrowthGlobal0: this.tokenSwapInfo.feeGrowthGlobal0,
            feeGrowthGlobal1: this.tokenSwapInfo.feeGrowthGlobal1,
            managerFeeA: this.tokenSwapInfo.managerFeeA,
            managerFeeB: this.tokenSwapInfo.managerFeeB,
          },
          positions: Object.fromEntries(this.positions),
          positionsKeys: Object.fromEntries(this.positionsKeys),
          ticks: this.ticks,
        },
        null,
        4
      )
    );
  }
}

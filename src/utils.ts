//@ts-ignore
import { syncSha256Validation } from "sha256-validator-pack";
import {
	createBurnCheckedInstruction,
	createCloseAccountInstruction,
	harvestWithheldTokensToMint,
	getAssociatedTokenAddressSync,
	NATIVE_MINT,
	TOKEN_PROGRAM_ID,
	TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { connection, wallet } from "../config";
import {
	Connection,
	PublicKey,
	Keypair,
	TransactionInstruction,
	clusterApiUrl,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import BN from "bn.js";
import { 
	Raydium,
	TxVersion,
	getPdaLaunchpadPoolId,
	Curve,
	PlatformConfig,
	LAUNCHPAD_PROGRAM,
 } from "@raydium-io/raydium-sdk-v2";
import Decimal from 'decimal.js'
import { parseGlobalConfigAccount, parsePoolStateAccount, parsePlatformConfigAccount } from "./clients/encrypt";
import { cluster, SELL_EXACT_IN_DISCRIMINATOR, BUY_EXACT_IN_DISCRIMINATOR, RaydiumLaunchPadAccountKeys, FEE_RATE_DENOMINATOR_VALUE, RAYDIUM_LAUNCHLAB_MAINNET_ADDR, LAUNCHPAD_AUTH_SEED, LAUNCHPAD_POOL_EVENT_AUTH_SEED } from "./clients/constants";
import { BigNumber } from "bignumber.js";
import { ComputeBudgetProgram } from "@solana/web3.js";
import { SystemProgram } from "@solana/web3.js";
import { Transaction } from "@solana/web3.js";
import { TransactionMessage } from "@solana/web3.js";
import { VersionedTransaction } from "@solana/web3.js";
import axios from "axios";
import base58 from "bs58";
import { Commitment } from "@solana/web3.js";

let raydium: Raydium | undefined;

export const burnAccount = async (wallet: Keypair, keypair: Keypair, connection: Connection, ata: PublicKey, tokenprogram: PublicKey) => {
	const instructions: Array<TransactionInstruction> = [];

	const ataInfo = // @ts-ignore
		(await connection.getParsedAccountInfo(ata)).value?.data.parsed.info;
	console.log("ata info", ataInfo);

	if (tokenprogram === TOKEN_2022_PROGRAM_ID) {
		const sig = await harvestWithheldTokensToMint(connection, keypair, new PublicKey(ataInfo.mint), [ata], undefined, tokenprogram);
	}
	// const solanaBalance = await connection.getBalance(keypair.publicKey);
	// console.log("token amount---------", ataInfo.tokenAmount.uiAmount);
	// console.log("sol balance---------", solanaBalance);

	if (ataInfo.tokenAmount.uiAmount != 0) {
	  const mint = ataInfo.mint;
	  const burnInx = createBurnCheckedInstruction(
	    ata,
	    new PublicKey(mint),
	    keypair.publicKey,
	    ataInfo.tokenAmount.amount,
	    ataInfo.tokenAmount.decimals,
	    [],
	    tokenprogram
	  );
	  instructions.push(burnInx);
	}

	const closeAtaInx = createCloseAccountInstruction(
		ata, // token account which you want to close
		wallet.publicKey, // destination
		keypair.publicKey, // owner of token account
		[],
		tokenprogram
	);
	instructions.push(closeAtaInx);
	return instructions;
	// for (let i = 0; i < instructions.length; i += 20) {
	//   const instructionsList = instructions.slice(
	//     i,
	//     Math.min(i + 20, instructions.length)
	//   );
	//   if (instructionsList.length == 0) break;
	//   const blockhash = await connection
	//     .getLatestBlockhash()
	//     .then((res) => res.blockhash);
	//   const messageV0 = new TransactionMessage({
	//     payerKey: keypair.publicKey,
	//     recentBlockhash: blockhash,
	//     instructions: [
	//       // ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200000 }),
	//       ...instructionsList,
	//     ],
	//   }).compileToV0Message();

	//   const vtx = new VersionedTransaction(messageV0);
	//   vtx.sign([wallet, keypair]);

	//   const sim = await connection.simulateTransaction(vtx, {
	//     sigVerify: true,
	//   });
	//   console.log(sim);
	//   try {
	//     if (!sim.value.err) {
	//       const sig = await connection.sendTransaction(vtx);
	//       const closeConfirm = await connection.confirmTransaction(sig);
	//       console.log("sig", sig);
	//     } else console.error("simulation error");
	//   } catch (e) {
	//     console.error(e);
	//   }
	// }
};

/**
 * Retrieves the balance of an SPL token associated with a given token account.
 * @param {Connection} connection - The connection object for interacting with the Solana network.
 * @param {PublicKey} tokenAccount - The public key of the token account.
 * @param {PublicKey} payerPubKey - The public key of the payer account.
 * @returns {Promise<number>} The balance of the SPL token.
 * @throws {Error} If no balance is found.
 */
export async function getSPLTokenBalance(connection:Connection, tokenAccount:PublicKey, payerPubKey:PublicKey): Promise<number> {
  const address = getAssociatedTokenAddressSync(tokenAccount, payerPubKey);
  const info = await connection.getTokenAccountBalance(address);
  if (info.value.uiAmount == null) throw new Error("No balance found");
  return info.value.uiAmount;
}

export const initSdk = async (params?: { loadToken?: boolean, keypair: Keypair }) => {
  if (raydium) return raydium
  if (connection.rpcEndpoint === clusterApiUrl('mainnet-beta'))
  console.warn('using free rpc node might cause unexpected error, strongly suggest uses paid rpc node')

  console.log(`connect to rpc ${connection.rpcEndpoint} in ${cluster}`)
  raydium = await Raydium.load({
    owner: params?.keypair,
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    blockhashCommitment: 'finalized',
  })
  return raydium
}

export async function getPoolInfo(mint: string) {
  
  const mintA = new PublicKey(mint)
  const mintB = NATIVE_MINT

  const programId = LAUNCHPAD_PROGRAM // devnet: DEV_LAUNCHPAD_PROGRAM

  const poolId = getPdaLaunchpadPoolId(programId, mintA, mintB).publicKey;
    const poolRawData = await connection.getAccountInfo(poolId);
  if (!poolRawData) {
    return null
  }
  const poolData = parsePoolStateAccount(poolRawData.data);

  return {poolData, poolId}
}

export async function getSwapQuote(baseAmountIn: number, inputMint: string, tokenMint: string, slippage: number = 0): Promise<number> {
    const poolInfo = await getPoolInfo(tokenMint);
    if (!poolInfo?.poolData) {
      throw new Error("Invalid pool!")
    }
    const { virtualBase, virtualQuote, realBase, realQuote, baseDecimals, quoteDecimals, platformConfig, globalConfig } = poolInfo?.poolData;
    const [globalConfigData, platformConfigData] = await connection.getMultipleAccountsInfo([platformConfig, globalConfig])
    if (!globalConfigData || !platformConfigData) throw new Error("Error in getting config info")
      
    const parsedGlobal = parseGlobalConfigAccount(globalConfigData.data)
    const platformConfigParsed = parsePlatformConfigAccount(platformConfigData.data)
    const feeRate = parsedGlobal.tradeFeeRate.plus(platformConfigParsed.feeRate)

    const fee = calculateFee({ amount: BigNumber(baseAmountIn), feeRate });

    let amountOut: number;
    if (inputMint == NATIVE_MINT.toBase58()) {
        amountOut = getAmountOut({
            amountIn: BigNumber(baseAmountIn).minus(fee),
            inputReserve: virtualQuote.plus(realQuote),
            outputReserve: virtualBase.minus(realBase),
        }).toNumber();
        console.log("native out:", amountOut);
        
    } else {
        amountOut = getAmountOut({
            amountIn: BigNumber(baseAmountIn).minus(fee),
            inputReserve: virtualBase.minus(realBase),
            outputReserve: virtualQuote.plus(realQuote),
        }).toNumber()
        console.log("token out:", amountOut);

    }

    return Math.floor(amountOut * (1 - slippage / 100))
}

export async function getSwapInstruction(
    amountIn: number,
    minAmountOut: number,
    swapAccountkey: RaydiumLaunchPadAccountKeys,
    mint: PublicKey
): Promise<TransactionInstruction | null> {
  
  // const amount = await getSwapQuote(amountIn, swapAccountkey.inputMint.toBase58(), mint.toBase58());
  const poolInfo = await getPoolInfo(mint.toBase58());
  const { inputMint, payer } = swapAccountkey;
  const [authority] = PublicKey.findProgramAddressSync([LAUNCHPAD_AUTH_SEED], RAYDIUM_LAUNCHLAB_MAINNET_ADDR);
  const [eventAuth] = PublicKey.findProgramAddressSync([LAUNCHPAD_POOL_EVENT_AUTH_SEED], RAYDIUM_LAUNCHLAB_MAINNET_ADDR);
  if (!poolInfo?.poolData) {
    return null
  }
  
  const baseUserAta = getAssociatedTokenAddressSync(poolInfo?.poolData.baseMint, payer);
  const quoteUserAta = getAssociatedTokenAddressSync(poolInfo?.poolData.quoteMint, payer);

  if (inputMint.toBase58() == NATIVE_MINT.toBase58()) {
      return buyExactInIx(
          RAYDIUM_LAUNCHLAB_MAINNET_ADDR,
          payer,
          authority,
          poolInfo?.poolData.globalConfig,
          poolInfo?.poolData.platformConfig,
          poolInfo.poolId,
          baseUserAta,
          quoteUserAta,
          poolInfo?.poolData.baseVault,
          poolInfo?.poolData.quoteVault,
          poolInfo?.poolData.baseMint,
          poolInfo?.poolData.quoteMint,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          eventAuth,
          amountIn,
          minAmountOut,
          0
      )
  } else {
      return sellExactInIx(
          RAYDIUM_LAUNCHLAB_MAINNET_ADDR,
          payer,
          authority,
          poolInfo?.poolData.globalConfig,
          poolInfo?.poolData.platformConfig,
          poolInfo.poolId,
          baseUserAta,
          quoteUserAta,
          poolInfo?.poolData.baseVault,
          poolInfo?.poolData.quoteVault,
          poolInfo?.poolData.baseMint,
          poolInfo?.poolData.quoteMint,
          TOKEN_PROGRAM_ID,
          TOKEN_PROGRAM_ID,
          eventAuth,
          amountIn * 10 ** poolInfo?.poolData.baseDecimals,
          minAmountOut,
          0
      )
  }

}

export function buyExactInIx(
    programId: PublicKey,
    payer: PublicKey,
    authority: PublicKey,
    globalConfig: PublicKey,
    platformConfig: PublicKey,
    poolState: PublicKey,
    userBaseToken: PublicKey,
    userQuoteToken: PublicKey,
    baseVault: PublicKey,
    quoteVault: PublicKey,
    baseTokenMint: PublicKey,
    quoteTokenMint: PublicKey,
    baseTokenProgram: PublicKey,
    quoteTokenProgram: PublicKey,
    eventAuthority: PublicKey,
    amountIn: number,
    minimumAmountOut: number,
    shareFeeRate: number
): TransactionInstruction {

    const discriminator = Buffer.from(BUY_EXACT_IN_DISCRIMINATOR); // Raydium v4 swap_base_in discriminator
    const amountInBuf = Buffer.alloc(8);
    const minimumAmountOutBuf = Buffer.alloc(8);
    const shareFeeRateBuf = Buffer.alloc(8);
    
    amountInBuf.writeBigUInt64LE(BigInt(Math.floor(amountIn)));
    minimumAmountOutBuf.writeBigUInt64LE(BigInt(minimumAmountOut));
    shareFeeRateBuf.writeBigUInt64LE(BigInt(shareFeeRate));
    
    const data = Buffer.concat([discriminator, amountInBuf, minimumAmountOutBuf, shareFeeRateBuf]);
    
    
    const keys = [
        { pubkey: payer, isSigner: true, isWritable: false },
        { pubkey: authority, isSigner: false, isWritable: false },
        { pubkey: globalConfig, isSigner: false, isWritable: false },
        { pubkey: platformConfig, isSigner: false, isWritable: false },
        { pubkey: poolState, isSigner: false, isWritable: true },
        { pubkey: userBaseToken, isSigner: false, isWritable: true },
        { pubkey: userQuoteToken, isSigner: false, isWritable: true },
        { pubkey: baseVault, isSigner: false, isWritable: true },
        { pubkey: quoteVault, isSigner: false, isWritable: true },
        { pubkey: baseTokenMint, isSigner: false, isWritable: false },
        { pubkey: quoteTokenMint, isSigner: false, isWritable: false },
        { pubkey: baseTokenProgram, isSigner: false, isWritable: false },
        { pubkey: quoteTokenProgram, isSigner: false, isWritable: false },
        { pubkey: eventAuthority, isSigner: false, isWritable: false },
        { pubkey: programId, isSigner: false, isWritable: false },
    ];
    
    return new TransactionInstruction({
        keys,
        programId,
        data,
    });
}

export function sellExactInIx(
    programId: PublicKey,
    payer: PublicKey,
    authority: PublicKey,
    globalConfig: PublicKey,
    platformConfig: PublicKey,
    poolState: PublicKey,
    userBaseToken: PublicKey,
    userQuoteToken: PublicKey,
    baseVault: PublicKey,
    quoteVault: PublicKey,
    baseTokenMint: PublicKey,
    quoteTokenMint: PublicKey,
    baseTokenProgram: PublicKey,
    quoteTokenProgram: PublicKey,
    eventAuthority: PublicKey,
    amountIn: number,
    minimumAmountOut: number,
    shareFeeRate: number
): TransactionInstruction {
    const discriminator = Buffer.from(SELL_EXACT_IN_DISCRIMINATOR); // Raydium v4 swap_base_in discriminator
    const amountInBuf = Buffer.alloc(8);
    const minimumAmountOutBuf = Buffer.alloc(8);
    const shareFeeRateBuf = Buffer.alloc(8);
    amountInBuf.writeBigUInt64LE(BigInt(amountIn));
    minimumAmountOutBuf.writeBigUInt64LE(BigInt(minimumAmountOut));
    shareFeeRateBuf.writeBigUInt64LE(BigInt(shareFeeRate));
    
    const data = Buffer.concat([discriminator, amountInBuf, minimumAmountOutBuf, shareFeeRateBuf]);

    const keys = [
        { pubkey: payer, isSigner: true, isWritable: false },
        { pubkey: authority, isSigner: false, isWritable: false },
        { pubkey: globalConfig, isSigner: false, isWritable: false },
        { pubkey: platformConfig, isSigner: false, isWritable: false },
        { pubkey: poolState, isSigner: false, isWritable: true },
        { pubkey: userBaseToken, isSigner: false, isWritable: true },
        { pubkey: userQuoteToken, isSigner: false, isWritable: true },
        { pubkey: baseVault, isSigner: false, isWritable: true },
        { pubkey: quoteVault, isSigner: false, isWritable: true },
        { pubkey: baseTokenMint, isSigner: false, isWritable: false },
        { pubkey: quoteTokenMint, isSigner: false, isWritable: false },
        { pubkey: baseTokenProgram, isSigner: false, isWritable: false },
        { pubkey: quoteTokenProgram, isSigner: false, isWritable: false },
        { pubkey: eventAuthority, isSigner: false, isWritable: false },
        { pubkey: programId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
        keys,
        programId,
        data,
    });
}

export function calculateFee({ amount, feeRate }: { amount: BigNumber; feeRate: BigNumber }): BigNumber {
    return ceilDiv(amount, feeRate, FEE_RATE_DENOMINATOR_VALUE);
}

export function ceilDiv(
    tokenAmount: BigNumber,
    feeNumerator: BigNumber,
    feeDenominator: BigNumber
): BigNumber {
    return tokenAmount
        .multipliedBy(feeNumerator)
        .plus(feeDenominator)
        .minus(1)
        .dividedToIntegerBy(feeDenominator);
}

export function getAmountOut({
    amountIn,
    inputReserve,
    outputReserve,
}: {
    amountIn: BigNumber;
    inputReserve: BigNumber;
    outputReserve: BigNumber;
}): BigNumber {
    const numerator = amountIn.times(outputReserve);
    const denominator = inputReserve.plus(amountIn);
    const amountOut = numerator.div(denominator);
    return amountOut;
}

export function isValidTwoNumberInput(input: string): [number, number] | null {
  const regex = /^\d*\.?\d+\s\d*\.?\d+$/;
  if (!regex.test(input)) return null;

  const [firstStr, secondStr] = input.trim().split(" ");
  const first = Number(firstStr);
  const second = Number(secondStr);

  if (first > 0 && second > 0) {
    return [first, second];
  }

  return null;
}

export function isPositiveInteger(input: string): boolean {
  const num = Number(input);

  // Check if it's a number, an integer, and greater than 0
  return Number.isInteger(num) && num > 0;
}

export async function checkMintKey(input: string) {
  try {
    const isValid = syncSha256Validation({ address: input, onCurve: true });
    
    const pubkey = new PublicKey(input);
    return PublicKey.isOnCurve(pubkey.toBytes()) && isValid;
  } catch {
    return false;
  }
}


/**
 * Utility to produce a random number within [min, max], with 1 decimal place.
 */
export function getRandomNumber(min: number, max: number) {
	const range = max - min;
	const decimal = Math.floor(Math.random() * (range * 10 + 1)) / 10;
	return min + decimal;
}

export async function getBalance(keypair: Keypair): Promise<number> {
	const balance = await connection.getBalance(keypair.publicKey);
	return balance / LAMPORTS_PER_SOL; // Convert lamports to SOL
}

export function generateVanityAddress(suffix: string): { keypair: Keypair, pubkey: string } {
  let attempts = 0;

  while (true) {
    const keypair = Keypair.generate();
    const pubkey = keypair.publicKey.toBase58();
    attempts++;

    if (isMatch(pubkey, suffix)) {
      return { keypair, pubkey };
    }

    // Optional: Log every 100,000 attempts
    if (attempts % 100_000 === 0) {
      console.log(`Tried ${attempts} keys...`);
    }
  }
}

function isMatch(pubKey: string, suffix: string): boolean {
  return pubKey.endsWith(suffix);
}

export const executeJitoTx = async (transactions: VersionedTransaction[], commitment: Commitment) => {

  try {
    let latestBlockhash = await connection.getLatestBlockhash();

    const jitoTxsignature = base58.encode(transactions[0].signatures[0]);

    // Serialize the transactions once here
    const serializedTransactions: string[] = [];
    for (let i = 0; i < transactions.length; i++) {
      const serializedTransaction = base58.encode(transactions[i].serialize());
      serializedTransactions.push(serializedTransaction);
    }

    const endpoints = [
      // 'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
      // 'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
      // 'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
      'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
      'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles',
    ];


    const requests = endpoints.map((url) =>
      axios.post(url, {
        jsonrpc: '2.0',
        id: 1,
        method: 'sendBundle',
        params: [serializedTransactions],
      })
    );

    console.log('Sending transactions to endpoints...');

    const results = await Promise.all(requests.map((p) => p.catch((e) => e)));

    const successfulResults = results.filter((result) => !(result instanceof Error));

    if (successfulResults.length > 0) {
      console.log("Waiting for response")
      const confirmation = await connection.confirmTransaction(
        {
          signature: jitoTxsignature,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          blockhash: latestBlockhash.blockhash,
        },
        commitment,
      );

      console.log("Wallets bought the token plz check keypairs in the data.json file in key folder")

      if (confirmation.value.err) {
        console.log("Confirmtaion error")
        return null
      } else {
        console.log("Transaction confirmed successfully:", jitoTxsignature);
        return jitoTxsignature;
      }
    } else {
      console.log(`No successful responses received for jito`);
    }
    return null
  } catch (error) {
    console.log('Error during transaction execution', error);
    return null
  }
}

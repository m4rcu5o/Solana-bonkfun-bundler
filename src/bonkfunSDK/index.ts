import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BONK_PLATFROM_ID, CreateBonkTokenMetadata, CreateImageMetadata } from "../clients/constants";
import { openAsBlob } from "fs";
import { Keypair } from "@solana/web3.js";
import { buyExactInInstruction, getATAAddress, getPdaLaunchpadAuth, getPdaLaunchpadConfigId, getPdaLaunchpadPoolId, getPdaLaunchpadVaultId, LAUNCHPAD_PROGRAM, LaunchpadConfig, TxVersion } from "@raydium-io/raydium-sdk-v2";
import { createSyncNativeInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync, NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { initSdk } from "../utils";
import { BN } from "bn.js";
import { PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { connection, wallet } from "../../config";
import { TransactionInstruction } from "@solana/web3.js";

export async function createImageMetadata(create: CreateImageMetadata) {
    let formData = new FormData();
    formData.append("image", create.file);

    try {
      
    } catch (error) {
      console.error("Upload failed:", error);
    }
  }

export async function createBonkTokenMetadataAPI(create: CreateBonkTokenMetadata) {
    const metadata = {
      name: create.name,
      symbol: create.symbol,
      description: create.description,
      createdOn: create.createdOn,
      platformId: create.platformId,
      image: create.image, // replace with your actual IPFS image link
    };


    try {
     
    } catch (error) {
      console.error("Metadata upload failed:", error);
    }
}

export const createBonkTokenMetadata = async (file: string, tokenName: string, tokenSymbol: string, description: string, createdOn: string, platformId: string) => {
  
  const imageInfo = {
    file: await openAsBlob(file),
  };
  let imageMetadata = await createImageMetadata(imageInfo);

  console.log("imageMetadata: ", imageMetadata);

    return transaction;
  } catch (error) {
    console.error("createTokenTx error:", error);
    throw error;
  }
}

export const makeBuyIx = async (kp: Keypair, buyAmount: number, mintAddress: PublicKey) => {
  const lamports = buyAmount
  const programId = LAUNCHPAD_PROGRAM;
  const configId = getPdaLaunchpadConfigId(programId, NATIVE_MINT, 0, 0).publicKey;
  const poolId = getPdaLaunchpadPoolId(programId, mintAddress, NATIVE_MINT).publicKey;
  console.log("🚀 ~ makeBuyTx ~ poolId:", poolId)

  const userTokenAccountA = getAssociatedTokenAddressSync(mintAddress, kp.publicKey);
  console.log("🚀 ~ makeBuyTx ~ userTokenAccountA:", userTokenAccountA)
  const userTokenAccountB = getAssociatedTokenAddressSync(NATIVE_MINT, kp.publicKey);
  console.log("🚀 ~ makeBuyTx ~ userTokenAccountB:", userTokenAccountB)

  const vaultA = getPdaLaunchpadVaultId(programId, poolId, mintAddress).publicKey;
  console.log("🚀 ~ makeBuyTx ~ vaultA:", vaultA)
  const vaultB = getPdaLaunchpadVaultId(programId, poolId, NATIVE_MINT).publicKey;
  console.log("🚀 ~ makeBuyTx ~ vaultB:", vaultB)

  const shareATA = getATAAddress(kp.publicKey, NATIVE_MINT).publicKey;
  console.log("🚀 ~ makeBuyTx ~ shareATA:", shareATA)
  const authProgramId = getPdaLaunchpadAuth(programId).publicKey;
  console.log("🚀 ~ makeBuyTx ~ authProgramId:", authProgramId)
  const minmintAmount = new BN(1);

  // const tokenAta = await getAssociatedTokenAddress(mintAddress, kp.publicKey);
  // console.log("🚀 ~ makeBuyTx ~ tokenAta:", tokenAta)
  // const wsolAta = await getAssociatedTokenAddress(NATIVE_MINT, kp.publicKey);
  // console.log("🚀 ~ makeBuyTx ~ wsolAta:", wsolAta)

}


import { PublicKey } from "@solana/web3.js";
import BigNumber from "bignumber.js";
import { GlobalConfigAccount, PlatformConfigAccount, PoolStateAccount } from "../constants";

export interface VestingSchedule {
    totalLockedAmount: BigNumber;
    cliffPeriod: BigNumber;
    unlockPeriod: BigNumber;
    startTime: BigNumber;
    allocatedShareAmount: BigNumber;
}

function readBool(buf: Buffer, offset: number): boolean {
    const value = buf.readUInt8(offset);
    offset += 1;
    return value !== 0;
}

function readU8(buf: Buffer, offset: number): number {
    return buf.readUInt8(offset);
}

function readU16(buf: Buffer, offset: number): number {
    return buf.readUInt16LE(offset);
}

function readU64BN(buffer: Buffer, offset = 0): BigNumber {
    const bytes = buffer.slice(offset, offset + 8);
    let value = new BigNumber(0);
    for (let i = 0; i < 8; i++) {
        value = value.plus(new BigNumber(bytes[i]).multipliedBy(new BigNumber(2).pow(8 * i)));
    }
    return value;
}

function readPubkey(buf: Buffer, offset: number): PublicKey {
    return new PublicKey(buf.slice(offset, offset + 32));
}

function parseStringFromBytes(data: Buffer | Uint8Array): string {
    // Find the first zero byte (null terminator) or use full length
    const zeroIndex = data.indexOf(0);
    const length = zeroIndex >= 0 ? zeroIndex : data.length;

    // Convert bytes to string using UTF-8 encoding, stopping at null terminator if any
    return data.slice(0, length).toString('utf8');
}

export function parseGlobalConfigAccount(buf: Buffer): GlobalConfigAccount {
    let offset = 8;

    const epoch = readU64BN(buf, offset); offset += 8;
    const curveType = readU8(buf, offset); offset += 1;
    const index = readU16(buf, offset); offset += 2;
    const migrateFee = readU64BN(buf, offset); offset += 8;
    const tradeFeeRate = readU64BN(buf, offset); offset += 8;
    const maxShareFeeRate = readU64BN(buf, offset); offset += 8;
    const minBaseSupply = readU64BN(buf, offset); offset += 8;
    const maxLockRate = readU64BN(buf, offset); offset += 8;
    const minBaseSellRate = readU64BN(buf, offset); offset += 8;
    const minBaseMigrateRate = readU64BN(buf, offset); offset += 8;
    const minQuoteFundRaising = readU64BN(buf, offset); offset += 8;

    const quoteMint = readPubkey(buf, offset); offset += 32;
    const protocolFeeOwner = readPubkey(buf, offset); offset += 32;
    const migrateFeeOwner = readPubkey(buf, offset); offset += 32;
    const migrateToAmmWallet = readPubkey(buf, offset); offset += 32;
    const migrateToCpswapWallet = readPubkey(buf, offset); offset += 32;

    const padding: BigNumber[] = [];
    for (let i = 0; i < 16; i++) {
        padding.push(readU64BN(buf, offset));
        offset += 8;
    }

    return {
        epoch,
        curveType,
        index,
        migrateFee,
        tradeFeeRate,
        maxShareFeeRate,
        minBaseSupply,
        maxLockRate,
        minBaseSellRate,
        minBaseMigrateRate,
        minQuoteFundRaising,
        quoteMint,
        protocolFeeOwner,
        migrateFeeOwner,
        migrateToAmmWallet,
        migrateToCpswapWallet,
        padding,
    };
}

export function parseVestingSchedule(buf: Buffer, offset: number): { vestingSchedule: VestingSchedule; offset: number } {
    const totalLockedAmount = readU64BN(buf, offset);
    offset += 8;
    const cliffPeriod = readU64BN(buf, offset);
    offset += 8;
    const unlockPeriod = readU64BN(buf, offset);
    offset += 8;
    const startTime = readU64BN(buf, offset);
    offset += 8;
    const allocatedShareAmount = readU64BN(buf, offset);
    offset += 8;

    return {
        vestingSchedule: {
            totalLockedAmount,
            cliffPeriod,
            unlockPeriod,
            startTime,
            allocatedShareAmount,
        },
        offset,
    };
}

export function parsePlatformConfigAccount(buf: Buffer): PlatformConfigAccount {
    let offset = 8;
    const epoch = readU64BN(buf, offset); offset += 8;
    const platformFeeWallet = readPubkey(buf, offset); offset += 32;
    const platformNftWallet = readPubkey(buf, offset); offset += 32;
    const platformScale = readU64BN(buf, offset); offset += 8;
    const creatorScale = readU64BN(buf, offset); offset += 8;
    const burnScale = readU64BN(buf, offset); offset += 8;
    const feeRate = readU64BN(buf, offset); offset += 8;

    const name = parseStringFromBytes(buf.slice(offset, offset + 32)); offset += 32;
    const web = parseStringFromBytes(buf.slice(offset, offset + 64)); offset += 64;
    const img = parseStringFromBytes(buf.slice(offset, offset + 128)); offset += 128;

    return {
        epoch,
        platformFeeWallet,
        platformNftWallet,
        platformScale,
        creatorScale,
        burnScale,
        feeRate,
        name,
        web,
        img,
    };
}

export function parsePoolStateAccount(buf: Buffer): PoolStateAccount {
    let offset = 8;

    const epoch = readU64BN(buf, offset);
    offset += 8;

    const authBump = readU8(buf, offset);
    offset += 1;

    const status = readU8(buf, offset);
    offset += 1;

    const baseDecimals = readU8(buf, offset);
    offset += 1;

    const quoteDecimals = readU8(buf, offset);
    offset += 1;

    const migrateType = readU8(buf, offset);
    offset += 1;

    // Padding of 2 bytes to align next u64 field? Adjust if needed


    const supply = readU64BN(buf, offset);
    offset += 8;

    const totalBaseSell = readU64BN(buf, offset);
    offset += 8;

    const virtualBase = readU64BN(buf, offset);
    offset += 8;

    const virtualQuote = readU64BN(buf, offset);
    offset += 8;

    const realBase = readU64BN(buf, offset);
    offset += 8;

    const realQuote = readU64BN(buf, offset);
    offset += 8;

    const totalQuoteFundRaising = readU64BN(buf, offset);
    offset += 8;

    const quoteProtocolFee = readU64BN(buf, offset);
    offset += 8;

    const platformFee = readU64BN(buf, offset);
    offset += 8;

    const migrateFee = readU64BN(buf, offset);
    offset += 8;

    // VestingSchedule (5 * u64)
    const vestingScheduleResult = parseVestingSchedule(buf, offset);
    const vestingSchedule = vestingScheduleResult.vestingSchedule;
    offset = vestingScheduleResult.offset;

    const globalConfig = readPubkey(buf, offset);
    offset += 32;

    const platformConfig = readPubkey(buf, offset);
    offset += 32;

    const baseMint = readPubkey(buf, offset);
    offset += 32;

    const quoteMint = readPubkey(buf, offset);
    offset += 32;

    const baseVault = readPubkey(buf, offset);
    offset += 32;

    const quoteVault = readPubkey(buf, offset);
    offset += 32;

    const creator = readPubkey(buf, offset);
    offset += 32;

    return {
        epoch,
        authBump,
        status,
        baseDecimals,
        quoteDecimals,
        migrateType,
        supply,
        totalBaseSell,
        virtualBase,
        virtualQuote,
        realBase,
        realQuote,
        totalQuoteFundRaising,
        quoteProtocolFee,
        platformFee,
        migrateFee,
        vestingSchedule,
        globalConfig,
        platformConfig,
        baseMint,
        quoteMint,
        baseVault,
        quoteVault,
        creator,
    };
}

export {
    readBool,
    readU8,
    readU16,
    readU64BN,
    readPubkey,
    parseStringFromBytes
}
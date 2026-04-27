import { prisma } from '@/lib/db';
import { getEnv } from '@/lib/config';
import { handlePaymentNotify } from '@/lib/order/service';
import { getSystemConfig, setSystemConfig } from '@/lib/system-config';
import { ethers } from 'ethers';

/** Scan 1000 blocks per cycle */
const SCAN_RANGE = 1000;
const TRANSFER_EVENT_TOPIC = ethers.id('Transfer(address,address,uint256)');
let timer: ReturnType<typeof setInterval> | null = null;

async function getLastScannedBlock(): Promise<number | null> {
  const config = await getSystemConfig('BSC_LAST_SCANNED_BLOCK');
  return config ? parseInt(config, 10) : null;
}

async function setLastScannedBlock(blockNumber: number): Promise<void> {
  await setSystemConfig('BSC_LAST_SCANNED_BLOCK', String(blockNumber));
}

/** Extract a checksummed address from a 32-byte log topic */
function addressFromTopic(topic: string): string {
  return ethers.getAddress('0x' + topic.slice(26));
}

export async function scanBscTransactions(): Promise<number> {
  const env = getEnv();
  const walletAddress = env.BSC_WALLET_ADDRESS;
  if (!walletAddress) return 0;

  const rpcUrl = env.BSC_RPC_URL;
  const usdtContract = env.BSC_USDT_CONTRACT;
  const requiredConfirmations = env.BSC_REQUIRED_CONFIRMATIONS;

  let provider: ethers.JsonRpcProvider;
  try {
    provider = new ethers.JsonRpcProvider(rpcUrl);
  } catch (err) {
    console.error('[bsc-scanner] Failed to create RPC provider:', err);
    return 0;
  }

  let currentBlock: number;
  try {
    currentBlock = await provider.getBlockNumber();
  } catch (err) {
    console.error('[bsc-scanner] Failed to get current block:', err);
    return 0;
  }

  // Get last scanned block, or initialize on first run
  let lastScannedBlock = await getLastScannedBlock();
  if (lastScannedBlock === null) {
    lastScannedBlock = Math.max(0, currentBlock - SCAN_RANGE);
    console.log(`[bsc-scanner] First run: starting from block ${lastScannedBlock}`);
  }

  // Nothing new to scan
  if (lastScannedBlock >= currentBlock) return 0;

  // Scan up to SCAN_RANGE blocks from lastScannedBlock.
  // Cap toBlock at currentBlock - requiredConfirmations so we only look at confirmed blocks.
  const safeHead = currentBlock - requiredConfirmations;
  if (lastScannedBlock >= safeHead) return 0;

  const fromBlock = lastScannedBlock + 1;
  const toBlock = Math.min(fromBlock + SCAN_RANGE - 1, safeHead);

  let matchedCount = 0;

  try {
    console.log(`[bsc-scanner] Scanning blocks ${fromBlock}→${toBlock} (wallet: ${walletAddress})`);

    const logs = await provider.getLogs({
      address: usdtContract,
      topics: [
        TRANSFER_EVENT_TOPIC,
        null, // any from address
        ethers.zeroPadValue(walletAddress, 32), // to = our wallet
      ],
      fromBlock,
      toBlock,
    });

    if (logs.length > 0) {
      console.log(`[bsc-scanner] Found ${logs.length} incoming USDT transfer(s)`);
    }

    for (const log of logs) {
      const value = ethers.toBigInt(log.data);
      const amount = ethers.formatUnits(value, 18); // BSC USDT uses 18 decimals
      const amountNum = parseFloat(amount);
      const fromAddr = addressFromTopic(log.topics[1]!);
      const confirmations = currentBlock - log.blockNumber;

      console.log(
        `[bsc-scanner] TX ${log.transactionHash} | block ${log.blockNumber} | from ${fromAddr} | ${amountNum} USDT | ${confirmations} confirmations`,
      );

      // Idempotency: skip if already recorded
      const existing = await prisma.bscTransaction.findUnique({
        where: { txHash: log.transactionHash },
      });
      if (existing) continue;

      // Save raw transaction
      const txRecord = await prisma.bscTransaction.create({
        data: {
          txHash: log.transactionHash,
          blockNumber: log.blockNumber,
          fromAddress: addressFromTopic(log.topics[1]!),
          toAddress: walletAddress,
          amount: amountNum.toFixed(2),
          confirmations,
          tokenAddress: usdtContract,
        },
      });

      // Match to pending bsc-usdt order by payAmount ±0.01 (FIFO)
      const targetAmount = parseFloat(amountNum.toFixed(2));
      const tolerance = 0.01;

      const matchingOrder = await prisma.order.findFirst({
        where: {
          paymentType: 'bsc-usdt',
          status: 'PENDING',
          payAmount: {
            gte: (targetAmount - tolerance).toFixed(2),
            lte: (targetAmount + tolerance).toFixed(2),
          },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, payAmount: true, amount: true },
      });

      if (!matchingOrder) {
        console.log(`[bsc-scanner] TX ${log.transactionHash} | no matching PENDING order for ${targetAmount} USDT`);
        continue;
      }

      console.log(`[bsc-scanner] TX ${log.transactionHash} | matched order ${matchingOrder.id} (payAmount: ${matchingOrder.payAmount})`);

      // Link transaction to order
      await prisma.bscTransaction.update({
        where: { id: txRecord.id },
        data: { orderId: matchingOrder.id, matched: true },
      });

      // Trigger payment confirmation
      try {
        await handlePaymentNotify(
          {
            tradeNo: log.transactionHash,
            orderId: matchingOrder.id,
            amount: Number(matchingOrder.payAmount ?? matchingOrder.amount),
            status: 'success',
            rawData: log,
          },
          'bsc-usdt',
        );
        matchedCount++;
      } catch (err) {
        console.error(`[bsc-scanner] Failed to confirm order ${matchingOrder.id}:`, err);
      }
    }

    // Update last scanned block in DB
    await setLastScannedBlock(toBlock);

    if (matchedCount > 0) {
      console.log(`[bsc-scanner] Matched ${matchedCount} transactions`);
    }

    const scanned = toBlock - fromBlock + 1;
    const remaining = safeHead - toBlock;
    if (remaining > 0) {
      console.log(`[bsc-scanner] Scanned ${scanned} blocks (${fromBlock}→${toBlock}), ${remaining} blocks remaining`);
    }
  } catch (err) {
    console.error(`[bsc-scanner] Error scanning blocks ${fromBlock}-${toBlock}:`, err);
  }

  return matchedCount;
}

export function startBscScanner(): void {
  if (timer) return;

  const env = getEnv();
  if (!env.BSC_WALLET_ADDRESS) {
    console.log('[bsc-scanner] BSC_WALLET_ADDRESS not set, scanner disabled');
    return;
  }

  const intervalMs = env.BSC_SCAN_INTERVAL_MS;

  // Run immediately on startup
  scanBscTransactions().catch(console.error);

  // Then run on interval
  timer = setInterval(() => {
    scanBscTransactions().catch(console.error);
  }, intervalMs);

  console.log(`[bsc-scanner] BSC USDT scanner started (interval: ${intervalMs}ms)`);
}

export function stopBscScanner(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[bsc-scanner] BSC USDT scanner stopped');
  }
}

-- CreateTable
CREATE TABLE "bsc_transactions" (
    "id" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "block_number" INTEGER NOT NULL,
    "from_address" TEXT NOT NULL,
    "to_address" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "confirmations" INTEGER NOT NULL,
    "token_address" TEXT NOT NULL,
    "order_id" TEXT,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bsc_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bsc_transactions_tx_hash_key" ON "bsc_transactions"("tx_hash");

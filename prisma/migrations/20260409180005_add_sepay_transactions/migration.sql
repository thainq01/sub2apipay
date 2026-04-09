-- CreateTable
CREATE TABLE "sepay_transactions" (
    "id" TEXT NOT NULL,
    "sepay_id" INTEGER NOT NULL,
    "gateway" TEXT,
    "transaction_date" TEXT,
    "account_number" TEXT,
    "code" TEXT,
    "content" TEXT,
    "transfer_type" TEXT,
    "transfer_amount" INTEGER NOT NULL,
    "accumulated" INTEGER,
    "sub_account" TEXT,
    "reference_code" TEXT,
    "description" TEXT,
    "order_id" TEXT,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sepay_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sepay_transactions_sepay_id_key" ON "sepay_transactions"("sepay_id");

-- CreateIndex
CREATE INDEX "orders_payment_type_paid_at_idx" ON "orders"("payment_type", "paid_at");

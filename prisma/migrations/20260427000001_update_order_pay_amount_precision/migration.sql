-- AlterTable: increase pay_amount precision from Decimal(10,2) to Decimal(10,3)
ALTER TABLE "orders" ALTER COLUMN "pay_amount" TYPE DECIMAL(10,3);

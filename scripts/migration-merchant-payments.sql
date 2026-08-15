-- Migration: Add MerchantPayment table
-- This SQL creates the merchant_payments table for client->merchant payments via Telegram

CREATE TABLE IF NOT EXISTS "MerchantPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bookingId" TEXT UNIQUE,
    "chatId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "serviceName" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XAF',
    "paymentMethod" TEXT NOT NULL,
    "transactionRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "merchantPhone" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantPayment_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "TelegramAgent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MerchantPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MerchantPayment_agentId_idx" ON "MerchantPayment" ("agentId");
CREATE INDEX IF NOT EXISTS "MerchantPayment_companyId_idx" ON "MerchantPayment" ("companyId");
CREATE INDEX IF NOT EXISTS "MerchantPayment_status_idx" ON "MerchantPayment" ("status");
CREATE INDEX IF NOT EXISTS "MerchantPayment_chatId_idx" ON "MerchantPayment" ("chatId");

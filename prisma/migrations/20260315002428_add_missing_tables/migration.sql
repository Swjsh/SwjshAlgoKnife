/*
  Warnings:

  - You are about to drop the column `metadata` on the `Signal` table. All the data in the column will be lost.
  - Added the required column `action` to the `Signal` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AgentAccountType" AS ENUM ('MASTER', 'AGENT');

-- CreateEnum
CREATE TYPE "AgentAccountStatus" AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'ALLOCATION', 'RELEASE', 'PROFIT', 'LOSS', 'TRANSFER');

-- DropForeignKey
ALTER TABLE "Trade" DROP CONSTRAINT "Trade_brokerConfigId_fkey";

-- AlterTable
ALTER TABLE "Signal" DROP COLUMN "metadata",
ADD COLUMN     "action" TEXT NOT NULL,
ADD COLUMN     "payload" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "price" DECIMAL(20,8),
ADD COLUMN     "processed" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "direction" DROP NOT NULL,
ALTER COLUMN "strategy" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "intelSnapshot" JSONB,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "screenshotUrl" TEXT,
ADD COLUMN     "strategy" TEXT,
ALTER COLUMN "brokerConfigId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dailyPnl" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "mood" TEXT,
    "notes" TEXT,
    "tags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "source" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL DEFAULT 0.5,
    "summary" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntelSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "AgentAccountType" NOT NULL,
    "initialBalance" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "allocatedCapital" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "totalDeposited" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "totalWithdrawn" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "realizedPnl" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "unrealizedPnl" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "totalEquity" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "status" "AgentAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "balanceBefore" DECIMAL(20,2) NOT NULL,
    "balanceAfter" DECIMAL(20,2) NOT NULL,
    "relatedTradeId" TEXT,
    "relatedAccountId" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalEntry_userId_idx" ON "JournalEntry"("userId");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_userId_date_key" ON "JournalEntry"("userId", "date");

-- CreateIndex
CREATE INDEX "Setting_key_idx" ON "Setting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_userId_key_key" ON "Setting"("userId", "key");

-- CreateIndex
CREATE INDEX "IntelSignal_symbol_isActive_idx" ON "IntelSignal"("symbol", "isActive");

-- CreateIndex
CREATE INDEX "IntelSignal_source_idx" ON "IntelSignal"("source");

-- CreateIndex
CREATE INDEX "IntelSignal_expiresAt_idx" ON "IntelSignal"("expiresAt");

-- CreateIndex
CREATE INDEX "AgentAccount_userId_idx" ON "AgentAccount"("userId");

-- CreateIndex
CREATE INDEX "AgentAccount_accountType_idx" ON "AgentAccount"("accountType");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAccount_userId_accountId_key" ON "AgentAccount"("userId", "accountId");

-- CreateIndex
CREATE INDEX "AccountTransaction_accountId_idx" ON "AccountTransaction"("accountId");

-- CreateIndex
CREATE INDEX "AccountTransaction_type_idx" ON "AccountTransaction"("type");

-- CreateIndex
CREATE INDEX "AccountTransaction_createdAt_idx" ON "AccountTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "Signal_symbol_idx" ON "Signal"("symbol");

-- CreateIndex
CREATE INDEX "Signal_processed_idx" ON "Signal"("processed");

-- CreateIndex
CREATE INDEX "Trade_strategy_idx" ON "Trade"("strategy");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_brokerConfigId_fkey" FOREIGN KEY ("brokerConfigId") REFERENCES "BrokerConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntelSignal" ADD CONSTRAINT "IntelSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAccount" ADD CONSTRAINT "AgentAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTransaction" ADD CONSTRAINT "AccountTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "AgentAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

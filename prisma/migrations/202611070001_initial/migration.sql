-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PARTICIPANT',
    "rating" INTEGER NOT NULL DEFAULT 1200,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "timeMs" INTEGER NOT NULL DEFAULT 1000,
    "memoryMb" INTEGER NOT NULL DEFAULT 256,
    "tests" JSONB NOT NULL,
    "checker" TEXT NOT NULL DEFAULT 'tokens',
    "duelPool" BOOLEAN NOT NULL DEFAULT true,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "authorId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'INDIVIDUAL',
    "scoring" TEXT NOT NULL DEFAULT 'ICPC',
    "problemIds" TEXT[],
    "startAt" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 60,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "integrityEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL DEFAULT '',
    "disqualified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "guestId" TEXT,
    "problemIds" TEXT[],
    "duration" INTEGER NOT NULL DEFAULT 20,
    "readyIds" TEXT[],
    "startAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "surrenderedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "captainId" TEXT NOT NULL,
    "memberIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL DEFAULT '',
    "problemId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "result" JSONB,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT 'python',
    "seq" INTEGER NOT NULL DEFAULT 0,
    "hash" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EditorSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "previousHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrityFlag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrityFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_contestId_userId_key" ON "Entry"("contestId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_token_key" ON "Match"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Team_token_key" ON "Team"("token");

-- CreateIndex
CREATE INDEX "Submission_contextId_idx" ON "Submission"("contextId");

-- CreateIndex
CREATE INDEX "Submission_userId_createdAt_idx" ON "Submission"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EditorSession_userId_contextId_problemId_key" ON "EditorSession"("userId", "contextId", "problemId");

-- CreateIndex
CREATE UNIQUE INDEX "EditorEvent_sessionId_seq_key" ON "EditorEvent"("sessionId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Consent_userId_contextId_key" ON "Consent"("userId", "contextId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_teamId_contextId_problemId_key" ON "Claim"("teamId", "contextId", "problemId");

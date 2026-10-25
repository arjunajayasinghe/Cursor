-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isAetriaOperator" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Membership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "level" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "masterNodeId" TEXT,
    "valueStreamId" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProcessNode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcessNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProcessNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcessNode_masterNodeId_fkey" FOREIGN KEY ("masterNodeId") REFERENCES "ProcessNode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProcessNode_valueStreamId_fkey" FOREIGN KEY ("valueStreamId") REFERENCES "ValueStream" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "masterNodeId" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,
    CONSTRAINT "ProcessAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcessAssignment_masterNodeId_fkey" FOREIGN KEY ("masterNodeId") REFERENCES "ProcessNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProcessAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AreaScope" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "membershipId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    CONSTRAINT "AreaScope_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AreaScope_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES "ProcessNode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ValueStream" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ValueStream_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_companyId_key" ON "Membership"("userId", "companyId");

-- CreateIndex
CREATE INDEX "ProcessNode_companyId_parentId_idx" ON "ProcessNode"("companyId", "parentId");

-- CreateIndex
CREATE INDEX "ProcessNode_companyId_code_idx" ON "ProcessNode"("companyId", "code");

-- CreateIndex
CREATE INDEX "ProcessNode_masterNodeId_idx" ON "ProcessNode"("masterNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessAssignment_companyId_masterNodeId_key" ON "ProcessAssignment"("companyId", "masterNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "AreaScope_membershipId_processNodeId_key" ON "AreaScope"("membershipId", "processNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ValueStream_companyId_code_key" ON "ValueStream"("companyId", "code");

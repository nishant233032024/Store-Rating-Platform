-- Store Rating Platform - initial PostgreSQL migration.
-- Run this once against a fresh database before starting the API.

CREATE TYPE role_enum AS ENUM ('NORMAL_USER', 'SYSTEM_ADMIN', 'STORE_OWNER');

CREATE TABLE "User" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL CHECK (char_length(trim(name)) BETWEEN 20 AND 60),
  email VARCHAR(255) NOT NULL,
  "passwordHash" VARCHAR(255) NOT NULL,
  address VARCHAR(400) NOT NULL CHECK (char_length(trim(address)) BETWEEN 1 AND 400),
  role role_enum NOT NULL DEFAULT 'NORMAL_USER',
  "authVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "idx_user_email_lower" ON "User" (LOWER(email));
CREATE INDEX "idx_user_role" ON "User" (role);

CREATE TABLE "Store" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL CHECK (char_length(trim(name)) BETWEEN 20 AND 60),
  email VARCHAR(255) NOT NULL,
  address VARCHAR(400) NOT NULL CHECK (char_length(trim(address)) BETWEEN 1 AND 400),
  "ownerId" INTEGER UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
  "averageRating" DOUBLE PRECISION,
  "ratingCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_store_ownerId" ON "Store"("ownerId");

CREATE TABLE "Rating" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "storeId" INTEGER NOT NULL REFERENCES "Store"(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", "storeId")
);

CREATE INDEX "idx_rating_userId" ON "Rating"("userId");
CREATE INDEX "idx_rating_storeId" ON "Rating"("storeId");

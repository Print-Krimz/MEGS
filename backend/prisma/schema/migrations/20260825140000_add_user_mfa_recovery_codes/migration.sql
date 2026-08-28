-- CreateTable
CREATE TABLE UserMfaRecoveryCode (
    id TEXT NOT NULL,
    userId TEXT NOT NULL,
    codeHash TEXT NOT NULL,
    isUsed BOOLEAN NOT NULL DEFAULT false,
    usedAt TIMESTAMP(3),
    createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT UserMfaRecoveryCode_pkey PRIMARY KEY (id)
);

-- CreateIndex
CREATE INDEX UserMfaRecoveryCode_userId_isUsed_idx ON UserMfaRecoveryCode(userId, isUsed);

-- AddForeignKey
ALTER TABLE UserMfaRecoveryCode ADD CONSTRAINT UserMfaRecoveryCode_userId_fkey FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE ON UPDATE CASCADE;

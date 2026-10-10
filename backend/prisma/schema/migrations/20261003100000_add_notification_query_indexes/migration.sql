-- Support per-user notification history ordering and unread filtering.
CREATE INDEX "Notification_userId_createdAt_idx"
  ON "Notification" ("userId", "createdAt" DESC);

CREATE INDEX "Notification_userId_isRead_createdAt_idx"
  ON "Notification" ("userId", "isRead", "createdAt" DESC);

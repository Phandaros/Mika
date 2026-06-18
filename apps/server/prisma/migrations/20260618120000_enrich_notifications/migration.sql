ALTER TABLE "Notification" ADD COLUMN "actorId" TEXT
  REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Notification_actorId_idx" ON "Notification"("actorId");

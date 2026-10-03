import { createClient } from "redis";
import type { RedisReply } from "rate-limit-redis";

let client: ReturnType<typeof createClient> | undefined;
let connecting: Promise<unknown> | undefined;

export const usesSharedStore = (): boolean => Boolean(process.env.REDIS_URL);

export const connectSharedStore = async (): Promise<void> => {
  if (!usesSharedStore()) {
    if (process.env.NODE_ENV === "production") throw new Error("Shared security storage is required in production");
    return;
  }
  if (!client) {
    client = createClient({
      url: process.env.REDIS_URL,
      disableOfflineQueue: true,
      socket: { connectTimeout: 5000, reconnectStrategy: false },
    });
    client.on("error", () => console.error("[Security store] Connection unavailable"));
    connecting = client.connect();
  }
  await connecting;
  if (!client.isReady) throw new Error("Shared security storage is unavailable");
};

export const sharedCommand = async (...args: string[]): Promise<RedisReply> => {
  await connectSharedStore();
  if (!client) throw new Error("Shared security storage is unavailable");
  return client.sendCommand<RedisReply>(args, { timeout: 5000 });
};

import Redis from "ioredis";

const redis = global.redis || new Redis(process.env.REDIS_URL || "");

if (process.env.NODE_ENV === "development") global.redis = redis;

export default redis;

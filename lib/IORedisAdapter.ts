import type { Account as AdapterAccount } from "next-auth";
import type { Adapter, AdapterUser, AdapterSession, VerificationToken } from "next-auth/adapters";
import { v4 as uuid } from "uuid";
import type { Redis } from "ioredis";

export interface IORedisAdapterOptions {
  baseKeyPrefix?: string;
  userKeyPrefix?: string;
  accountKeyPrefix?: string;
  accountByUserIdPrefix?: string;
  sessionKeyPrefix?: string;
  sessionByUserIdPrefix?: string;
  userByEmailKeyPrefix?: string;
  verificationKeyPrefix?: string;
}

export const defaultOptions: IORedisAdapterOptions = {
  baseKeyPrefix: "",
  userKeyPrefix: "user:",
  accountKeyPrefix: "account:",
  accountByUserIdPrefix: "account:user:",
  sessionKeyPrefix: "session:",
  sessionByUserIdPrefix: "session:user:",
  userByEmailKeyPrefix: "user:email:",
  verificationKeyPrefix: "verification:",
};

export function IORedisAdapter(client: Redis, options: IORedisAdapterOptions = {}): Adapter {
  const currentOptions = {
    ...defaultOptions,
    ...options,
  };

  const baseKeyPrefix = currentOptions.baseKeyPrefix || "";
  const userKeyPrefix = baseKeyPrefix + currentOptions.userKeyPrefix;
  const userByEmailKeyPrefix = baseKeyPrefix + currentOptions.userByEmailKeyPrefix;
  const accountKeyPrefix = baseKeyPrefix + currentOptions.accountKeyPrefix;
  const accountByUserIdPrefix = baseKeyPrefix + currentOptions.accountByUserIdPrefix;
  const sessionKeyPrefix = baseKeyPrefix + currentOptions.sessionKeyPrefix;
  const sessionByUserIdPrefix = baseKeyPrefix + currentOptions.sessionByUserIdPrefix;
  const verificationKeyPrefix = baseKeyPrefix + currentOptions.verificationKeyPrefix;

  const getUserByEmailKey = (email: string) => userByEmailKeyPrefix + email;
  const getUserKey = (userId: string) => userKeyPrefix + userId;

  const getAccountKey = (accountId: string) => accountKeyPrefix + accountId;
  const getAccountByUserIdKey = (userId: string) => accountByUserIdPrefix + userId;
  const getAccountId = (providerAccountId: string, provider: string) => `${provider}:${providerAccountId}`;

  const getSessionKey = (sessionId: string) => sessionKeyPrefix + sessionId;
  const getSessionByUserIdKey = (userId: string) => sessionByUserIdPrefix + userId;

  const getVerificationKey = (tokenId: string) => verificationKeyPrefix + tokenId;

  const setUser = async (id: string, user: AdapterUser): Promise<AdapterUser> => {
    console.log("setUser 1", id);
    await client.hset(getUserKey(id), { ...user, id });
    if (user.email) await client.set(getUserByEmailKey(user.email), id);
    console.log("setUser", user);
    return user;
  };

  const getUser = async (id: string) => {
    console.log("getUser", id);
    const user = await client.hgetall(getUserKey(id));
    if (!user) return null;
    return { ...user } as AdapterUser;
  };

  const setAccount = async (id: string, account: AdapterAccount) => {
    console.log("setAccount", id);
    const accountKey = getAccountKey(id);
    await client.hset(accountKey, { ...account, id });
    await client.set(getAccountByUserIdKey(account.userId), accountKey);
    return account;
  };

  const getAccount = async (id: string) => {
    console.log("getAccount", id);
    const account = await client.hgetall(getAccountKey(id));
    if (!account) return null;
    return { ...account } as AdapterAccount;
  };

  const deleteAccount = async (id: string) => {
    const key = getAccountKey(id);
    const account = await client.hgetall(key);
    if (!account) return null;
    await client.hdel(key);
    await client.del(getAccountByUserIdKey(account.userId));
  };

  const setSession = async (id: string, session: AdapterSession) => {
    console.log("setSession", session);
    const sessionKey = getSessionKey(id);
    await client.hset(sessionKey, session);
    await client.set(getSessionByUserIdKey(session.userId), sessionKey);
    return session;
  };

  const getSession = async (id: string) => {
    console.log("getSession id = ", id);
    const session = await client.hgetall(getSessionKey(id));
    if (!session) return null;
    console.log("getSession", session);
    return {
      id: session.id,
      ...session,
    } as AdapterSession;
  };

  const deleteSession = async (sessionToken: string) => {
    const session = await getSession(sessionToken);
    if (!session) return null;
    const key = getSessionKey(sessionToken);
    await client.hdel(key);
    await client.del(getSessionByUserIdKey(session.userId));
  };

  const setVerificationToken = async (id: string, token: VerificationToken) => {
    const tokenKey = getVerificationKey(id);
    await client.hset(tokenKey, { ...token, id });
    return token;
  };

  const getVerificationToken = async (id: string) => {
    const tokenKey = getVerificationKey(id);
    const token = await client.hgetall(tokenKey);
    if (!token) return null;
    return { identifier: token.identifier, ...token } as VerificationToken;
  };

  const deleteVerificationToken = async (id: string) => {
    const tokenKey = getVerificationKey(id);
    await client.hdel(tokenKey);
  };

  return {
    async createUser(user) {
      console.log("CreateUser", user);
      const id = uuid();
      console.log("uuid", id);
      // @ts-expect-error
      return await setUser(id, user);
    },
    getUser,
    async getUserByEmail(email) {
      console.log("getUserByEmail", email);
      const userId = await client.get(getUserByEmailKey(email));
      if (!userId) return null;
      return await getUser(userId);
    },
    async getUserByAccount({ providerAccountId, provider }) {
      console.log("getUserByAccount", providerAccountId, provider);
      const account = await getAccount(getAccountId(providerAccountId, provider));
      if (!account) return null;
      return await getUser(account.userId);
    },

    async updateUser(updates) {
      const userId = updates.id as string;
      const user = await getUser(userId);
      return await setUser(userId, { ...(user as AdapterUser), ...updates });
    },
    async deleteUser(userId) {
      const user = await getUser(userId);
      if (!user) return null;
      const accountKey = await client.get(getAccountByUserIdKey(userId));
      const sessionKey = await client.get(getSessionByUserIdKey(userId));
      await client.del(
        getUserByEmailKey(user.email as string),
        getAccountByUserIdKey(userId),
        getSessionByUserIdKey(userId)
      );
      if (sessionKey) await client.hdel(sessionKey);
      if (accountKey) await client.hdel(accountKey);
      await client.hdel(getUserKey(userId));
      return;
    },
    async linkAccount(account) {
      const id = getAccountId(account.providerAccountId, account.provider);
      return await setAccount(id, account);
    },
    async unlinkAccount({ providerAccountId, provider }) {
      const id = getAccountId(providerAccountId, provider);
      await deleteAccount(id);
    },
    async createSession(session) {
      const id = session.sessionToken;
      return await setSession(id, { ...session, id });
    },
    async getSessionAndUser(sessionToken) {
      const id = sessionToken;
      const session = await getSession(id);
      if (!session) return null;
      const user = await getUser(session.userId);
      if (!user) return null;
      return { session, user };
    },
    async updateSession(updates) {
      const id = updates.sessionToken;
      const session = await getSession(id);
      if (!session) return null;
      return await setSession(id, { ...session, ...updates });
    },
    deleteSession,
    async createVerificationToken(verificationToken) {
      const id = verificationToken.identifier;
      await setVerificationToken(id, verificationToken);
      return verificationToken;
    },
    async useVerificationToken(verificationToken) {
      const id = verificationToken.identifier;
      const token = await getVerificationToken(id);
      if (!token) return null;
      await deleteVerificationToken(id);
      return token;
    },
  };
}

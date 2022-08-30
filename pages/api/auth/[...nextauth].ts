import NextAuth, { NextAuthOptions, User } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { IORedisAdapter } from "../../../lib/IORedisAdapter";
import redis from "../../../lib/redis";

export const authOptions: NextAuthOptions = {
  adapter: IORedisAdapter(redis),
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      console.log("signIn", user, account, profile, email, credentials);
      return true;
    },
    async session({ session, token, user }) {
      console.log("session", session, token, user);
      //     session.user.id = user.id;
      //     session.user.role = user.role;
      return session;
    },
  },
};

export default NextAuth(authOptions);

// declare module "next-auth" {
//   interface Session {
//     user: User;
//   }
//   interface User {
//     id: string;
//     name?: string | null;
//     email?: string | null;
//     image?: string | null;
//     role: "admin" | "moderator" | "user";
//   }
// }

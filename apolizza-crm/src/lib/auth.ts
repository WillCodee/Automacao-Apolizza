import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./schema";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        login: { label: "Usuario", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) return null;

        const login = (credentials.login as string).trim().toLowerCase();
        const password = credentials.password as string;

        // Try username first, then email
        let [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, login))
          .limit(1);

        if (!user) {
          [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, login))
            .limit(1);
        }

        if (!user || !user.isActive) return null;

        const passwordMatch = await compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          // image NÃO entra no User aqui: fotos são salvas como data-URL base64
          // e estouravam o cookie (Vercel 494 REQUEST_HEADER_TOO_LARGE).
          // Migrar para Vercel Blob é o fix definitivo (ver /api/users/[id]/photo).
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "cotador" | "proprietario";
        session.user.image = null;
      }
      return session;
    },
  },
});

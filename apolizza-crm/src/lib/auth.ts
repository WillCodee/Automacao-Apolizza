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

        // Defesa em profundidade: aceita só URL pequena (Blob), nunca data-URL
        // base64 — isso estourava cookie de sessão (Vercel 494).
        const safePhoto =
          user.photoUrl && user.photoUrl.startsWith("http") && user.photoUrl.length < 512
            ? user.photoUrl
            : null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: safePhoto,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.image = (user as { image?: string | null }).image ?? null;
      }
      // Atualiza foto via update() do client após upload
      if (trigger === "update" && session?.image !== undefined) {
        const next = session.image as string | null;
        token.image = next && next.startsWith("http") && next.length < 512 ? next : null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "cotador" | "proprietario";
        session.user.image = (token.image as string | null) ?? null;
      }
      return session;
    },
  },
});

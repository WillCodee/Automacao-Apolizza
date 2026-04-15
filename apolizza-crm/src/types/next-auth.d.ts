import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "cotador" | "proprietario";
    } & DefaultSession["user"];
  }

  interface User {
    role: "admin" | "cotador" | "proprietario";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "cotador" | "proprietario";
  }
}

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hash } from "bcryptjs";
import { users } from "../src/lib/schema";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const NOVOS_COTADORES = [
  {
    email: "ivo@apolizza.com.br",
    name: "Ivo",
    username: "ivo",
    password: "Apolizza@2026",
  },
  {
    email: "vanessa@apolizza.com.br",
    name: "Vanessa",
    username: "vanessa",
    password: "Apolizza@2026",
  },
];

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set. Check .env.local");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  console.log("Criando cotadores Ivo e Vanessa...\n");

  for (const cotador of NOVOS_COTADORES) {
    const passwordHash = await hash(cotador.password, 12);

    await db
      .insert(users)
      .values({
        email: cotador.email,
        name: cotador.name,
        username: cotador.username,
        passwordHash,
        role: "cotador",
        isActive: true,
      })
      .onConflictDoNothing();

    console.log(`  ✓ ${cotador.name} (${cotador.email})`);
  }

  console.log(`\nPronto! Ivo e Vanessa adicionados como cotadores.`);
  console.log("Senha padrão: Apolizza@2026");
}

seed().catch((err) => {
  console.error("Falhou:", err);
  process.exit(1);
});

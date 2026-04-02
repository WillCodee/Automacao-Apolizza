/**
 * Seed: Cria os 3 usuarios admin iniciais.
 *
 * Uso: npx tsx scripts/seed-admin-users.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { hash } from "bcryptjs";
import { users } from "../src/lib/schema";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ADMIN_USERS = [
  {
    email: "gustavo@apolizza.com.br",
    name: "Gustavo",
    username: "gustavo",
    password: "Apolizza@2026",
  },
  {
    email: "admin@apolizza.com.br",
    name: "Admin Apolizza",
    username: "admin",
    password: "Apolizza@2026",
  },
  {
    email: "gestor@apolizza.com.br",
    name: "Gestor Apolizza",
    username: "gestor",
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

  console.log("Creating admin users...\n");

  for (const admin of ADMIN_USERS) {
    const passwordHash = await hash(admin.password, 12);

    await db
      .insert(users)
      .values({
        email: admin.email,
        name: admin.name,
        username: admin.username,
        passwordHash,
        role: "admin",
        isActive: true,
      })
      .onConflictDoNothing();

    console.log(`  ✓ ${admin.name} (${admin.email})`);
  }

  console.log(`\nDone! ${ADMIN_USERS.length} admin users created.`);
  console.log("\n⚠️  IMPORTANTE: Troque as senhas apos o primeiro login!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

import { db } from "../src/lib/db";
import { users } from "../src/lib/schema";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";

const PASSWORD = "Apolizza@2026";

const accounts = [
  { name: "Admin Apolizza", username: "admin.apolizza", email: "admin.apolizza@apolizza.com.br", role: "admin" as const },
  { name: "Cotador Apolizza", username: "cotador.apolizza", email: "cotador.apolizza@apolizza.com.br", role: "cotador" as const },
];

async function run() {
  const passwordHash = await hash(PASSWORD, 10);
  for (const acc of accounts) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, acc.username)).limit(1);
    if (existing.length > 0) {
      await db.update(users).set({ passwordHash, isActive: true }).where(eq(users.username, acc.username));
      console.log(`✓ Atualizado: ${acc.username} (${acc.role})`);
    } else {
      await db.insert(users).values({ ...acc, passwordHash, isActive: true });
      console.log(`✓ Criado: ${acc.username} (${acc.role})`);
    }
  }
}

run().catch(console.error).finally(() => process.exit(0));

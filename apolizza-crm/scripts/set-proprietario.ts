import { db } from "../src/lib/db";
import { users } from "../src/lib/schema";
import { eq } from "drizzle-orm";

async function run() {
  const [updated] = await db
    .update(users)
    .set({ role: "proprietario" })
    .where(eq(users.username, "gustavo"))
    .returning({ id: users.id, username: users.username, role: users.role });

  if (updated) {
    console.log(`✓ ${updated.username} → role: ${updated.role}`);
  } else {
    console.log("Usuário 'gustavo' não encontrado.");
  }

  // Listar todos os usuários ativos com seus roles
  const all = await db
    .select({ username: users.username, name: users.name, role: users.role, isActive: users.isActive })
    .from(users)
    .orderBy(users.role);

  console.log("\nUsuários no sistema:");
  for (const u of all) {
    console.log(`  [${u.role}] ${u.username} — ${u.name} (ativo: ${u.isActive})`);
  }
}

run().catch(console.error).finally(() => process.exit(0));

import { db } from "../src/lib/db";
import { users } from "../src/lib/schema";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";

async function seedTestUsers() {
  console.log("Criando usuários de teste...");

  const testUsers = [
    { name: "Proprietário Teste", username: "proprietario", email: "proprietario.teste@apolizza.com.br", role: "proprietario" as const, password: "Proprietario@2026" },
    { name: "Admin Teste", username: "admin.teste", email: "adminteste@apolizza.com.br", role: "admin" as const, password: "Admin@2026" },
    { name: "Cotador Teste", username: "cotador.teste", email: "cotadorteste@apolizza.com.br", role: "cotador" as const, password: "Cotador@2026" },
  ];

  for (const u of testUsers) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, u.username)).limit(1);
    if (existing.length > 0) {
      console.log(`  ✓ Usuário "${u.username}" já existe — pulando.`);
      continue;
    }
    const passwordHash = await hash(u.password, 10);
    await db.insert(users).values({
      name: u.name,
      username: u.username,
      email: u.email,
      passwordHash,
      role: u.role,
      isActive: true,
    });
    console.log(`  ✓ Criado: ${u.username} (${u.role}) — senha: ${u.password}`);
  }

  console.log("\nUsuários de teste prontos!");
}

seedTestUsers().catch(console.error).finally(() => process.exit(0));

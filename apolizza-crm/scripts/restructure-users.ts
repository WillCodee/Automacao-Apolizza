/**
 * Script: restructure-users.ts
 *
 * Reestrutura usuários preservando IDs (e todas as cotações vinculadas).
 *
 * Altera:
 *  - eaaf6668 SAUDEEODONTO          -> Ianne Lima      (comercialba@apolizza.com)
 *  - 2147534d Priscila Mendes       -> Raiane Costa    (vendas@apolizza.com) + reativa
 *  - a4aec230 RAMOS ELEMENTARES     -> Julia Gregorio  (cotacao@apolizza.com)
 *  - dec868b3 GESTAO                -> Ivo Santos      (gestao@apolizza.com) [admin]
 *
 * Gera 4 senhas aleatórias e imprime no final (ÚNICA vez que aparecem).
 * Adiciona membros aos grupos SAUDEEODONTO (Ianne+Raiane) e RAMOS ELEMENTARES (Julia).
 * Desativa 4 usuários sintéticos @apolizza.internal.
 */
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL não definida");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

function generatePassword(): string {
  // 16 chars, sem caracteres ambíguos (0/O, 1/l/I), com símbolos seguros
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  const bytes = randomBytes(16);
  let pwd = "";
  for (let i = 0; i < 16; i++) pwd += chars[bytes[i] % chars.length];
  return pwd;
}

type Rename = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "cotador" | "admin" | "proprietario";
  activate: boolean;
};

const renames: Rename[] = [
  {
    id: "eaaf6668-abe6-4b17-ab2f-16d741ff3d76",
    name: "Ianne Lima",
    username: "ianne.lima",
    email: "comercialba@apolizza.com",
    role: "cotador",
    activate: true,
  },
  {
    id: "2147534d-1177-497f-adf1-db9b9156e0c6",
    name: "Raiane Costa",
    username: "raiane.costa",
    email: "vendas@apolizza.com",
    role: "cotador",
    activate: true, // estava inativa (Priscila)
  },
  {
    id: "a4aec230-844c-457d-9d65-fe5a33b8606d",
    name: "Julia Gregorio",
    username: "julia.gregorio",
    email: "cotacao@apolizza.com",
    role: "cotador",
    activate: true,
  },
  {
    id: "dec868b3-e8e3-4dbe-a11f-04485f55bc06",
    name: "Ivo Santos",
    username: "ivo.santos",
    email: "gestao@apolizza.com",
    role: "admin",
    activate: true,
  },
];

const GRUPO_SAUDEEODONTO_ID = "74ebff63-1454-41ae-b92d-0698e4e82c2a";
const GRUPO_RAMOS_ID = "e62230ef-ccfe-4757-8b25-1c8f3e6ac92f";

const syntheticEmails = [
  "ramos_elementares__gestao@apolizza.internal",
  "saudeeodonto__gestao@apolizza.internal",
  "gestao__saudeeodonto@apolizza.internal",
  "vanessa_nogueira__saudeeodonto@apolizza.internal",
];

async function main() {
  console.log("=== REESTRUTURAÇÃO DE USUÁRIOS ===\n");

  // Gera senhas
  const passwords = new Map<string, string>();
  for (const r of renames) passwords.set(r.id, generatePassword());

  // ETAPA 1: renomear usuários preservando IDs
  console.log("[1/4] Renomeando usuários (preserva IDs e cotações vinculadas)...");
  for (const r of renames) {
    const pwd = passwords.get(r.id)!;
    const hash = await bcrypt.hash(pwd, 12);
    await sql`
      UPDATE users
      SET name = ${r.name},
          username = ${r.username},
          email = ${r.email},
          role = ${r.role}::user_role,
          is_active = ${r.activate},
          password_hash = ${hash},
          updated_at = NOW()
      WHERE id = ${r.id}
    `;
    console.log(`   ✓ ${r.id.slice(0, 8)}... -> ${r.name} (${r.username})`);
  }

  // ETAPA 2: adicionar membros aos grupos
  console.log("\n[2/4] Adicionando membros aos grupos...");

  // Limpa membros antigos dos grupos alvo (se houver)
  await sql`DELETE FROM grupo_membros WHERE grupo_id = ${GRUPO_SAUDEEODONTO_ID}`;
  await sql`DELETE FROM grupo_membros WHERE grupo_id = ${GRUPO_RAMOS_ID}`;

  // Saudeeodonto: Ianne + Raiane
  await sql`INSERT INTO grupo_membros (grupo_id, user_id) VALUES (${GRUPO_SAUDEEODONTO_ID}, ${renames[0].id})`;
  await sql`INSERT INTO grupo_membros (grupo_id, user_id) VALUES (${GRUPO_SAUDEEODONTO_ID}, ${renames[1].id})`;
  console.log(`   ✓ Grupo SAUDEEODONTO: Ianne + Raiane`);

  // Ramos Elementares: Julia
  await sql`INSERT INTO grupo_membros (grupo_id, user_id) VALUES (${GRUPO_RAMOS_ID}, ${renames[2].id})`;
  console.log(`   ✓ Grupo RAMOS ELEMENTARES: Julia`);

  // ETAPA 3: desativar sintéticos
  console.log("\n[3/4] Desativando usuários sintéticos @apolizza.internal...");
  for (const email of syntheticEmails) {
    const res = await sql`
      UPDATE users SET is_active = false, updated_at = NOW()
      WHERE email = ${email}
      RETURNING username
    `;
    if (res.length > 0) {
      console.log(`   ✓ Desativado: ${res[0].username}`);
    }
  }

  // ETAPA 4: validação
  console.log("\n[4/4] Validação...");
  const finalUsers = await sql`
    SELECT id, username, email, name, role, is_active
    FROM users
    ORDER BY is_active DESC, role, name
  `;
  console.log(`   Total de usuários: ${finalUsers.length}`);
  console.log(`   Ativos: ${finalUsers.filter(u => u.is_active).length}`);
  console.log(`   Inativos: ${finalUsers.filter(u => !u.is_active).length}`);

  const totalCotacoes = await sql`
    SELECT COUNT(*) as n FROM cotacoes
    WHERE assignee_id IN (${renames[0].id}, ${renames[1].id}, ${renames[2].id}, ${renames[3].id})
    AND deleted_at IS NULL
  `;
  console.log(`   Cotações preservadas nos 4 usuários: ${totalCotacoes[0].n}`);

  console.log("\n=== CREDENCIAIS (guarde agora — não serão mostradas novamente) ===");
  for (const r of renames) {
    console.log(`\n  ${r.name} (${r.role})`);
    console.log(`    Username: ${r.username}`);
    console.log(`    Email:    ${r.email}`);
    console.log(`    Senha:    ${passwords.get(r.id)}`);
  }

  console.log("\n✅ Reestruturação concluída com sucesso.");
}

main().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});

import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // 1. Verificar se usuario suporte já existe
  const existing = await sql`SELECT id FROM users WHERE username = 'suporte' LIMIT 1`;

  let suporteId: string;

  if (existing.length > 0) {
    suporteId = existing[0].id as string;
    console.log("✓ Usuario suporte ja existe:", suporteId);
  } else {
    const passwordHash = await bcrypt.hash("Suporte@Apolizza2026", 12);
    const created = await sql`
      INSERT INTO users (name, email, username, password_hash, role, is_active)
      VALUES ('Suporte', 'suporte@apolizza.com.br', 'suporte', ${passwordHash}, 'cotador', true)
      RETURNING id
    `;
    suporteId = created[0].id as string;
    console.log("✓ Usuario suporte criado:", suporteId);
  }

  // 2. Buscar o admin
  const admins = await sql`
    SELECT id, name FROM users WHERE role = 'admin' AND is_active = true ORDER BY created_at ASC LIMIT 1
  `;

  if (admins.length === 0) {
    console.error("✗ Admin nao encontrado");
    process.exit(1);
  }

  const adminId = admins[0].id as string;
  const adminName = admins[0].name as string;
  console.log("✓ Admin encontrado:", adminName);

  // 3. Mensagem direta para o admin
  await sql`
    INSERT INTO chat_mensagens (from_user_id, to_user_id, texto)
    VALUES (
      ${suporteId},
      ${adminId},
      ${"Ola, " + adminName + "! Sou o agente de Suporte da Apolizza.\n\nEstou aqui para ajudar com duvidas sobre o sistema. Esta e uma mensagem de teste para verificar o funcionamento do chat — envio e recebimento estao operando corretamente!\n\nQuando quiser configurar minhas respostas e comportamentos, e so me chamar. 😊"}
    )
  `;
  console.log("✓ Mensagem direta enviada para", adminName);

  // 4. Mensagem no canal Todos
  await sql`
    INSERT INTO chat_mensagens (from_user_id, to_user_id, texto)
    VALUES (
      ${suporteId},
      NULL,
      ${"Ola a todos! O canal de chat da Apolizza esta no ar.\n\nUse o botao de chat (canto inferior direito) para trocar mensagens com qualquer membro da equipe ou enviar avisos para todos.\n\nEm caso de duvidas sobre o sistema, fale diretamente com o Suporte!"}
    )
  `;
  console.log("✓ Mensagem broadcast enviada para Todos");

  console.log("\n✅ Suporte configurado com sucesso!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

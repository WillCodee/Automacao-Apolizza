import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS chat_mensagens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      from_user_id UUID NOT NULL REFERENCES users(id),
      to_user_id UUID REFERENCES users(id),
      texto TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS chat_leituras (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      mensagem_id UUID NOT NULL REFERENCES chat_mensagens(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lida_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(mensagem_id, user_id)
    )
  `);

  await sql.query(`CREATE INDEX IF NOT EXISTS chat_mensagens_from_idx ON chat_mensagens(from_user_id)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS chat_mensagens_to_idx ON chat_mensagens(to_user_id)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS chat_mensagens_created_idx ON chat_mensagens(created_at)`);
  await sql.query(`CREATE INDEX IF NOT EXISTS chat_leituras_user_idx ON chat_leituras(user_id)`);

  console.log("✓ chat_mensagens and chat_leituras tables created");
}

main().catch((err) => { console.error(err); process.exit(1); });

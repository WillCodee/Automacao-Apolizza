import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql.query(`
    ALTER TABLE cotacao_mensagens
    ADD COLUMN IF NOT EXISTS image_url TEXT
  `);
  console.log("✓ Column image_url added to cotacao_mensagens");
}

main().catch((err) => { console.error(err); process.exit(1); });

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function main() {
  const sql = neon(process.env.DATABASE_URL!);

  const users = await sql`SELECT id, name, username, role FROM users WHERE is_active = true ORDER BY name`;
  console.log('USERS:', JSON.stringify(users));

  const status = await sql`SELECT id, status_name FROM status_config ORDER BY status_name`;
  console.log('STATUS_CONFIG:', JSON.stringify(status));

  const situacoes = await sql`SELECT * FROM situacao_config ORDER BY order_index`;
  console.log('SITUACAO_CONFIG:', JSON.stringify(situacoes));

  // Check if tarefas has a situacao column
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'tarefas' ORDER BY ordinal_position
  `;
  console.log('TAREFAS COLUMNS:', cols.map((c: Record<string, unknown>) => c.column_name).join(', '));
}

main().catch(console.error);

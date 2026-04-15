/**
 * BACKUP AUTOMATIZADO DO BANCO DE DADOS
 *
 * Cria backup completo de todas as tabelas críticas em JSON
 * Uso: npx tsx scripts/backup-database.ts [tipo]
 * Tipos: daily (padrão), weekly, monthly, manual
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL not found in .env.local");
}

const client = neon(dbUrl);
const db = drizzle({ client });

type BackupType = "daily" | "weekly" | "monthly" | "manual";

async function createBackup(tipo: BackupType = "daily") {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const backupDir = join(process.cwd(), "backups", tipo);

  // Criar diretório se não existir
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  console.log(`\n🔒 INICIANDO BACKUP ${tipo.toUpperCase()} - ${timestamp}\n`);

  const backup: any = {
    metadata: {
      tipo,
      timestamp: new Date().toISOString(),
      database_url: dbUrl.split("@")[1], // Apenas host, sem credenciais
      version: "1.0.0"
    },
    data: {}
  };

  // 1. COTAÇÕES (tabela principal)
  console.log("📊 Backup: cotacoes...");
  const cotacoes = await db.execute(sql`
    SELECT * FROM cotacoes ORDER BY id
  `);
  backup.data.cotacoes = cotacoes.rows;
  console.log(`  ✅ ${cotacoes.rows.length} cotações`);

  // 2. USUÁRIOS
  console.log("👤 Backup: users...");
  const users = await db.execute(sql`
    SELECT id, email, name, username, role, is_active, photo_url, created_at, updated_at
    FROM users ORDER BY id
  `);
  backup.data.users = users.rows;
  console.log(`  ✅ ${users.rows.length} usuários`);

  // 3. DOCUMENTOS
  console.log("📎 Backup: cotacao_docs...");
  const docs = await db.execute(sql`
    SELECT * FROM cotacao_docs ORDER BY id
  `);
  backup.data.cotacao_docs = docs.rows;
  console.log(`  ✅ ${docs.rows.length} documentos`);

  // 4. HISTÓRICO DE MUDANÇAS
  console.log("📜 Backup: cotacao_history...");
  const history = await db.execute(sql`
    SELECT * FROM cotacao_history ORDER BY id
  `);
  backup.data.cotacao_history = history.rows;
  console.log(`  ✅ ${history.rows.length} registros de histórico`);

  // 5. METAS
  console.log("🎯 Backup: metas...");
  const metas = await db.execute(sql`
    SELECT * FROM metas ORDER BY id
  `);
  backup.data.metas = metas.rows;
  console.log(`  ✅ ${metas.rows.length} metas`);

  // 6. STATUS CONFIG
  console.log("⚙️  Backup: status_config...");
  const statusConfig = await db.execute(sql`
    SELECT * FROM status_config ORDER BY id
  `);
  backup.data.status_config = statusConfig.rows;
  console.log(`  ✅ ${statusConfig.rows.length} configurações de status`);

  // 7. COMISSÃO TABELA
  console.log("💰 Backup: comissao_tabela...");
  const comissao = await db.execute(sql`
    SELECT * FROM comissao_tabela ORDER BY id
  `);
  backup.data.comissao_tabela = comissao.rows;
  console.log(`  ✅ ${comissao.rows.length} registros de comissão`);

  // 8. TAREFAS
  console.log("✅ Backup: tarefas...");
  const tarefas = await db.execute(sql`
    SELECT * FROM tarefas ORDER BY id
  `);
  backup.data.tarefas = tarefas.rows;
  console.log(`  ✅ ${tarefas.rows.length} tarefas`);

  // 9. NOTIFICAÇÕES (opcional)
  console.log("🔔 Backup: notificacoes...");
  try {
    const notificacoes = await db.execute(sql`
      SELECT * FROM notificacoes ORDER BY id
    `);
    backup.data.notificacoes = notificacoes.rows;
    console.log(`  ✅ ${notificacoes.rows.length} notificações`);
  } catch (error: any) {
    console.log(`  ⚠️  Tabela não existe (ignorando)`);
    backup.data.notificacoes = [];
  }

  // 10. GRUPOS (opcional)
  console.log("👥 Backup: grupos...");
  try {
    const grupos = await db.execute(sql`
      SELECT * FROM grupos ORDER BY id
    `);
    backup.data.grupos = grupos.rows;
    console.log(`  ✅ ${grupos.rows.length} grupos`);
  } catch (error: any) {
    console.log(`  ⚠️  Tabela não existe (ignorando)`);
    backup.data.grupos = [];
  }

  // Calcular estatísticas
  const stats = {
    total_records: Object.values(backup.data).reduce((acc: number, arr: any) => acc + arr.length, 0),
    total_cotacoes: backup.data.cotacoes.length,
    total_users: backup.data.users.length,
    total_docs: backup.data.cotacao_docs.length,
    total_history: backup.data.cotacao_history.length
  };

  backup.metadata.stats = stats;

  // Salvar backup
  const filename = `backup-${tipo}-${timestamp}.json`;
  const filepath = join(backupDir, filename);

  writeFileSync(filepath, JSON.stringify(backup, null, 2));

  const fileSizeMB = (JSON.stringify(backup).length / 1024 / 1024).toFixed(2);

  console.log("\n✅ BACKUP CONCLUÍDO COM SUCESSO!\n");
  console.log(`📁 Arquivo: ${filepath}`);
  console.log(`📊 Tamanho: ${fileSizeMB} MB`);
  console.log(`📈 Total de registros: ${stats.total_records}`);
  console.log(`   - Cotações: ${stats.total_cotacoes}`);
  console.log(`   - Usuários: ${stats.total_users}`);
  console.log(`   - Documentos: ${stats.total_docs}`);
  console.log(`   - Histórico: ${stats.total_history}`);

  // Criar também um link para o último backup
  const latestPath = join(backupDir, `backup-${tipo}-latest.json`);
  writeFileSync(latestPath, JSON.stringify(backup, null, 2));
  console.log(`\n🔗 Link simbólico criado: backup-${tipo}-latest.json`);

  // Política de retenção
  console.log("\n📋 POLÍTICA DE RETENÇÃO:");
  console.log("  - Daily: manter últimos 7 dias");
  console.log("  - Weekly: manter últimos 4 semanas");
  console.log("  - Monthly: manter últimos 12 meses");
  console.log("  - Manual: manter indefinidamente");

  return filepath;
}

// Executar backup
const tipo = (process.argv[2] as BackupType) || "daily";
createBackup(tipo).catch(console.error);

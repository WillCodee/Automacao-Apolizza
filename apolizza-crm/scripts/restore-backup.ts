/**
 * RESTORE DE BACKUP DO BANCO DE DADOS
 *
 * Restaura dados de um backup JSON
 * ATENÇÃO: Use com cuidado! Pode sobrescrever dados existentes.
 *
 * Uso: npx tsx scripts/restore-backup.ts <caminho-do-backup> [modo]
 * Modos:
 *   - preview (padrão): Mostra o que seria restaurado sem executar
 *   - safe: Restaura apenas registros que não existem (baseado em ID)
 *   - force: SOBRESCREVE dados existentes (PERIGOSO!)
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL not found in .env.local");
}

const client = neon(dbUrl);
const db = drizzle({ client });

type RestoreMode = "preview" | "safe" | "force";

async function restoreBackup(backupPath: string, mode: RestoreMode = "preview") {
  // Validar arquivo de backup
  const fullPath = resolve(backupPath);
  if (!existsSync(fullPath)) {
    throw new Error(`Arquivo de backup não encontrado: ${fullPath}`);
  }

  console.log(`\n🔄 INICIANDO RESTORE - MODO: ${mode.toUpperCase()}\n`);
  console.log(`📁 Arquivo: ${fullPath}\n`);

  // Carregar backup
  const backupData = JSON.parse(readFileSync(fullPath, "utf-8"));

  if (!backupData.metadata || !backupData.data) {
    throw new Error("Arquivo de backup inválido!");
  }

  console.log("📊 INFORMAÇÕES DO BACKUP:");
  console.log(`  Tipo: ${backupData.metadata.tipo}`);
  console.log(`  Data: ${backupData.metadata.timestamp}`);
  console.log(`  Total de registros: ${backupData.metadata.stats.total_records}`);
  console.log("");

  if (mode === "preview") {
    console.log("👁️  MODO PREVIEW - Nenhuma mudança será feita\n");

    for (const [table, records] of Object.entries(backupData.data) as [string, any[]][]) {
      console.log(`  ${table}: ${records.length} registros`);
    }

    console.log("\n⚠️  Para executar o restore, use:");
    console.log(`  npx tsx scripts/restore-backup.ts "${backupPath}" safe`);
    console.log("\n  Ou para sobrescrever (PERIGOSO):");
    console.log(`  npx tsx scripts/restore-backup.ts "${backupPath}" force`);

    return;
  }

  // MODO SAFE ou FORCE
  console.log("⚠️  ATENÇÃO: RESTORE EM ANDAMENTO!\n");

  if (mode === "force") {
    console.log("🚨 MODO FORCE - Dados existentes serão SOBRESCRITOS!");
    console.log("   Aguarde 5 segundos para cancelar (Ctrl+C)...\n");
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const restored: any = {};

  // Ordem de restore (respeitando dependências)
  const tables = [
    "users",
    "cotacoes",
    "cotacao_docs",
    "cotacao_history",
    "metas",
    "status_config",
    "comissao_tabela",
    "tarefas",
    "notificacoes",
    "grupos"
  ];

  for (const table of tables) {
    const records = backupData.data[table] || [];
    if (records.length === 0) {
      console.log(`⏭️  ${table}: sem dados no backup`);
      continue;
    }

    console.log(`🔄 Restaurando ${table}...`);

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const record of records) {
      try {
        if (mode === "safe") {
          // Verificar se já existe
          const existing = await db.execute(sql`
            SELECT id FROM ${sql.identifier(table)} WHERE id = ${record.id}
          `);

          if (existing.rows.length > 0) {
            skipped++;
            continue;
          }
        }

        // Construir INSERT
        const columns = Object.keys(record);
        const values = Object.values(record);

        const insertQuery = sql`
          INSERT INTO ${sql.identifier(table)}
          (${sql.raw(columns.join(", "))})
          VALUES (${sql.join(values.map(v => sql`${v}`), sql`, `)})
          ON CONFLICT (id) DO ${mode === "force" ? sql`UPDATE SET ${sql.raw(
            columns.map(col => `${col} = EXCLUDED.${col}`).join(", ")
          )}` : sql`NOTHING`}
        `;

        await db.execute(insertQuery);
        inserted++;

      } catch (error: any) {
        console.error(`  ❌ Erro no registro ID ${record.id}: ${error.message}`);
        errors++;
      }
    }

    restored[table] = { inserted, skipped, errors, total: records.length };
    console.log(`  ✅ Inseridos: ${inserted}, Ignorados: ${skipped}, Erros: ${errors}`);
  }

  console.log("\n✅ RESTORE CONCLUÍDO!\n");
  console.log("📊 RESUMO:");

  for (const [table, stats] of Object.entries(restored) as [string, any][]) {
    console.log(`  ${table}:`);
    console.log(`    Inseridos: ${stats.inserted}`);
    console.log(`    Ignorados: ${stats.skipped}`);
    console.log(`    Erros: ${stats.errors}`);
  }

  console.log("\n🔍 VALIDAÇÃO RECOMENDADA:");
  console.log("  npx tsx scripts/validate-data.ts");
}

// Executar restore
const backupPath = process.argv[2];
const mode = (process.argv[3] as RestoreMode) || "preview";

if (!backupPath) {
  console.error("\n❌ Erro: Caminho do backup não fornecido!\n");
  console.log("Uso: npx tsx scripts/restore-backup.ts <caminho-do-backup> [modo]\n");
  console.log("Modos disponíveis:");
  console.log("  - preview (padrão): Mostra o que seria restaurado");
  console.log("  - safe: Restaura apenas novos registros");
  console.log("  - force: Sobrescreve dados existentes (PERIGOSO!)\n");
  console.log("Exemplo:");
  console.log("  npx tsx scripts/restore-backup.ts backups/daily/backup-daily-latest.json preview\n");
  process.exit(1);
}

restoreBackup(backupPath, mode).catch(console.error);

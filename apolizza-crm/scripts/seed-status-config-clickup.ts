/**
 * Seed status_config com os 8 status reais do ClickUp
 * Uso: npx tsx scripts/seed-status-config-clickup.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/schema";

const sqlConn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlConn, { schema });

// Status reais do ClickUp (lista COTAÇÕES)
const CLICKUP_STATUSES = [
  {
    statusName: "não iniciado",
    displayLabel: "Não Iniciado",
    color: "#87909e",
    icon: "⏸️",
    orderIndex: 0,
    isTerminal: false,
    requiredFields: [],
  },
  {
    statusName: "raut",
    displayLabel: "RAUT",
    color: "#1090e0",
    icon: "📋",
    orderIndex: 1,
    isTerminal: false,
    requiredFields: ["seguradora"],
  },
  {
    statusName: "atrasado",
    displayLabel: "Atrasado",
    color: "#e16b16",
    icon: "⚠️",
    orderIndex: 2,
    isTerminal: false,
    requiredFields: ["dueDate"],
  },
  {
    statusName: "pendencia",
    displayLabel: "Pendência",
    color: "#f8ae00",
    icon: "⏳",
    orderIndex: 3,
    isTerminal: false,
    requiredFields: [],
  },
  {
    statusName: "perda",
    displayLabel: "Perda",
    color: "#d33d44",
    icon: "❌",
    orderIndex: 4,
    isTerminal: true,
    requiredFields: ["valorPerda"],
  },
  {
    statusName: "fechado",
    displayLabel: "Fechado",
    color: "#008844",
    icon: "✅",
    orderIndex: 5,
    isTerminal: true,
    requiredFields: ["premioSemIof", "comissao", "aReceber"],
  },
  {
    statusName: "implantando",
    displayLabel: "Implantando",
    color: "#ee5e99",
    icon: "🚀",
    orderIndex: 6,
    isTerminal: false,
    requiredFields: ["seguradora", "produto", "inicioVigencia"],
  },
  {
    statusName: "concluido ocultar",
    displayLabel: "Concluído (Ocultar)",
    color: "#008844",
    icon: "✔️",
    orderIndex: 7,
    isTerminal: true,
    requiredFields: [],
  },
];

async function main() {
  console.log("═".repeat(60));
  console.log("  SEED: Status Config (ClickUp Real)");
  console.log("═".repeat(60));

  try {
    // Limpar tabela
    console.log("\n🗑️  Limpando tabela status_config...");
    await db.delete(schema.statusConfig);

    // Inserir status
    console.log("\n📥 Inserindo 8 status do ClickUp...\n");

    for (const status of CLICKUP_STATUSES) {
      await db.insert(schema.statusConfig).values(status);
      console.log(
        `  ✓ ${status.displayLabel.padEnd(25)} | ${status.color} | ${status.icon}`
      );
    }

    console.log("\n✅ Status config criado com sucesso!");
    console.log("═".repeat(60));
  } catch (err: any) {
    console.error("\n❌ Erro:", err.message);
    process.exit(1);
  }
}

main();

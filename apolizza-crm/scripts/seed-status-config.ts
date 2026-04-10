/**
 * Seed: Popula a tabela status_config com os 12 status do workflow
 * e seus campos obrigatórios.
 *
 * Uso: npx tsx scripts/seed-status-config.ts
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { statusConfig } from "../src/lib/schema";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const STATUS_SEED = [
  {
    statusName: "não iniciado",
    displayLabel: "Não Iniciado",
    color: "#7f8c8d",
    icon: "⚪",
    orderIndex: 0,
    requiredFields: [
      "inicio_vigencia",
      "fim_vigencia",
      "ano_referencia",
      "mes_referencia",
      "indicacao",
      "produto",
      "seguradora",
      "situacao",
      "tipo_cliente",
    ],
    isTerminal: false,
  },
  {
    statusName: "em andamento",
    displayLabel: "Em Andamento",
    color: "#2980b9",
    icon: "🔵",
    orderIndex: 1,
    requiredFields: [],
    isTerminal: false,
  },
  {
    statusName: "pendencia",
    displayLabel: "Pendência",
    color: "#d4ac0d",
    icon: "🟡",
    orderIndex: 2,
    requiredFields: [],
    isTerminal: false,
  },
  {
    statusName: "aguardando",
    displayLabel: "Aguardando",
    color: "#3498db",
    icon: "⏳",
    orderIndex: 3,
    requiredFields: [],
    isTerminal: false,
  },
  {
    statusName: "em analise",
    displayLabel: "Em Análise",
    color: "#d35400",
    icon: "🔍",
    orderIndex: 4,
    requiredFields: [],
    isTerminal: false,
  },
  {
    statusName: "aprovado",
    displayLabel: "Aprovado",
    color: "#1abc9c",
    icon: "👍",
    orderIndex: 5,
    requiredFields: [],
    isTerminal: false,
  },
  {
    statusName: "implantando",
    displayLabel: "Implantando",
    color: "#16a085",
    icon: "🔧",
    orderIndex: 6,
    requiredFields: [],
    isTerminal: false,
  },
  {
    statusName: "venda parada",
    displayLabel: "Venda Parada",
    color: "#8e44ad",
    icon: "⏸️",
    orderIndex: 7,
    requiredFields: [],
    isTerminal: false,
  },
  {
    statusName: "atrasado",
    displayLabel: "Atrasado",
    color: "#e74c3c",
    icon: "🔴",
    orderIndex: 8,
    requiredFields: [],
    isTerminal: false,
  },
  {
    statusName: "fechado",
    displayLabel: "Fechado",
    color: "#27ae60",
    icon: "✅",
    orderIndex: 9,
    requiredFields: [
      "comissao",
      "primeiro_pagamento",
      "a_receber",
      "parcelado_em",
      "premio_sem_iof",
    ],
    isTerminal: true,
  },
  {
    statusName: "perda",
    displayLabel: "Perda",
    color: "#e67e22",
    icon: "🟠",
    orderIndex: 10,
    requiredFields: ["valor_perda"],
    isTerminal: true,
  },
  {
    statusName: "cancelado",
    displayLabel: "Cancelado",
    color: "#c0392b",
    icon: "❌",
    orderIndex: 11,
    requiredFields: [],
    isTerminal: true,
  },
];

async function seed() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set. Check .env.local");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);

  console.log("Seeding status_config...");

  for (const status of STATUS_SEED) {
    await db
      .insert(statusConfig)
      .values(status)
      .onConflictDoUpdate({
        target: statusConfig.statusName,
        set: {
          displayLabel: status.displayLabel,
          color: status.color,
          icon: status.icon,
          orderIndex: status.orderIndex,
          requiredFields: status.requiredFields,
          isTerminal: status.isTerminal,
        },
      });
    console.log(`  ✓ ${status.displayLabel} (${status.statusName})`);
  }

  console.log(`\nDone! ${STATUS_SEED.length} status seeded.`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

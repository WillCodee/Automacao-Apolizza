/**
 * Patch: Aplica campos obrigatórios por status conforme regras de negócio.
 *
 * - "não iniciado": Inicio Vigencia, Fim Vigencia, Ano, Mes, Indicacao,
 *                   Produto, Seguradora, Situacao, Tipo de Cliente
 * - "fechado"     : Comissao, 1o Pagamento, A Receber, Parcelado Em, Premio s/ IOF
 * - "perda"       : Valor em Perda
 *
 * Uso: npx tsx scripts/patch-status-required-fields.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { statusConfig } from "../src/lib/schema";

const sqlConn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlConn);

const PATCHES = [
  {
    statusName: "não iniciado",
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
  },
  {
    statusName: "fechado",
    requiredFields: [
      "comissao",
      "primeiro_pagamento",
      "a_receber",
      "parcelado_em",
      "premio_sem_iof",
    ],
  },
  {
    statusName: "perda",
    requiredFields: ["valor_perda"],
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set. Check .env.local");
    process.exit(1);
  }

  console.log("Aplicando campos obrigatórios por status...\n");

  for (const patch of PATCHES) {
    const [updated] = await db
      .update(statusConfig)
      .set({ requiredFields: patch.requiredFields })
      .where(eq(statusConfig.statusName, patch.statusName))
      .returning({ statusName: statusConfig.statusName, displayLabel: statusConfig.displayLabel });

    if (updated) {
      console.log(`✓ "${updated.displayLabel}" (${patch.statusName})`);
      console.log(`  Campos: ${patch.requiredFields.join(", ")}`);
    } else {
      console.warn(`⚠ Status "${patch.statusName}" não encontrado no banco!`);
    }
  }

  console.log("\nPatch concluido!");
}

main().catch((err) => {
  console.error("Patch falhou:", err);
  process.exit(1);
});

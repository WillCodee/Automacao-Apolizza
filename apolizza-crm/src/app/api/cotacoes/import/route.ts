import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cotacoes } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { cotacaoCreateSchema } from "@/lib/validations";

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ";" && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

const FIELD_MAP: Record<string, string> = {
  nome: "name",
  cliente: "name",
  status: "status",
  prioridade: "priority",
  "tipo cliente": "tipoCliente",
  tipo_cliente: "tipoCliente",
  contato: "contatoCliente",
  seguradora: "seguradora",
  produto: "produto",
  situacao: "situacao",
  indicacao: "indicacao",
  "inicio vigencia": "inicioVigencia",
  "fim vigencia": "fimVigencia",
  "primeiro pagamento": "primeiroPagamento",
  "proxima tratativa": "proximaTratativa",
  "parcelado em": "parceladoEm",
  "premio sem iof": "premioSemIof",
  comissao: "comissao",
  "a receber": "aReceber",
  "valor perda": "valorPerda",
  observacao: "observacao",
  mes: "mesReferencia",
  ano: "anoReferencia",
  renovacao: "isRenovacao",
};

function normalizeHeader(h: string): string {
  const clean = h.toLowerCase().replace(/[_-]/g, " ").trim();
  return FIELD_MAP[clean] || clean;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "admin" && user.role !== "proprietario") return apiError("Acesso negado", 403);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return apiError("Arquivo CSV nao enviado", 400);
    if (!file.name.endsWith(".csv")) return apiError("Apenas arquivos .csv", 400);
    if (file.size > 500_000) return apiError("Arquivo muito grande (max 500KB)", 400);

    let text = await file.text();
    // Remove BOM
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return apiError("CSV deve ter cabecalho + pelo menos 1 linha", 400);
    if (lines.length > 1001) return apiError("Maximo de 1000 linhas por importacao", 400);

    const headers = parseCsvLine(lines[0]).map(normalizeHeader);
    const nameIdx = headers.indexOf("name");
    if (nameIdx === -1) return apiError("Coluna 'nome' ou 'cliente' obrigatoria no CSV", 400);

    const results: { line: number; status: "ok" | "error"; error?: string }[] = [];
    const toInsert: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i]);
      const row: Record<string, unknown> = {};

      for (let j = 0; j < headers.length; j++) {
        const key = headers[j];
        const val = fields[j] || "";
        if (!val) continue;

        if (["parceladoEm", "anoReferencia"].includes(key)) {
          row[key] = Number(val) || null;
        } else if (key === "isRenovacao") {
          row[key] = ["sim", "true", "1", "s"].includes(val.toLowerCase());
        } else {
          row[key] = val;
        }
      }

      // Set defaults
      if (!row.status) row.status = "não iniciado";
      if (!row.priority) row.priority = "normal";
      row.assigneeId = user.id;
      row.tags = [];
      row.isRenovacao = row.isRenovacao || false;

      const parsed = cotacaoCreateSchema.safeParse(row);
      if (!parsed.success) {
        const errs = parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        results.push({ line: i + 1, status: "error", error: errs });
      } else {
        toInsert.push(parsed.data);
        results.push({ line: i + 1, status: "ok" });
      }
    }

    const errorCount = results.filter((r) => r.status === "error").length;
    const totalRows = lines.length - 1;

    // If > 10% errors, rollback
    if (errorCount > totalRows * 0.1 && errorCount > 0) {
      return apiSuccess({
        imported: 0,
        errors: errorCount,
        total: totalRows,
        message: `Muitos erros (${errorCount}/${totalRows}). Corrija o CSV e tente novamente.`,
        details: results.filter((r) => r.status === "error").slice(0, 20),
      });
    }

    // Insert valid rows in batch
    if (toInsert.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        await db.insert(cotacoes).values(
          batch.map((row) => ({
            name: row.name as string,
            status: (row.status as string) || "não iniciado",
            priority: (row.priority as string) || "normal",
            assigneeId: row.assigneeId as string,
            tipoCliente: (row.tipoCliente as string) || null,
            contatoCliente: (row.contatoCliente as string) || null,
            seguradora: (row.seguradora as string) || null,
            produto: (row.produto as string) || null,
            situacao: (row.situacao as string) || null,
            indicacao: (row.indicacao as string) || null,
            inicioVigencia: (row.inicioVigencia as string) || null,
            fimVigencia: (row.fimVigencia as string) || null,
            primeiroPagamento: (row.primeiroPagamento as string) || null,
            proximaTratativa: (row.proximaTratativa as string) || null,
            parceladoEm: (row.parceladoEm as number) || null,
            premioSemIof: (row.premioSemIof as string) || null,
            comissao: (row.comissao as string) || null,
            aReceber: (row.aReceber as string) || null,
            valorPerda: (row.valorPerda as string) || null,
            observacao: (row.observacao as string) || null,
            mesReferencia: (row.mesReferencia as string) || null,
            anoReferencia: (row.anoReferencia as number) || null,
            isRenovacao: (row.isRenovacao as boolean) || false,
            tags: [],
          }))
        );
      }
    }

    return apiSuccess({
      imported: toInsert.length,
      errors: errorCount,
      total: totalRows,
      message: `${toInsert.length} importadas, ${errorCount} com erro.`,
      details: results.filter((r) => r.status === "error").slice(0, 20),
    });
  } catch (error) {
    console.error("API POST /api/cotacoes/import:", error);
    return apiError("Erro ao importar CSV", 500);
  }
}

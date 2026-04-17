import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cotacoes, cotacaoHistory } from "@/lib/schema";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { sendTelegram } from "@/lib/telegram";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://apolizza-crm.vercel.app";
const esc = (t: string) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nomeCliente, contatoCliente, prioridade, indicacao, produto, mes, ano, descricao } = body;

    if (!nomeCliente || !contatoCliente || !prioridade || !produto || !mes || !ano || !descricao) {
      return apiError("Campos obrigatórios: nome, contato, prioridade, produto, mês, ano e descrição", 422);
    }

    const [cotacao] = await db
      .insert(cotacoes)
      .values({
        name: nomeCliente,
        status: "não iniciado",
        priority: prioridade.toLowerCase() === "alta" ? "high" : prioridade.toLowerCase() === "urgente" ? "urgent" : "normal",
        produto,
        contatoCliente,
        indicacao: indicacao || null,
        situacao: "COTAR",
        mesReferencia: mes,
        anoReferencia: parseInt(ano),
        observacao: descricao,
        tags: ["pedido", "externo"],
      })
      .returning();

    await db.insert(cotacaoHistory).values({
      cotacaoId: cotacao.id,
      userId: null,
      fieldName: "criacao",
      oldValue: null,
      newValue: `Pedido externo — ${produto} ${mes}/${ano}`,
    });

    const cotacaoUrl = `${APP_URL}/cotacoes/${cotacao.id}`;

    await sendTelegram([
      `📋 <b>NOVO PEDIDO EXTERNO</b>`,
      ``,
      `👤 <b>Cliente:</b> ${esc(nomeCliente)}`,
      `📞 <b>Contato:</b> ${esc(contatoCliente)}`,
      `🎯 <b>Prioridade:</b> ${esc(prioridade)}`,
      `📦 <b>Produto:</b> ${esc(produto)}`,
      `📅 <b>Referência:</b> ${esc(mes)}/${esc(ano)}`,
      `💡 <b>Indicação:</b> ${esc(indicacao || "—")}`,
      ``,
      `📝 ${esc(descricao)}`,
      ``,
      `🔗 <a href="${cotacaoUrl}">Ver Cotação</a>`,
    ].join("\n")).catch(() => {});

    return apiSuccess({ cotacaoId: cotacao.id }, 201);
  } catch (error: unknown) {
    const e = error as Error;
    console.error("POST /api/pedido:", e);
    return apiError(e.message || "Erro ao criar pedido", 500);
  }
}

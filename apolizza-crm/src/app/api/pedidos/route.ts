import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacoes, cotacaoDocs, cotacaoHistory, users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { sendTelegram } from "@/lib/telegram";
import { sendAlertEmail } from "@/lib/email";
import { put } from "@vercel/blob";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://apolizza-crm.vercel.app";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autenticado", 401);

    const contentType = req.headers.get("content-type") || "";
    const fields: Record<string, string> = {};
    const files: { name: string; url: string; size: number; mime: string }[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        if (typeof value === "string") {
          fields[key] = value;
        } else {
          const file = value as File;
          if (file.size > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
            try {
              const blob = await put(`pedidos/${Date.now()}-${file.name}`, file, { access: "public" });
              files.push({ name: file.name, url: blob.url, size: file.size, mime: file.type });
            } catch {}
          }
        }
      }
    } else {
      const json = await req.json();
      Object.assign(fields, json);
    }

    const {
      nomeCliente,
      contatoCliente,
      prioridade,
      indicacao,
      produto,
      mes,
      ano,
      responsavelId,
      descricao,
      situacao = "COTAR",
    } = fields;

    if (!nomeCliente || !contatoCliente || !prioridade || !produto || !mes || !ano || !responsavelId || !descricao) {
      return apiError("Campos obrigatórios: nome, contato, prioridade, produto, mês, ano, responsável e descrição", 422);
    }

    // Busca o responsável
    const [responsavel] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, responsavelId))
      .limit(1);

    // Cria a cotação
    const [cotacao] = await db
      .insert(cotacoes)
      .values({
        name: nomeCliente,
        status: "não iniciado",
        priority: prioridade.toLowerCase() === "alta" ? "high" : prioridade.toLowerCase() === "urgente" ? "urgent" : "normal",
        assigneeId: responsavelId,
        produto,
        contatoCliente,
        indicacao: indicacao || null,
        situacao,
        mesReferencia: mes,
        anoReferencia: parseInt(ano),
        observacao: descricao,
        tags: ["pedido"],
      })
      .returning();

    // Registra evento de criação no histórico
    await db.insert(cotacaoHistory).values({
      cotacaoId: cotacao.id,
      userId: user.id,
      fieldName: "criacao",
      oldValue: null,
      newValue: `Pedido criado por ${user.name} — ${produto} ${mes}/${ano}`,
    });

    // Salva anexos como docs da cotação
    for (const f of files) {
      await db.insert(cotacaoDocs).values({
        cotacaoId: cotacao.id,
        fileName: f.name,
        fileUrl: f.url,
        fileSize: f.size,
        mimeType: f.mime,
        uploadedBy: user.id,
      });
    }

    const cotacaoUrl = `${APP_URL}/cotacoes/${cotacao.id}`;

    // Notificação Telegram
    const telegramMsg = [
      `📋 <b>NOVO PEDIDO DE COTAÇÃO</b>`,
      ``,
      `👤 <b>Cliente:</b> ${nomeCliente}`,
      `📞 <b>Contato:</b> ${contatoCliente}`,
      `🎯 <b>Prioridade:</b> ${prioridade}`,
      `📦 <b>Produto:</b> ${produto}`,
      `📅 <b>Referência:</b> ${mes}/${ano}`,
      `💡 <b>Indicação:</b> ${indicacao || "—"}`,
      `🔖 <b>Situação:</b> ${situacao}`,
      ``,
      `👷 <b>Responsável:</b> ${responsavel?.name || responsavelId}`,
      ``,
      `📝 ${descricao}`,
      ``,
      `🔗 <a href="${cotacaoUrl}">Ver Cotação</a>`,
    ].join("\n");

    await sendTelegram(telegramMsg).catch(() => {});

    // Email para o responsável
    if (responsavel?.email) {
      try {
        await sendAlertEmail({
          to: responsavel.email,
          subject: `[Apolizza] Novo pedido: ${nomeCliente} — ${produto}`,
          html: `
            <h2>Novo Pedido de Cotação</h2>
            <p><b>Cliente:</b> ${nomeCliente}</p>
            <p><b>Contato:</b> ${contatoCliente}</p>
            <p><b>Produto:</b> ${produto} — ${mes}/${ano}</p>
            <p><b>Prioridade:</b> ${prioridade}</p>
            <p><b>Descrição:</b> ${descricao}</p>
            <br>
            <a href="${cotacaoUrl}" style="display:inline-block;background:#03a4ed;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
              Ver Cotação
            </a>
          `,
        });
      } catch {}
    }

    return apiSuccess({ cotacao, anexos: files.length }, 201);
  } catch (error: unknown) {
    const e = error as Error;
    console.error("POST /api/pedidos:", e);
    return apiError(e.message || "Erro ao criar pedido", 500);
  }
}

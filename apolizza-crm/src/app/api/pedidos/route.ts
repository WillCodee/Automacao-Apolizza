import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tarefas, tarefasAnexos, users } from "@/lib/schema";
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

    // Constrói título e descrição da tarefa
    const titulo = `[PEDIDO] ${nomeCliente} — ${produto} ${mes}/${ano}`;
    const descricaoCompleta = [
      `Cliente: ${nomeCliente}`,
      `Contato: ${contatoCliente}`,
      `Prioridade: ${prioridade}`,
      `Indicação: ${indicacao || "—"}`,
      `Produto: ${produto}`,
      `Referência: ${mes}/${ano}`,
      `Situação: ${situacao}`,
      ``,
      descricao,
    ].join("\n");

    // Data de vencimento = amanhã
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    amanha.setHours(23, 59, 0, 0);

    // Cria tarefa
    const [tarefa] = await db
      .insert(tarefas)
      .values({
        titulo,
        descricao: descricaoCompleta,
        status: "Pendente",
        cotadorId: responsavelId,
        criadorId: user.id,
        dataVencimento: amanha,
      })
      .returning();

    // Salva anexos
    for (const f of files) {
      await db.insert(tarefasAnexos).values({
        tarefaId: tarefa.id,
        usuarioId: user.id,
        nomeArquivo: f.name,
        urlBlob: f.url,
        tamanho: f.size,
        mimeType: f.mime,
      });
    }

    // Notificação Telegram (sempre)
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
      `🔗 <a href="${APP_URL}/tarefas">Ver Tarefas</a>`,
    ].join("\n");

    await sendTelegram(telegramMsg).catch(() => {});

    // Email para o responsável (se configurado)
    if (responsavel?.email) {
      try {
        await sendAlertEmail({
          to: responsavel.email,
          subject: `[Apolizza] Novo pedido: ${nomeCliente} — ${produto}`,
          html: `<h2>Novo Pedido de Cotação</h2><pre style="font-family:inherit">${descricaoCompleta}</pre><br><a href="${APP_URL}/tarefas">Ver Tarefas</a>`,
        });
      } catch {}
    }

    return apiSuccess({ tarefa, anexos: files.length }, 201);
  } catch (error: unknown) {
    const e = error as Error;
    console.error("POST /api/pedidos:", e);
    return apiError(e.message || "Erro ao criar pedido", 500);
  }
}

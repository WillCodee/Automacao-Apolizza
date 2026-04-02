import { getCurrentUser } from "@/lib/auth-helpers";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { tarefas, tarefasAnexos } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { put } from "@vercel/blob";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "@/lib/validations";
import { logAtividade } from "@/lib/audit-log";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/tarefas/[id]/anexos - Listar anexos da tarefa
export async function GET(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError("Não autenticado", 401);
    }

    const { id: tarefaId } = await params;

    // Verificar se tarefa existe
    const tarefa = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, tarefaId),
    });

    if (!tarefa) {
      return apiError("Tarefa não encontrada", 404);
    }

    // Verificar permissão (cotador só vê anexos das suas tarefas)
    if (user.role !== "admin" && tarefa.cotadorId !== user.id) {
      return apiError("Sem permissão para acessar esta tarefa", 403);
    }

    // Buscar anexos com informações do usuário
    const anexos = await db.query.tarefasAnexos.findMany({
      where: eq(tarefasAnexos.tarefaId, tarefaId),
      orderBy: desc(tarefasAnexos.createdAt),
      with: {
        usuario: {
          columns: {
            id: true,
            name: true,
            photoUrl: true,
          },
        },
      },
    });

    return apiSuccess(anexos);
  } catch (error) {
    console.error("Erro ao listar anexos:", error);
    return apiError(
      error instanceof Error ? error.message : "Erro ao listar anexos",
      500
    );
  }
}

// POST /api/tarefas/[id]/anexos - Upload de anexo
export async function POST(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError("Não autenticado", 401);
    }

    const { id: tarefaId } = await params;

    // Verificar se tarefa existe
    const tarefa = await db.query.tarefas.findFirst({
      where: eq(tarefas.id, tarefaId),
    });

    if (!tarefa) {
      return apiError("Tarefa não encontrada", 404);
    }

    // Verificar permissão (cotador só pode anexar nas suas tarefas, admin em qualquer)
    if (user.role !== "admin" && tarefa.cotadorId !== user.id) {
      return apiError("Sem permissão para adicionar anexos nesta tarefa", 403);
    }

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError("Nenhum arquivo enviado", 400);
    }

    // Validar tipo MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
      return apiError(
        "Tipo de arquivo não permitido. Apenas PDF, PNG, JPG, DOCX e XLSX",
        400
      );
    }

    // Validar tamanho
    if (file.size > MAX_FILE_SIZE) {
      return apiError("Arquivo muito grande (máximo 10MB)", 400);
    }

    // Upload para Vercel Blob
    const blob = await put(`tarefas/${tarefaId}/${file.name}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    // Salvar no banco
    const [anexo] = await db
      .insert(tarefasAnexos)
      .values({
        tarefaId,
        usuarioId: user.id,
        nomeArquivo: file.name,
        urlBlob: blob.url,
        tamanho: file.size,
        mimeType: file.type,
      })
      .returning();

    // Registrar atividade
    await logAtividade({
      tarefaId,
      usuarioId: user.id,
      tipoAcao: "ANEXO_ADICIONADO",
      detalhes: {
        nomeArquivo: file.name,
        tamanho: file.size,
        mimeType: file.type,
      },
    });

    // Buscar anexo com informações do usuário
    const anexoComUsuario = await db.query.tarefasAnexos.findFirst({
      where: eq(tarefasAnexos.id, anexo.id),
      with: {
        usuario: {
          columns: {
            id: true,
            name: true,
            photoUrl: true,
          },
        },
      },
    });

    return apiSuccess(anexoComUsuario, 201);
  } catch (error) {
    console.error("Erro ao fazer upload de anexo:", error);
    return apiError(
      error instanceof Error ? error.message : "Erro ao fazer upload",
      500
    );
  }
}

import { getCurrentUser } from "@/lib/auth-helpers";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { tarefasAnexos } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { logAtividade } from "@/lib/audit-log";

interface RouteContext {
  params: Promise<{ id: string; anexoId: string }>;
}

// DELETE /api/tarefas/[id]/anexos/[anexoId] - Remover anexo
export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError("Não autenticado", 401);
    }

    const { id: tarefaId, anexoId } = await params;

    // Buscar anexo
    const anexo = await db.query.tarefasAnexos.findFirst({
      where: eq(tarefasAnexos.id, anexoId),
    });

    if (!anexo) {
      return apiError("Anexo não encontrado", 404);
    }

    // Verificar se o anexo pertence à tarefa correta
    if (anexo.tarefaId !== tarefaId) {
      return apiError("Anexo não pertence a esta tarefa", 400);
    }

    // Verificar permissão (apenas criador do anexo ou admin)
    if (user.role !== "admin" && user.role !== "proprietario" && anexo.usuarioId !== user.id) {
      return apiError(
        "Sem permissão para remover este anexo. Apenas o criador ou um administrador pode removê-lo.",
        403
      );
    }

    // Remover do Vercel Blob
    try {
      await del(anexo.urlBlob);
    } catch (blobError) {
      console.warn("Erro ao deletar do Vercel Blob:", blobError);
      // Continua mesmo se falhar no Blob (pode já ter sido deletado)
    }

    // Registrar atividade antes de remover
    await logAtividade({
      tarefaId,
      usuarioId: user.id,
      tipoAcao: "ANEXO_REMOVIDO",
      detalhes: {
        nomeArquivo: anexo.nomeArquivo,
        tamanho: anexo.tamanho,
        mimeType: anexo.mimeType,
      },
    });

    // Remover do banco
    await db.delete(tarefasAnexos).where(eq(tarefasAnexos.id, anexoId));

    return apiSuccess({ message: "Anexo removido com sucesso" });
  } catch (error) {
    console.error("Erro ao remover anexo:", error);
    return apiError(
      error instanceof Error ? error.message : "Erro ao remover anexo",
      500
    );
  }
}

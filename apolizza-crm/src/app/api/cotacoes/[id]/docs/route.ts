import { NextRequest } from "next/server";
import { put, del } from "@vercel/blob";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacaoDocs, cotacoes } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

// GET /api/cotacoes/:id/docs
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { id } = await params;

    const docs = await db
      .select()
      .from(cotacaoDocs)
      .where(eq(cotacaoDocs.cotacaoId, id))
      .orderBy(cotacaoDocs.createdAt);

    return apiSuccess(docs);
  } catch (error) {
    console.error("API GET /api/cotacoes/[id]/docs:", error);
    return apiError("Erro ao listar documentos", 500);
  }
}

// POST /api/cotacoes/:id/docs (multipart upload)
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { id } = await params;

    // Check cotacao exists
    const [cotacao] = await db
      .select({ id: cotacoes.id })
      .from(cotacoes)
      .where(eq(cotacoes.id, id));
    if (!cotacao) return apiError("Cotacao nao encontrada", 404);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return apiError("Arquivo nao enviado", 400);

    // Validacao de tipo de arquivo
    const ALLOWED_TYPES = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return apiError(
        "Tipo de arquivo nao permitido. Aceitos: PDF, imagens, Word, Excel",
        400
      );
    }

    // Limite de 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return apiError("Arquivo muito grande. Limite: 10MB", 400);
    }

    // Story 10.4: Sanitizar nome do arquivo (remove path traversal, leading dots, caracteres especiais)
    const safeName = file.name
      .replace(/^\.+/, "")
      .replace(/[/\\]/g, "_")
      .replace(/\.\./g, "_")
      .replace(/[^a-zA-Z0-9._\-\s]/g, "_")
      .substring(0, 200);

    if (!safeName || safeName === "") {
      return apiError("Nome de arquivo invalido", 400);
    }

    // Upload to Vercel Blob
    const blob = await put(`cotacoes/${id}/${safeName}`, file, {
      access: "public",
    });

    // Save to DB
    const [doc] = await db
      .insert(cotacaoDocs)
      .values({
        cotacaoId: id,
        fileName: safeName,
        fileUrl: blob.url,
        fileSize: file.size,
        mimeType: file.type || null,
        uploadedBy: user.id,
      })
      .returning();

    return apiSuccess(doc);
  } catch (error) {
    console.error("API POST /api/cotacoes/[id]/docs:", error);
    return apiError("Erro ao fazer upload do documento", 500);
  }
}

// DELETE /api/cotacoes/:id/docs?docId=xxx
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { id } = await params;
    const docId = req.nextUrl.searchParams.get("docId");
    if (!docId) return apiError("docId obrigatorio", 400);

    const [doc] = await db
      .select()
      .from(cotacaoDocs)
      .where(and(eq(cotacaoDocs.id, docId), eq(cotacaoDocs.cotacaoId, id)));

    if (!doc) return apiError("Documento nao encontrado", 404);

    // Delete from Vercel Blob (log errors instead of silent catch)
    try {
      await del(doc.fileUrl);
    } catch (blobError) {
      console.error("Erro ao deletar blob:", blobError);
    }

    // Delete from DB
    await db.delete(cotacaoDocs).where(eq(cotacaoDocs.id, docId));

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("API DELETE /api/cotacoes/[id]/docs:", error);
    return apiError("Erro ao excluir documento", 500);
  }
}

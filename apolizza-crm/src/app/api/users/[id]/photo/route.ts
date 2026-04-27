import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB (base64 fica ~33% maior)

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return apiError("Nao autenticado", 401);

    const { id } = await params;

    if (currentUser.role !== "admin" && currentUser.role !== "proprietario" && currentUser.id !== id) {
      return apiError("Sem permissao", 403);
    }

    const formData = await req.formData();
    const file = formData.get("photo") as File | null;
    if (!file) return apiError("Arquivo nao enviado", 400);

    if (!ALLOWED_TYPES.includes(file.type)) {
      return apiError("Formato nao suportado. Use JPG, PNG ou WebP.", 400);
    }

    if (file.size > MAX_SIZE) {
      return apiError("Arquivo muito grande. Maximo 2 MB.", 400);
    }

    // Upload de foto está temporariamente desativado: o storage como data-URL
    // base64 estourava cookies de sessão (Vercel 494). Aguardando migração
    // para Vercel Blob — ver /api/users/[id]/photo na próxima story.
    return apiError(
      "Upload de foto temporariamente indisponível. Migração para storage externo em andamento.",
      503
    );
  } catch (error) {
    console.error("POST /api/users/[id]/photo:", error);
    return apiError("Erro ao fazer upload da foto", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return apiError("Nao autenticado", 401);

    const { id } = await params;

    if (currentUser.role !== "admin" && currentUser.role !== "proprietario" && currentUser.id !== id) {
      return apiError("Sem permissao", 403);
    }

    await db
      .update(users)
      .set({ photoUrl: null })
      .where(eq(users.id, id));

    return apiSuccess({ photoUrl: null });
  } catch (error) {
    console.error("DELETE /api/users/[id]/photo:", error);
    return apiError("Erro ao remover foto", 500);
  }
}

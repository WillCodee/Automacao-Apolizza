import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_EXTS = ["jpg", "jpeg", "png", "webp"];

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return apiError("Não autenticado", 401);

    const { id } = await params;

    // Admin pode alterar qualquer foto; usuário só a própria
    if (currentUser.role !== "admin" && currentUser.id !== id) {
      return apiError("Sem permissão", 403);
    }

    const formData = await req.formData();
    const file = formData.get("photo") as File | null;
    if (!file) return apiError("Arquivo não enviado", 400);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    if (!ALLOWED_EXTS.includes(ext)) {
      return apiError("Formato não suportado. Use JPG, PNG ou WebP.", 400);
    }

    if (file.size > 5 * 1024 * 1024) {
      return apiError("Arquivo muito grande. Máximo 5 MB.", 400);
    }

    const blob = await put(`users/${id}/photo.${ext}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    await db
      .update(users)
      .set({ photoUrl: blob.url })
      .where(eq(users.id, id));

    return apiSuccess({ photoUrl: blob.url });
  } catch (error) {
    console.error("POST /api/users/[id]/photo:", error);
    return apiError("Erro ao fazer upload da foto", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) return apiError("Não autenticado", 401);

    const { id } = await params;

    if (currentUser.role !== "admin" && currentUser.id !== id) {
      return apiError("Sem permissão", 403);
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

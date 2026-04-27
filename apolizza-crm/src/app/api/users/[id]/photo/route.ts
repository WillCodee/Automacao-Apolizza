import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { put, del } from "@vercel/blob";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const BLOB_HOST = "blob.vercel-storage.com";

function isBlobUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST);
  } catch {
    return false;
  }
}

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

    const ext = file.type.split("/")[1] ?? "jpg";
    const pathname = `users/${id}/avatar-${Date.now()}.${ext}`;

    const blob = await put(pathname, file, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });

    // Apaga a foto antiga se também era do Blob (evita lixo acumulando)
    const [previous] = await db
      .select({ photoUrl: users.photoUrl })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    await db.update(users).set({ photoUrl: blob.url }).where(eq(users.id, id));

    if (isBlobUrl(previous?.photoUrl) && previous!.photoUrl !== blob.url) {
      try {
        await del(previous!.photoUrl!);
      } catch (cleanupErr) {
        console.warn("[photo] cleanup do blob anterior falhou:", cleanupErr);
      }
    }

    return apiSuccess({ photoUrl: blob.url });
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

    const [previous] = await db
      .select({ photoUrl: users.photoUrl })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    await db.update(users).set({ photoUrl: null }).where(eq(users.id, id));

    if (isBlobUrl(previous?.photoUrl)) {
      try {
        await del(previous!.photoUrl!);
      } catch (cleanupErr) {
        console.warn("[photo] cleanup do blob falhou:", cleanupErr);
      }
    }

    return apiSuccess({ photoUrl: null });
  } catch (error) {
    console.error("DELETE /api/users/[id]/photo:", error);
    return apiError("Erro ao remover foto", 500);
  }
}

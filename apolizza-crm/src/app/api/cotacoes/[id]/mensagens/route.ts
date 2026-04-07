import { NextRequest } from "next/server";
import { eq, asc } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { cotacaoMensagens, users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

type Params = { params: Promise<{ id: string }> };

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { id } = await params;

    const mensagens = await db
      .select({
        id: cotacaoMensagens.id,
        texto: cotacaoMensagens.texto,
        imageUrl: cotacaoMensagens.imageUrl,
        createdAt: cotacaoMensagens.createdAt,
        userId: cotacaoMensagens.userId,
        userName: users.name,
        userPhoto: users.photoUrl,
      })
      .from(cotacaoMensagens)
      .leftJoin(users, eq(cotacaoMensagens.userId, users.id))
      .where(eq(cotacaoMensagens.cotacaoId, id))
      .orderBy(asc(cotacaoMensagens.createdAt));

    return apiSuccess(mensagens);
  } catch (error) {
    console.error("GET /api/cotacoes/[id]/mensagens:", error);
    return apiError("Erro ao buscar mensagens", 500);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { id } = await params;

    let texto = "";
    let imageUrl: string | null = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      texto = (formData.get("texto") as string | null)?.trim() ?? "";
      const image = formData.get("image") as File | null;

      if (image && image.size > 0) {
        if (!ALLOWED_IMAGE_TYPES.includes(image.type)) {
          return apiError("Tipo de imagem nao permitido. Use JPG, PNG, WEBP ou GIF", 400);
        }
        if (image.size > MAX_IMAGE_SIZE) {
          return apiError("Imagem muito grande. Limite: 5MB", 400);
        }
        const safeName = `${Date.now()}-${image.name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 100)}`;
        const blob = await put(`mensagens/${id}/${safeName}`, image, { access: "public" });
        imageUrl = blob.url;
      }
    } else {
      const body = await req.json();
      texto = typeof body.texto === "string" ? body.texto.trim() : "";
    }

    if (!texto && !imageUrl) return apiError("Mensagem vazia", 400);
    if (texto.length > 2000) return apiError("Texto muito longo (max 2000 chars)", 400);

    const [nova] = await db
      .insert(cotacaoMensagens)
      .values({ cotacaoId: id, userId: user.id, texto, imageUrl })
      .returning();

    const [comUser] = await db
      .select({
        id: cotacaoMensagens.id,
        texto: cotacaoMensagens.texto,
        imageUrl: cotacaoMensagens.imageUrl,
        createdAt: cotacaoMensagens.createdAt,
        userId: cotacaoMensagens.userId,
        userName: users.name,
        userPhoto: users.photoUrl,
      })
      .from(cotacaoMensagens)
      .leftJoin(users, eq(cotacaoMensagens.userId, users.id))
      .where(eq(cotacaoMensagens.id, nova.id));

    return apiSuccess(comUser, 201);
  } catch (error) {
    console.error("POST /api/cotacoes/[id]/mensagens:", error);
    return apiError("Erro ao enviar mensagem", 500);
  }
}

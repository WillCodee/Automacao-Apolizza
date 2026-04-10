import { z } from "zod/v4";
import { db } from "@/lib/db";
import { gruposUsuarios, grupoMembros, users } from "@/lib/schema";
import { apiSuccess, apiError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/auth-helpers";
import { eq } from "drizzle-orm";

const createGrupoSchema = z.object({
  nome: z.string().min(1).max(100),
  descricao: z.string().optional(),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return apiError("Não autenticado", 401);

  const grupos = await db.select().from(gruposUsuarios).orderBy(gruposUsuarios.nome);

  const gruposComMembros = await Promise.all(
    grupos.map(async (grupo) => {
      const membros = await db
        .select({
          id: users.id,
          name: users.name,
          photoUrl: users.photoUrl,
        })
        .from(grupoMembros)
        .innerJoin(users, eq(grupoMembros.userId, users.id))
        .where(eq(grupoMembros.grupoId, grupo.id));

      return {
        ...grupo,
        membros,
        totalMembros: membros.length,
      };
    })
  );

  return apiSuccess(gruposComMembros);
}

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return apiError("Não autenticado", 401);
  if (currentUser.role !== "admin" && currentUser.role !== "proprietario") return apiError("Acesso negado.", 403);

  const body = await request.json();
  const parsed = createGrupoSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Dados inválidos", 400);
  }

  const { nome, descricao, cor } = parsed.data;

  const [created] = await db
    .insert(gruposUsuarios)
    .values({
      nome,
      descricao: descricao ?? null,
      cor: cor ?? "#03a4ed",
    })
    .returning();

  return apiSuccess({ ...created, membros: [], totalMembros: 0 }, 201);
}

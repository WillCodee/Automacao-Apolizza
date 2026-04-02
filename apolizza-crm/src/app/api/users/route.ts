import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        photoUrl: users.photoUrl,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.name);

    // Non-admin only see active users (basic info)
    if (user.role !== "admin") {
      return apiSuccess(rows.filter((r) => r.isActive));
    }

    return apiSuccess(rows);
  } catch (error) {
    console.error("API GET /api/users:", error);
    return apiError("Erro ao listar usuarios", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "admin") return apiError("Apenas admin", 403);

    const body = await req.json();
    const { name, email, username, password, role } = body;

    if (!name || !email || !username || !password) {
      return apiError("Nome, email, username e senha sao obrigatorios", 400);
    }

    // Check duplicates
    const [existingEmail] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    if (existingEmail) return apiError("Email ja cadastrado", 409);

    const [existingUsername] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username));
    if (existingUsername) return apiError("Username ja cadastrado", 409);

    const passwordHash = await bcrypt.hash(password, 12);

    const [created] = await db
      .insert(users)
      .values({
        name,
        email,
        username,
        passwordHash,
        role: role || "cotador",
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return apiSuccess(created);
  } catch (error) {
    console.error("API POST /api/users:", error);
    return apiError("Erro ao criar usuario", 500);
  }
}

import { auth } from "./auth";

export type UserRole = "admin" | "cotador" | "proprietario";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  image?: string | null;
};

export function isAdminOrProprietario(role: UserRole): boolean {
  return role === "admin" || role === "proprietario";
}

export function isProprietario(role: UserRole): boolean {
  return role === "proprietario";
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  return {
    id: session.user.id,
    email: session.user.email!,
    name: session.user.name!,
    role: session.user.role as UserRole,
    image: session.user.image,
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: "Nao autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth();
  if (!isAdminOrProprietario(user.role)) {
    throw new Response(JSON.stringify({ error: "Acesso negado. Admin ou Proprietario requerido." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

export async function requireProprietario(): Promise<SessionUser> {
  const user = await requireAuth();
  if (!isProprietario(user.role)) {
    throw new Response(JSON.stringify({ error: "Acesso negado. Proprietario requerido." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

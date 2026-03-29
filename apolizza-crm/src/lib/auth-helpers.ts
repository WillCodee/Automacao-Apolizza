import { auth } from "./auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "cotador";
  image?: string | null;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  return {
    id: session.user.id,
    email: session.user.email!,
    name: session.user.name!,
    role: session.user.role,
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
  if (user.role !== "admin") {
    throw new Response(JSON.stringify({ error: "Acesso negado. Admin requerido." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

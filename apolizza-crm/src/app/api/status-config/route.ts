import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { statusConfig } from "@/lib/schema";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const rows = await db
      .select()
      .from(statusConfig)
      .orderBy(asc(statusConfig.orderIndex));

    return apiSuccess(rows);
  } catch (error) {
    console.error("API GET /api/status-config:", error);
    return apiError("Erro ao listar configuracoes de status", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);
    if (user.role !== "proprietario") return apiError("Apenas o proprietário pode configurar status", 403);

    const body = await req.json();
    const { statusName, displayLabel, color, icon, orderIndex, isTerminal, requiredFields } = body;

    if (!statusName || !displayLabel || !color) {
      return apiError("statusName, displayLabel e color sao obrigatorios", 400);
    }

    const insertData = {
      statusName: statusName.trim().toLowerCase(),
      displayLabel: displayLabel.trim(),
      color,
      icon: icon || null,
      orderIndex: orderIndex ?? 0,
      isTerminal: isTerminal ?? false,
      requiredFields: requiredFields ?? [],
    };
    await db.insert(statusConfig).values(insertData);
    const [created] = await db
      .select()
      .from(statusConfig)
      .where(eq(statusConfig.statusName, insertData.statusName));

    return apiSuccess(created, 201);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return apiError("Ja existe um status com esse nome", 409);
    }
    console.error("API POST /api/status-config:", error);
    return apiError("Erro ao criar status", 500);
  }
}

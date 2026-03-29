import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { apiError, apiSuccess, validateAno } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Nao autenticado", 401);

    const { searchParams } = req.nextUrl;
    const ano = searchParams.get("ano") || String(new Date().getFullYear());
    const mes = searchParams.get("mes") || String(new Date().getMonth() + 1);

    if (!validateAno(ano)) return apiError("Ano invalido", 400);
    const mesNum = Number(mes);
    if (!Number.isInteger(mesNum) || mesNum < 1 || mesNum > 12) return apiError("Mes invalido", 400);

    const anoNum = Number(ano);
    const startDate = `${anoNum}-${String(mesNum).padStart(2, "0")}-01`;
    const endDate = mesNum === 12
      ? `${anoNum + 1}-01-01`
      : `${anoNum}-${String(mesNum + 1).padStart(2, "0")}-01`;

    const isCotador = user.role === "cotador";
    const userFilter = isCotador ? sql`and c.assignee_id = ${user.id}` : sql``;

    const result = await db.execute(sql`
      select
        c.id,
        c.name,
        c.status,
        c.proxima_tratativa as "proximaTratativa",
        c.fim_vigencia as "fimVigencia",
        c.primeiro_pagamento as "primeiroPagamento",
        u.name as "cotador"
      from cotacoes c
      left join users u on u.id = c.assignee_id
      where c.deleted_at is null
        ${userFilter}
        and (
          (c.proxima_tratativa >= ${startDate}::date and c.proxima_tratativa < ${endDate}::date)
          or (c.fim_vigencia >= ${startDate}::date and c.fim_vigencia < ${endDate}::date)
          or (c.primeiro_pagamento >= ${startDate}::date and c.primeiro_pagamento < ${endDate}::date)
        )
      order by c.name
    `);

    return apiSuccess({
      ano: anoNum,
      mes: mesNum,
      eventos: result.rows,
    });
  } catch (error) {
    console.error("API GET /api/calendario:", error);
    return apiError("Erro ao carregar calendario", 500);
  }
}

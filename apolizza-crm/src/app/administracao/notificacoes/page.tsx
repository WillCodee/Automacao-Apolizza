import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

type Notificacao = {
  id: string;
  texto: string;
  createdAt: string;
  fromUserId: string;
  fromUserName: string | null;
  fromUserPhoto: string | null;
  toUserId: string | null;
  toUserName: string | null;
  naoLida: boolean;
};

function fmtDateTime(v: string) {
  return new Date(v).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function NotificacoesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const userId = session.user.id as string;

  const result = await db.execute(sql`
    SELECT
      m.id,
      m.texto,
      m.created_at as "createdAt",
      m.from_user_id as "fromUserId",
      uf.name as "fromUserName",
      uf.photo_url as "fromUserPhoto",
      m.to_user_id as "toUserId",
      ut.name as "toUserName",
      NOT EXISTS (
        SELECT 1 FROM chat_leituras l WHERE l.mensagem_id = m.id AND l.user_id = ${userId}
      ) AND m.from_user_id != ${userId} as "naoLida"
    FROM chat_mensagens m
    JOIN users uf ON uf.id = m.from_user_id
    LEFT JOIN users ut ON ut.id = m.to_user_id
    ORDER BY m.created_at DESC
    LIMIT 100
  `);

  const notificacoes = result.rows as Notificacao[];

  const totalNaoLidas = notificacoes.filter((n) => n.naoLida).length;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader userName={session.user.name || ""} userRole={session.user.role} activePage="notificacoes" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notificações</h1>
            <p className="text-slate-500 text-sm mt-1">
              Mensagens do chat global.
              {totalNaoLidas > 0 && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-[#03a4ed]/10 text-[#03a4ed]">
                  {totalNaoLidas} nao lida{totalNaoLidas > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
        </div>

        {notificacoes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-700 mb-1">Nenhuma notificacao ainda</h3>
            <p className="text-sm text-slate-400">As mensagens do chat aparecerao aqui.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
            {notificacoes.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                  n.naoLida ? "bg-[#03a4ed]/[0.03]" : ""
                }`}
              >
                {/* Avatar */}
                <div className="shrink-0 mt-0.5">
                  {n.fromUserPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={n.fromUserPhoto}
                      alt={n.fromUserName || ""}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#03a4ed]/10 flex items-center justify-center text-[#03a4ed] font-bold text-sm">
                      {(n.fromUserName || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-sm">
                      {n.fromUserName || "Usuario"}
                    </span>
                    <span className="text-slate-400 text-xs">→</span>
                    <span className="text-sm text-slate-600">
                      {n.toUserId ? (n.toUserName || "usuario") : "Todos"}
                    </span>
                    {n.naoLida && (
                      <span className="w-2 h-2 rounded-full bg-[#03a4ed] shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-slate-700 mt-1 break-words">{n.texto}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{fmtDateTime(n.createdAt)}</p>
                </div>

                {/* Badge */}
                <div className="shrink-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    n.toUserId
                      ? "bg-violet-100 text-violet-700"
                      : "bg-[#03a4ed]/10 text-[#03a4ed]"
                  }`}>
                    {n.toUserId ? "Direto" : "Todos"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

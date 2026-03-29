"use client";

const STATUS_COLORS: Record<string, string> = {
  "nao iniciado": "#94a3b8",
  "em andamento": "#03a4ed",
  pendencia: "#eab308",
  aguardando: "#38bdf8",
  "em analise": "#f97316",
  aprovado: "#14b8a6",
  implantando: "#10b981",
  "venda parada": "#a855f7",
  atrasado: "#ef4444",
  fechado: "#22c55e",
  perda: "#ff695f",
  cancelado: "#dc2626",
};

type StatusData = { status: string; count: number; total: number };

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function StatusBreakdown({ data }: { data: StatusData[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">
        Status das Cotacoes
      </h3>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.status}>
            <div className="flex items-center justify-between text-sm mb-1">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: STATUS_COLORS[item.status] || "#94a3b8" }}
                />
                <span className="text-slate-600 capitalize">{item.status}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">{fmt(item.total)}</span>
                <span className="font-semibold text-slate-900 w-6 text-right">{item.count}</span>
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${(item.count / maxCount) * 100}%`,
                  backgroundColor: STATUS_COLORS[item.status] || "#94a3b8",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

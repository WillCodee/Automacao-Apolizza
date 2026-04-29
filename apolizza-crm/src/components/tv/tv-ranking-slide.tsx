"use client";

interface Cotador {
  userId: string;
  name: string;
  photoUrl: string | null;
  totalCotacoes: number;
  fechadas: number;
  perdas: number;
  faturamento: number;
  taxaConversao: number;
  totalRenovacoes: number;
  fechadasRenovacao: number;
  faturamentoRenovacao: number;
  fechadasNovas: number;
  faturamentoNovas: number;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

const COLS = "20px 34px 1fr 80px 80px 80px 130px 72px";

export default function TvRankingSlide({ cotadores }: { cotadores: Cotador[] }) {
  const top = cotadores.slice(0, 10);
  const maxFat = Math.max(...top.map(c => c.faturamento), 1);

  return (
    <div className="flex flex-col h-full" style={{ padding: "14px 20px" }}>
      <h2
        className="font-bold text-white text-center tracking-wide flex-shrink-0"
        style={{ fontSize: 28, marginBottom: 10 }}
      >
        Ranking Cotadores
      </h2>

      <div className="flex-1 flex flex-col overflow-hidden" style={{ gap: 5 }}>
        {/* Header row */}
        <div
          className="grid items-center text-slate-400 uppercase tracking-wider font-semibold flex-shrink-0"
          style={{ gridTemplateColumns: COLS, gap: 6, padding: "0 10px", fontSize: 10 }}
        >
          <span>#</span>
          <span></span>
          <span>Nome</span>
          <span className="text-right">Fechadas</span>
          <span className="text-right text-red-400">Perdas</span>
          <span className="text-right text-sky-400">Andamento</span>
          <span className="text-right">Faturamento</span>
          <span className="text-right">Taxa</span>
        </div>

        {top.map((c, i) => {
          const pct = (c.faturamento / maxFat) * 100;
          const isFirst = i === 0;
          const emAndamento = Math.max(c.totalCotacoes - c.fechadas - c.perdas, 0);

          return (
            <div
              key={c.userId}
              className={`grid items-center relative overflow-hidden rounded-xl flex-1 min-h-0 ${
                isFirst
                  ? "bg-gradient-to-r from-yellow-900/30 to-yellow-800/10 border border-yellow-600/40"
                  : "bg-slate-800/60"
              }`}
              style={{ gridTemplateColumns: COLS, gap: 6, padding: "6px 10px" }}
            >
              <div className="absolute inset-y-0 left-0 bg-sky-500/10 rounded-xl transition-all" style={{ width: `${pct}%` }} />

              <span className={`relative z-10 font-bold ${isFirst ? "text-yellow-400" : "text-slate-400"}`} style={{ fontSize: 22 }}>
                {i + 1}
              </span>

              <div className="relative z-10 flex-shrink-0">
                {c.photoUrl ? (
                  <img
                    src={c.photoUrl}
                    alt={c.name}
                    className={`rounded-full object-cover ${isFirst ? "ring-2 ring-yellow-500" : ""}`}
                    style={{ width: 32, height: 32 }}
                  />
                ) : (
                  <div
                    className={`rounded-full flex items-center justify-center font-bold ${
                      isFirst ? "bg-yellow-600 text-white" : "bg-slate-600 text-slate-300"
                    }`}
                    style={{ width: 32, height: 32, fontSize: 11 }}
                  >
                    {initials(c.name)}
                  </div>
                )}
              </div>

              <span className="relative z-10 text-white font-semibold truncate" style={{ fontSize: 16 }}>
                {c.name}
              </span>

              <span className="relative z-10 text-right text-green-400 font-bold" style={{ fontSize: 20 }}>
                {c.fechadas}
              </span>

              <span className="relative z-10 text-right text-red-400 font-bold" style={{ fontSize: 20 }}>
                {c.perdas}
              </span>

              <span className="relative z-10 text-right text-sky-400 font-semibold" style={{ fontSize: 20 }}>
                {emAndamento}
              </span>

              <span className="relative z-10 text-right text-emerald-400 font-bold" style={{ fontSize: 16 }}>
                {fmt(c.faturamento)}
              </span>

              <span className="relative z-10 text-right text-slate-300 font-semibold" style={{ fontSize: 15 }}>
                {Number(c.taxaConversao).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

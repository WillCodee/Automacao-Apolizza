"use client";

interface Cotador {
  userId: string;
  name: string;
  photoUrl: string | null;
  totalCotacoes: number;
  fechadas: number;
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

export default function TvRankingSlide({ cotadores }: { cotadores: Cotador[] }) {
  const top = cotadores.slice(0, 10);
  const maxFat = Math.max(...top.map(c => c.faturamento), 1);

  return (
    <div className="flex flex-col h-full px-6 py-4">
      <h2 className="text-2xl font-bold text-white mb-4 text-center tracking-wide">
        Ranking Cotadores
      </h2>

      <div className="flex-1 flex flex-col gap-2 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[40px_48px_1fr_100px_160px_80px] gap-3 items-center px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span>#</span>
          <span></span>
          <span>Nome</span>
          <span className="text-right">Fechadas</span>
          <span className="text-right">Faturamento</span>
          <span className="text-right">Taxa</span>
        </div>

        {top.map((c, i) => {
          const pct = (c.faturamento / maxFat) * 100;
          const isFirst = i === 0;
          return (
            <div
              key={c.userId}
              className={`grid grid-cols-[40px_48px_1fr_100px_160px_80px] gap-3 items-center px-3 py-2 rounded-xl relative overflow-hidden ${
                isFirst
                  ? "bg-gradient-to-r from-yellow-900/30 to-yellow-800/10 border border-yellow-600/40"
                  : "bg-slate-800/60"
              }`}
            >
              {/* Bar background */}
              <div
                className="absolute inset-y-0 left-0 bg-sky-500/10 rounded-xl transition-all"
                style={{ width: `${pct}%` }}
              />

              {/* Position */}
              <span className={`relative z-10 text-lg font-bold ${isFirst ? "text-yellow-400" : "text-slate-400"}`}>
                {i + 1}
              </span>

              {/* Avatar */}
              <div className="relative z-10">
                {c.photoUrl ? (
                  <img
                    src={c.photoUrl}
                    alt={c.name}
                    className={`w-10 h-10 rounded-full object-cover ${isFirst ? "ring-2 ring-yellow-500" : ""}`}
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    isFirst ? "bg-yellow-600 text-white" : "bg-slate-600 text-slate-300"
                  }`}>
                    {initials(c.name)}
                  </div>
                )}
              </div>

              {/* Name */}
              <span className="relative z-10 text-white font-semibold text-base truncate">
                {c.name}
              </span>

              {/* Fechadas */}
              <span className="relative z-10 text-right text-green-400 font-bold text-lg">
                {c.fechadas}
              </span>

              {/* Faturamento */}
              <span className="relative z-10 text-right text-sky-400 font-bold text-lg">
                {fmt(c.faturamento)}
              </span>

              {/* Taxa */}
              <span className="relative z-10 text-right text-slate-300 font-semibold text-base">
                {Number(c.taxaConversao).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

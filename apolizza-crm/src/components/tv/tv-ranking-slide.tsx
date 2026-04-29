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

const COLS = "clamp(1.25rem,2.2vmin,3rem) clamp(1.75rem,3vmin,4rem) 1fr clamp(3.5rem,7vmin,9rem) clamp(3.5rem,7vmin,9rem) clamp(3.5rem,7vmin,9rem) clamp(5.5rem,10vmin,14rem) clamp(3rem,5.5vmin,7rem)";

export default function TvRankingSlide({ cotadores }: { cotadores: Cotador[] }) {
  const top = cotadores.slice(0, 10);
  const maxFat = Math.max(...top.map(c => c.faturamento), 1);

  return (
    <div className="flex flex-col h-full" style={{ padding: "clamp(0.5rem, 1.2vmin, 1.75rem) clamp(0.75rem, 1.5vmin, 2.5rem)" }}>
      <h2
        className="font-bold text-white text-center tracking-wide flex-shrink-0"
        style={{ fontSize: "clamp(1rem, 2.8vmin, 3rem)", marginBottom: "clamp(0.3rem, 0.8vmin, 1.25rem)" }}
      >
        Ranking Cotadores
      </h2>

      <div className="flex-1 flex flex-col overflow-hidden" style={{ gap: "clamp(0.15rem, 0.4vmin, 0.6rem)" }}>
        {/* Header row */}
        <div
          className="grid items-center text-slate-400 uppercase tracking-wider font-semibold flex-shrink-0"
          style={{
            gridTemplateColumns: COLS,
            gap: "clamp(0.25rem, 0.6vmin, 0.875rem)",
            padding: "0 clamp(0.4rem, 0.8vmin, 1.25rem)",
            fontSize: "clamp(0.5rem, 0.8vmin, 0.875rem)",
          }}
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
          const avatarSize = "clamp(1.5rem, 3vmin, 4rem)";
          const emAndamento = Math.max(c.totalCotacoes - c.fechadas - c.perdas, 0);

          return (
            <div
              key={c.userId}
              className={`grid items-center relative overflow-hidden rounded-xl flex-1 min-h-0 ${
                isFirst
                  ? "bg-gradient-to-r from-yellow-900/30 to-yellow-800/10 border border-yellow-600/40"
                  : "bg-slate-800/60"
              }`}
              style={{
                gridTemplateColumns: COLS,
                gap: "clamp(0.25rem, 0.6vmin, 0.875rem)",
                padding: "clamp(0.2rem, 0.5vmin, 0.75rem) clamp(0.4rem, 0.8vmin, 1.25rem)",
              }}
            >
              {/* Progress bar background */}
              <div
                className="absolute inset-y-0 left-0 bg-sky-500/10 rounded-xl transition-all"
                style={{ width: `${pct}%` }}
              />

              {/* Position */}
              <span
                className={`relative z-10 font-bold ${isFirst ? "text-yellow-400" : "text-slate-400"}`}
                style={{ fontSize: "clamp(0.875rem, 2vmin, 2.25rem)" }}
              >
                {i + 1}
              </span>

              {/* Avatar */}
              <div className="relative z-10 flex-shrink-0">
                {c.photoUrl ? (
                  <img
                    src={c.photoUrl}
                    alt={c.name}
                    className={`rounded-full object-cover ${isFirst ? "ring-2 ring-yellow-500" : ""}`}
                    style={{ width: avatarSize, height: avatarSize }}
                  />
                ) : (
                  <div
                    className={`rounded-full flex items-center justify-center font-bold ${
                      isFirst ? "bg-yellow-600 text-white" : "bg-slate-600 text-slate-300"
                    }`}
                    style={{ width: avatarSize, height: avatarSize, fontSize: "clamp(0.5rem, 1vmin, 1.25rem)" }}
                  >
                    {initials(c.name)}
                  </div>
                )}
              </div>

              {/* Name */}
              <span
                className="relative z-10 text-white font-semibold truncate"
                style={{ fontSize: "clamp(0.7rem, 1.5vmin, 1.75rem)" }}
              >
                {c.name}
              </span>

              {/* Fechadas */}
              <span
                className="relative z-10 text-right text-green-400 font-bold"
                style={{ fontSize: "clamp(0.8rem, 1.8vmin, 2rem)" }}
              >
                {c.fechadas}
              </span>

              {/* Perdas */}
              <span
                className="relative z-10 text-right text-red-400 font-bold"
                style={{ fontSize: "clamp(0.8rem, 1.8vmin, 2rem)" }}
              >
                {c.perdas}
              </span>

              {/* Em Andamento */}
              <span
                className="relative z-10 text-right text-sky-400 font-semibold"
                style={{ fontSize: "clamp(0.8rem, 1.8vmin, 2rem)" }}
              >
                {emAndamento}
              </span>

              {/* Faturamento */}
              <span
                className="relative z-10 text-right text-emerald-400 font-bold"
                style={{ fontSize: "clamp(0.7rem, 1.5vmin, 1.75rem)" }}
              >
                {fmt(c.faturamento)}
              </span>

              {/* Taxa */}
              <span
                className="relative z-10 text-right text-slate-300 font-semibold"
                style={{ fontSize: "clamp(0.65rem, 1.4vmin, 1.5rem)" }}
              >
                {Number(c.taxaConversao).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

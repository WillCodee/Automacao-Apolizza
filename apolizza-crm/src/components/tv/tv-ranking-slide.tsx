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
    <div className="flex flex-col h-full" style={{ padding: "clamp(0.75rem, 1.5vw, 1.75rem) clamp(1rem, 2vw, 2.5rem)" }}>
      <h2
        className="font-bold text-white text-center tracking-wide flex-shrink-0"
        style={{ fontSize: "clamp(1.25rem, 2.8vw, 3rem)", marginBottom: "clamp(0.5rem, 1vw, 1.25rem)" }}
      >
        Ranking Cotadores
      </h2>

      <div className="flex-1 flex flex-col overflow-hidden" style={{ gap: "clamp(0.2rem, 0.5vw, 0.6rem)" }}>
        {/* Header row */}
        <div
          className="grid items-center text-slate-400 uppercase tracking-wider font-semibold flex-shrink-0"
          style={{
            gridTemplateColumns: "clamp(2rem,3vw,3.5rem) clamp(2.5rem,4vw,4.5rem) 1fr clamp(5rem,9vw,10rem) clamp(8rem,14vw,16rem) clamp(4rem,7vw,8rem)",
            gap: "clamp(0.4rem, 0.8vw, 1rem)",
            padding: "0 clamp(0.5rem, 1vw, 1.25rem)",
            fontSize: "clamp(0.6rem, 1vw, 0.9rem)",
          }}
        >
          <span>#</span>
          <span></span>
          <span>Nome</span>
          <span style={{ textAlign: "right" }}>Fechadas</span>
          <span style={{ textAlign: "right" }}>Faturamento</span>
          <span style={{ textAlign: "right" }}>Taxa</span>
        </div>

        {top.map((c, i) => {
          const pct = (c.faturamento / maxFat) * 100;
          const isFirst = i === 0;
          const avatarSize = "clamp(2rem, 3.5vw, 4rem)";
          return (
            <div
              key={c.userId}
              className={`grid items-center relative overflow-hidden rounded-xl flex-1 min-h-0 ${
                isFirst
                  ? "bg-gradient-to-r from-yellow-900/30 to-yellow-800/10 border border-yellow-600/40"
                  : "bg-slate-800/60"
              }`}
              style={{
                gridTemplateColumns: "clamp(2rem,3vw,3.5rem) clamp(2.5rem,4vw,4.5rem) 1fr clamp(5rem,9vw,10rem) clamp(8rem,14vw,16rem) clamp(4rem,7vw,8rem)",
                gap: "clamp(0.4rem, 0.8vw, 1rem)",
                padding: "clamp(0.3rem, 0.6vw, 0.75rem) clamp(0.5rem, 1vw, 1.25rem)",
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
                style={{ fontSize: "clamp(1rem, 2vw, 2.25rem)" }}
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
                    style={{ width: avatarSize, height: avatarSize, fontSize: "clamp(0.65rem, 1.2vw, 1.25rem)" }}
                  >
                    {initials(c.name)}
                  </div>
                )}
              </div>

              {/* Name */}
              <span
                className="relative z-10 text-white font-semibold truncate"
                style={{ fontSize: "clamp(0.85rem, 1.6vw, 1.75rem)" }}
              >
                {c.name}
              </span>

              {/* Fechadas */}
              <span
                className="relative z-10 text-right text-green-400 font-bold"
                style={{ fontSize: "clamp(1rem, 2vw, 2.25rem)" }}
              >
                {c.fechadas}
              </span>

              {/* Faturamento */}
              <span
                className="relative z-10 text-right text-sky-400 font-bold"
                style={{ fontSize: "clamp(0.85rem, 1.7vw, 1.875rem)" }}
              >
                {fmt(c.faturamento)}
              </span>

              {/* Taxa */}
              <span
                className="relative z-10 text-right text-slate-300 font-semibold"
                style={{ fontSize: "clamp(0.8rem, 1.5vw, 1.625rem)" }}
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

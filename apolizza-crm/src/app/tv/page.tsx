"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import TvRankingSlide from "@/components/tv/tv-ranking-slide";
import TvMetaSlide from "@/components/tv/tv-meta-slide";
import TvMonthlySlide from "@/components/tv/tv-monthly-slide";
import TvKpisSlide from "@/components/tv/tv-kpis-slide";
import TvCclienteSlide from "@/components/tv/tv-ccliente-slide";

const MES_ARR = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const SLIDE_NAMES = ["Ranking", "Meta", "Evolucao", "KPIs", "C.Cliente"];
const SLIDE_INTERVAL = 300_000;
const REFRESH_INTERVAL = 2_000;
const FADE_DURATION = 500;
const TOTAL_SLIDES = 5;

const DESIGN_W = 1920;
const DESIGN_H = 1080;

interface TVData {
  ano: number;
  mes: string;
  kpis: {
    totalCotacoes: number;
    fechadas: number;
    perdas: number;
    emAndamento: number;
    atrasadas: number;
    totalAReceber: number;
    totalPipeline: number;
    totalAReceberTotal: number;
    totalValorPerda: number;
    totalPremio: number;
    taxaConversao: number;
    totalRenovacoes: number;
    fechadasRenovacao: number;
    aReceberRenovacao: number;
    perdasRenovacao: number;
    totalNovas: number;
    fechadasNovas: number;
    aReceberNovas: number;
  };
  statusBreakdown: { status: string; count: number; total: number }[];
  monthlyTrend: {
    mes: string; ano: number; fechadas: number; perdas: number;
    total: number; aReceber: number;
    fechadasRenovacao: number; aReceberRenovacao: number;
    fechadasNovas: number; aReceberNovas: number;
  }[];
  cotadores: {
    userId: string; name: string; photoUrl: string | null;
    totalCotacoes: number; fechadas: number; perdas: number;
    faturamento: number; taxaConversao: number;
    totalRenovacoes: number; fechadasRenovacao: number;
    faturamentoRenovacao: number; fechadasNovas: number; faturamentoNovas: number;
  }[];
  metaMensal: number | null;
  semanas: { semana: number; novas: number; fechadas: number; perdas: number; ganho: number; ganhoAcumulado: number }[];
  ccliente: { total: number; emConversao: number; tratativasHoje: number; semTratativa: number };
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function useTvScale() {
  const [scaleStyle, setScaleStyle] = useState<React.CSSProperties>({
    position: "absolute", width: DESIGN_W, height: DESIGN_H, top: 0, left: 0,
  });

  useEffect(() => {
    const update = () => {
      const scale = Math.min(window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
      const x = (window.innerWidth - DESIGN_W * scale) / 2;
      const y = (window.innerHeight - DESIGN_H * scale) / 2;
      setScaleStyle({
        position: "absolute",
        width: DESIGN_W,
        height: DESIGN_H,
        top: 0,
        left: 0,
        transformOrigin: "top left",
        transform: `translate(${x}px, ${y}px) scale(${scale})`,
      });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return scaleStyle;
}

function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-slate-300" style={{ fontSize: 20 }}>{time}</span>;
}

export default function TvPageWrapper() {
  return (
    <Suspense fallback={
      <div style={{ position: "fixed", inset: 0, background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="text-slate-400 animate-pulse" style={{ fontSize: 28 }}>Carregando...</div>
      </div>
    }>
      <TvPage />
    </Suspense>
  );
}

function TvPage() {
  const params = useSearchParams();
  const token = params.get("token");
  const tvStyle = useTvScale();

  const [data, setData] = useState<TVData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [countdown, setCountdown] = useState(SLIDE_INTERVAL / 1000);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/tv?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        if (res.status === 401) { setError("Token invalido"); return; }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        setError(null);
        setLastUpdate(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      }
    } catch {
      console.error("TV fetch error");
    }
  }, [token]);

  const goToSlide = useCallback((idx: number) => {
    setOpacity(0);
    setTimeout(() => {
      setSlideIndex(idx);
      setOpacity(1);
    }, FADE_DURATION);

    setCountdown(SLIDE_INTERVAL / 1000);
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    timerRef.current = setInterval(() => {
      setOpacity(0);
      setTimeout(() => {
        setSlideIndex(prev => (prev + 1) % TOTAL_SLIDES);
        setOpacity(1);
      }, FADE_DURATION);
      setCountdown(SLIDE_INTERVAL / 1000);
    }, SLIDE_INTERVAL);

    countdownRef.current = setInterval(() => {
      setCountdown(prev => Math.max(prev - 1, 0));
    }, 1000);
  }, []);

  const goNext = useCallback(() => {
    goToSlide((slideIndex + 1) % TOTAL_SLIDES);
  }, [slideIndex, goToSlide]);

  const goPrev = useCallback(() => {
    goToSlide((slideIndex - 1 + TOTAL_SLIDES) % TOTAL_SLIDES);
  }, [slideIndex, goToSlide]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setOpacity(0);
      setTimeout(() => {
        setSlideIndex(prev => (prev + 1) % TOTAL_SLIDES);
        setOpacity(1);
      }, FADE_DURATION);
      setCountdown(SLIDE_INTERVAL / 1000);
    }, SLIDE_INTERVAL);

    countdownRef.current = setInterval(() => {
      setCountdown(prev => Math.max(prev - 1, 0));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  if (!token) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <p className="text-red-400 text-center" style={{ fontSize: 24 }}>
          Token nao fornecido. Use: /tv?token=SEU_TOKEN
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <p className="text-red-400 text-center" style={{ fontSize: 24 }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="text-slate-400 animate-pulse" style={{ fontSize: 28 }}>Carregando dados...</div>
      </div>
    );
  }

  const now = new Date();
  const mesLabel = MES_ARR[now.getMonth()];
  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0f172a", overflow: "hidden" }}>
      <div
        className="text-white flex flex-col select-none overflow-hidden"
        style={{ ...tvStyle, fontFamily: "Poppins, sans-serif" }}
      >
        {/* ── Header ── */}
        <header
          className="flex items-center justify-between bg-gradient-to-r from-[#1e293b] to-[#0f172a] border-b border-slate-700/50 flex-shrink-0"
          style={{ padding: "10px 40px" }}
        >
          <div className="flex items-center" style={{ gap: 12 }}>
            <img
              src="/logo-apolizza-fundo-clear.png"
              alt="Apolizza"
              className="object-contain flex-shrink-0"
              style={{ width: 44, height: 44 }}
            />
            <span className="font-bold tracking-wide" style={{ fontSize: 20 }}>
              Painel TV
            </span>
          </div>
          <div className="flex items-center" style={{ gap: 24 }}>
            <span className="text-slate-400 font-medium" style={{ fontSize: 17 }}>
              {mesLabel}/{data.ano}
            </span>
            <Clock />
          </div>
        </header>

        {/* ── KPI Strip ── */}
        <div
          className="grid grid-cols-4 flex-shrink-0"
          style={{ gap: 12, padding: "6px 40px" }}
        >
          <KpiCard label="Total Cotações" value={String(data.kpis.totalCotacoes)} color="text-sky-400" />
          <KpiCard label="Fechadas" value={String(data.kpis.fechadas)} color="text-green-400" />
          <KpiCard label="Perdas" value={String(data.kpis.perdas)} color="text-red-400" />
          <KpiCard label="A Receber" value={fmt(data.kpis.totalAReceberTotal)} color="text-emerald-400" />
        </div>

        {/* ── Carousel ── */}
        <div
          className="flex-1 min-h-0 relative"
          style={{ padding: "0 32px 8px" }}
        >
          {/* Left arrow */}
          <button
            onClick={goPrev}
            className="absolute top-1/2 -translate-y-1/2 z-20 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50 flex items-center justify-center transition-colors cursor-pointer"
            style={{ width: 64, height: 64, left: 10 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Right arrow */}
          <button
            onClick={goNext}
            className="absolute top-1/2 -translate-y-1/2 z-20 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50 flex items-center justify-center transition-colors cursor-pointer"
            style={{ width: 64, height: 64, right: 10 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 26, height: 26 }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          <div
            className="h-full rounded-2xl bg-slate-900/50 border border-slate-800/50 overflow-hidden"
            style={{ opacity, transition: `opacity ${FADE_DURATION}ms ease-in-out` }}
          >
            {slideIndex === 0 && <TvRankingSlide cotadores={data.cotadores} />}
            {slideIndex === 1 && <TvMetaSlide metaMensal={data.metaMensal} semanas={data.semanas} />}
            {slideIndex === 2 && <TvMonthlySlide monthlyTrend={data.monthlyTrend} />}
            {slideIndex === 3 && <TvKpisSlide kpis={data.kpis} />}
            {slideIndex === 4 && <TvCclienteSlide ccliente={data.ccliente ?? { total: 0, emConversao: 0, tratativasHoje: 0, semTratativa: 0 }} />}
          </div>
        </div>

        {/* ── Footer ── */}
        <footer
          className="flex items-center justify-between text-slate-500 flex-shrink-0"
          style={{ padding: "6px 40px", fontSize: 11 }}
        >
          <span className="text-slate-600">Atualizado: {lastUpdate || "--:--"}</span>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div className="flex" style={{ gap: 8 }}>
              {SLIDE_NAMES.map((name, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className={`rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    i === slideIndex
                      ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                      : "bg-slate-800/50 text-slate-500 border border-slate-700/30 hover:text-slate-300"
                  }`}
                  style={{ padding: "3px 14px", fontSize: 13 }}
                >
                  {name}
                </button>
              ))}
            </div>
            <span className="font-mono text-slate-600 tabular-nums">
              {mins}:{secs.toString().padStart(2, "0")}
            </span>
          </div>
          <span className="text-slate-600">Apolizza CRM</span>
        </footer>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="bg-slate-800/70 border border-slate-700/40 rounded-xl text-center"
      style={{ padding: "6px 16px" }}
    >
      <p className="text-slate-400 uppercase tracking-wider font-medium" style={{ fontSize: 10, marginBottom: 2 }}>
        {label}
      </p>
      <p className={`font-bold leading-tight ${color}`} style={{ fontSize: 28 }}>
        {value}
      </p>
    </div>
  );
}

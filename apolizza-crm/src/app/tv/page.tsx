"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import TvRankingSlide from "@/components/tv/tv-ranking-slide";
import TvMetaSlide from "@/components/tv/tv-meta-slide";
import TvMonthlySlide from "@/components/tv/tv-monthly-slide";
import TvKpisSlide from "@/components/tv/tv-kpis-slide";

const MES_ARR = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const SLIDE_INTERVAL = 300_000; // 5 min
const REFRESH_INTERVAL = 300_000; // 5 min
const FADE_DURATION = 500;
const TOTAL_SLIDES = 4;

interface TVData {
  ano: number;
  mes: string;
  kpis: {
    totalCotacoes: number;
    fechadas: number;
    perdas: number;
    emAndamento: number;
    totalAReceber: number;
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
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return <span className="text-2xl font-mono text-slate-300">{time}</span>;
}

export default function TvPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-2xl text-slate-400 animate-pulse">Carregando...</div>
      </div>
    }>
      <TvPage />
    </Suspense>
  );
}

function TvPage() {
  const params = useSearchParams();
  const token = params.get("token");

  const [data, setData] = useState<TVData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const dataRef = useRef<TVData | null>(null);

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
        dataRef.current = json.data;
        setError(null);
        setLastUpdate(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      }
    } catch {
      // Keep previous data on error
      console.error("TV fetch error");
    }
  }, [token]);

  // Initial fetch + refresh interval
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  // Slide rotation
  useEffect(() => {
    const id = setInterval(() => {
      setOpacity(0);
      setTimeout(() => {
        setSlideIndex(prev => (prev + 1) % TOTAL_SLIDES);
        setOpacity(1);
      }, FADE_DURATION);
    }, SLIDE_INTERVAL);
    return () => clearInterval(id);
  }, []);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <p className="text-2xl text-red-400">Token nao fornecido. Use: /tv?token=SEU_TOKEN</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <p className="text-2xl text-red-400">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-2xl text-slate-400 animate-pulse">Carregando dados...</div>
      </div>
    );
  }

  const now = new Date();
  const mesLabel = MES_ARR[now.getMonth()];

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-[Poppins] flex flex-col overflow-hidden" style={{ height: "100vh" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-gradient-to-r from-[#1e293b] to-[#0f172a] border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#ff695f] to-[#ff9068] rounded-xl flex items-center justify-center text-white font-bold text-lg">
            A
          </div>
          <span className="text-xl font-bold tracking-wide">Painel TV</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-lg text-slate-400 font-medium">{mesLabel}/{data.ano}</span>
          <Clock />
        </div>
      </header>

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-4 px-6 py-3">
        <KpiCard label="Total Cotacoes" value={String(data.kpis.totalCotacoes)} color="text-sky-400" />
        <KpiCard label="Fechadas" value={String(data.kpis.fechadas)} color="text-green-400" />
        <KpiCard label="Perdas" value={String(data.kpis.perdas)} color="text-red-400" />
        <KpiCard label="Faturamento" value={fmt(data.kpis.totalAReceber)} color="text-emerald-400" />
      </div>

      {/* Carousel */}
      <div className="flex-1 min-h-0 px-4 pb-1">
        <div
          className="h-full rounded-2xl bg-slate-900/50 border border-slate-800/50 overflow-hidden"
          style={{ opacity, transition: `opacity ${FADE_DURATION}ms ease-in-out` }}
        >
          {slideIndex === 0 && <TvRankingSlide cotadores={data.cotadores} />}
          {slideIndex === 1 && <TvMetaSlide metaMensal={data.metaMensal} semanas={data.semanas} />}
          {slideIndex === 2 && <TvMonthlySlide monthlyTrend={data.monthlyTrend} />}
          {slideIndex === 3 && <TvKpisSlide kpis={data.kpis} />}
        </div>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between px-6 py-2 text-sm text-slate-500">
        <span>Atualizado: {lastUpdate || "--:--"}</span>
        <div className="flex gap-2">
          {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === slideIndex ? "bg-sky-400" : "bg-slate-600"
              }`}
            />
          ))}
        </div>
        <span>Apolizza CRM</span>
      </footer>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-800/70 border border-slate-700/40 rounded-xl px-4 py-3 text-center">
      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

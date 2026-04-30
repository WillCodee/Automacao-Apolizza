"use client";

import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { STATUS_BADGES } from "@/lib/status-config";

type Tratativa = {
  id: string;
  name: string;
  status: string;
  produto: string | null;
  seguradora: string | null;
  proximaTratativa: string;
  priority: string;
  assigneeId: string | null;
  assigneeName: string | null;
};

type Grupo = {
  id: string;
  nome: string;
  cor: string;
  membros: { id: string; name: string }[];
};

type ViewMode = "grupo" | "cotador";

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  if (diff < 0) return { label: `Atrasada ${Math.abs(diff)}d · ${formatted}`, urgent: true, overdue: true };
  if (diff === 0) return { label: `Hoje · ${formatted}`, urgent: true, overdue: false };
  if (diff === 1) return { label: `Amanhã · ${formatted}`, urgent: true, overdue: false };
  if (diff <= 3) return { label: `Em ${diff}d · ${formatted}`, urgent: true, overdue: false };
  return { label: formatted, urgent: false, overdue: false };
}

const PRIORITY_DOT: Record<string, string> = {
  urgente: "bg-red-500",
  alta: "bg-orange-400",
  normal: "bg-blue-400",
  baixa: "bg-slate-300",
};

function TrativaCard({ item, from }: { item: Tratativa; from: string }) {
  const { label, urgent, overdue } = formatDate(item.proximaTratativa);
  return (
    <Link
      href={`/cotacoes/${item.id}?from=${from}`}
      className="block bg-white rounded-xl border border-slate-100 p-3 hover:border-[#03a4ed]/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${PRIORITY_DOT[item.priority] || "bg-slate-300"}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-[#03a4ed] transition-colors">
            {item.name}
          </p>
          {(item.produto || item.seguradora) && (
            <p className="text-[10px] text-slate-400 truncate mt-0.5">
              {[item.produto, item.seguradora].filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="flex items-center justify-between mt-1.5 gap-1 flex-wrap">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${overdue ? "bg-red-100 text-red-700 font-semibold" : urgent ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>
              {label}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${STATUS_BADGES[item.status] || "bg-slate-100 text-slate-600"}`}>
              {item.status}
            </span>
          </div>
          {item.assigneeName && (
            <p className="text-[10px] text-slate-400 mt-1 truncate">👤 {item.assigneeName}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

function KanbanColumn({ title, cor, items, count, from }: { title: string; cor?: string; items: Tratativa[]; count: number; from: string }) {
  return (
    <div className="flex-shrink-0 w-72">
      <div className="flex items-center gap-2 mb-3 px-1">
        {cor && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cor }} />}
        <span className="text-sm font-semibold text-slate-700 truncate">{title}</span>
        <span className="ml-auto text-xs font-medium bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{count}</span>
      </div>
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">Nenhuma tratativa</p>
        ) : (
          items.map((item) => <TrativaCard key={item.id} item={item} from={from} />)
        )}
      </div>
    </div>
  );
}

export function ProximasTrativasKanban({ from = "dashboard" }: { from?: string }) {
  const [items, setItems] = useState<Tratativa[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grupo");

  useEffect(() => {
    Promise.all([
      fetch("/api/proximas-tratativas").then((r) => r.json()),
      fetch("/api/grupos").then((r) => r.json()),
    ]).then(([tratativas, grps]) => {
      setItems(tratativas.data ?? []);
      setGrupos(grps.data ?? []);
    }).catch(() => toast.error("Erro ao carregar tratativas")).finally(() => setLoading(false));
  }, []);

  const columns = useMemo(() => {
    if (viewMode === "grupo") {
      // Map userId -> groupId
      const userToGrupo = new Map<string, Grupo>();
      for (const g of grupos) {
        for (const m of g.membros) {
          userToGrupo.set(m.id, g);
        }
      }

      const grupoMap = new Map<string, { grupo: Grupo; items: Tratativa[] }>();
      const semGrupo: Tratativa[] = [];

      for (const item of items) {
        if (!item.assigneeId) { semGrupo.push(item); continue; }
        const g = userToGrupo.get(item.assigneeId);
        if (!g) { semGrupo.push(item); continue; }
        if (!grupoMap.has(g.id)) grupoMap.set(g.id, { grupo: g, items: [] });
        grupoMap.get(g.id)!.items.push(item);
      }

      const cols = [...grupoMap.values()].map(({ grupo, items: its }) => ({
        key: grupo.id,
        title: grupo.nome,
        cor: grupo.cor,
        items: its,
      }));

      if (semGrupo.length > 0) {
        cols.push({ key: "sem-grupo", title: "Sem Grupo", cor: "#94a3b8", items: semGrupo });
      }

      return cols;
    } else {
      // Group by cotador
      const cotadorMap = new Map<string, { name: string; items: Tratativa[] }>();
      const semCotador: Tratativa[] = [];

      for (const item of items) {
        if (!item.assigneeId) { semCotador.push(item); continue; }
        const key = item.assigneeId;
        if (!cotadorMap.has(key)) cotadorMap.set(key, { name: item.assigneeName ?? "Sem nome", items: [] });
        cotadorMap.get(key)!.items.push(item);
      }

      const cols: { key: string; title: string; cor: string | undefined; items: Tratativa[] }[] = [...cotadorMap.values()].map(({ name, items: its }) => ({
        key: name,
        title: name,
        cor: undefined,
        items: its,
      }));

      if (semCotador.length > 0) {
        cols.push({ key: "sem-cotador", title: "Não atribuído", cor: "#94a3b8", items: semCotador });
      }

      return cols;
    }
  }, [items, grupos, viewMode]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <h2 className="font-semibold text-slate-900 text-base">Próximas Tratativas</h2>
          {items.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#03a4ed] text-white text-xs font-medium">
              {items.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
            <button
              onClick={() => setViewMode("grupo")}
              className={`px-3 py-1.5 transition-colors ${viewMode === "grupo" ? "bg-[#03a4ed] text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Por Grupo
            </button>
            <button
              onClick={() => setViewMode("cotador")}
              className={`px-3 py-1.5 transition-colors ${viewMode === "cotador" ? "bg-[#03a4ed] text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              Por Cotador
            </button>
          </div>
          <Link href="/cotacoes" className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium">
            Ver todas →
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">Nenhuma tratativa agendada</div>
      ) : (
        <div className="p-5 overflow-x-auto">
          <div className="flex gap-4 min-w-max">
            {columns.map((col) => (
              <KanbanColumn key={col.key} title={col.title} cor={col.cor} items={col.items} count={col.items.length} from={from} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

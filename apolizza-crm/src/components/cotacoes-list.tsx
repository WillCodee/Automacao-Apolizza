"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { STATUS_OPTIONS, MES_OPTIONS, PRODUTO_OPTIONS, PRIORITY_OPTIONS } from "@/lib/constants";
import { CsvImportModal } from "./csv-import-modal";

type Cotacao = {
  id: string;
  name: string;
  status: string;
  situacao: string | null;
  produto: string | null;
  seguradora: string | null;
  aReceber: number | null;
  dueDate: string | null;
  mesReferencia: string | null;
  anoReferencia: number | null;
  createdAt: string;
  assigneeNome: string | null;
  assigneeGrupoNome: string | null;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

import { STATUS_BADGES, SITUACAO_BADGES } from "@/lib/status-config";
const STATUS_COLORS = STATUS_BADGES;

const STORAGE_KEY = "cotacoes-filters-v1";

type SavedFilters = {
  search: string;
  statusFilter: string;
  mesFilter: string;
  anoFilter: string;
  produtoFilter: string;
  seguradoraFilter: string;
  prioridadeFilter: string;
  renovacaoFilter: boolean;
  responsavelFilter: string;
  grupoFilter: string[];
  dateFrom: string;
  dateTo: string;
  page: number;
  showAdvanced: boolean;
};

function loadSaved(): Partial<SavedFilters> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<SavedFilters>) : {};
  } catch { return {}; }
}

export function CotacoesList({ userRole }: { userRole: "admin" | "cotador" | "proprietario" }) {
  const canBulk = userRole === "admin" || userRole === "proprietario";
  const searchParams = useSearchParams();
  const router = useRouter();
  const assigneeFilter = searchParams?.get("assignee") || "";

  // Prioridade: URL → sessionStorage → vazio
  const saved = loadSaved();
  const sp = (key: string) => searchParams?.get(key) ?? null;

  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState(() => sp("search") ?? saved.search ?? "");
  const [statusFilter, setStatusFilter] = useState(() => sp("status") ?? saved.statusFilter ?? "");
  const [mesFilter, setMesFilter] = useState(() => sp("mes") ?? saved.mesFilter ?? "");
  const [anoFilter, setAnoFilter] = useState(() => sp("ano") ?? saved.anoFilter ?? "");
  const [produtoFilter, setProdutoFilter] = useState(() => sp("produto") ?? saved.produtoFilter ?? "");
  const [seguradoraFilter, setSeguradoraFilter] = useState(() => sp("seguradora") ?? saved.seguradoraFilter ?? "");
  const [prioridadeFilter, setPrioridadeFilter] = useState(() => sp("prioridade") ?? saved.prioridadeFilter ?? "");
  const [renovacaoFilter, setRenovacaoFilter] = useState(() => sp("isRenovacao") === "true" || (saved.renovacaoFilter ?? false));
  const [responsavelFilter, setResponsavelFilter] = useState(() => saved.responsavelFilter ?? "");
  const [grupoFilter, setGrupoFilter] = useState<string[]>(() => {
    const fromUrl = sp("grupo");
    if (fromUrl) return [fromUrl];
    return Array.isArray(saved.grupoFilter) ? saved.grupoFilter : [];
  });
  const [grupoDropdownOpen, setGrupoDropdownOpen] = useState(false);
  const grupoDropdownRef = useRef<HTMLDivElement>(null);
  const [dateFrom, setDateFrom] = useState(() => sp("dateFrom") ?? saved.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(() => sp("dateTo") ?? saved.dateTo ?? "");
  const [page, setPage] = useState(() => Math.max(1, Number(sp("page")) || saved.page || 1));
  const [showAdvanced, setShowAdvanced] = useState(() =>
    !!(sp("produto") || sp("seguradora") || sp("prioridade") || sp("isRenovacao") || sp("dateFrom") || sp("dateTo") ||
      sp("grupo") ||
      saved.produtoFilter || saved.seguradoraFilter || saved.prioridadeFilter || saved.renovacaoFilter || saved.dateFrom || saved.dateTo ||
      saved.responsavelFilter || (saved.grupoFilter && saved.grupoFilter.length > 0))
  );
  // Close grupo dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (grupoDropdownRef.current && !grupoDropdownRef.current.contains(e.target as Node)) {
        setGrupoDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const [seguradoras, setSeguradoras] = useState<string[]>([]);
  const [usuariosOpts, setUsuariosOpts] = useState<{ id: string; name: string }[]>([]);
  const [gruposOpts, setGruposOpts] = useState<{ id: string; nome: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Persiste filtros no sessionStorage sempre que mudam
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        search, statusFilter, mesFilter, anoFilter, produtoFilter, seguradoraFilter,
        prioridadeFilter, renovacaoFilter, responsavelFilter, grupoFilter: grupoFilter, dateFrom, dateTo, page, showAdvanced,
      } satisfies SavedFilters));
    } catch { /* sessionStorage indisponível */ }
  }, [search, statusFilter, mesFilter, anoFilter, produtoFilter, seguradoraFilter, prioridadeFilter, renovacaoFilter, responsavelFilter, grupoFilter, dateFrom, dateTo, page, showAdvanced]);

  // Fetch filter options
  useEffect(() => {
    fetch("/api/cotacoes/seguradoras")
      .then((r) => r.json())
      .then((j) => setSeguradoras(j.data || []))
      .catch(() => {});
    fetch("/api/users")
      .then((r) => r.json())
      .then((j) => setUsuariosOpts((j.data || []).map((u: { id: string; name: string }) => ({ id: u.id, name: u.name }))))
      .catch(() => {});
    fetch("/api/grupos")
      .then((r) => r.json())
      .then((j) => setGruposOpts((j.data || []).map((g: { id: string; nome: string }) => ({ id: g.id, nome: g.nome }))))
      .catch(() => {});
  }, []);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (mesFilter) params.set("mes", mesFilter);
    if (anoFilter) params.set("ano", anoFilter);
    // Form-based responsável filter takes priority over URL assignee banner
    const effectiveAssignee = responsavelFilter || assigneeFilter;
    if (effectiveAssignee) params.set("assignee", effectiveAssignee);
    grupoFilter.forEach((gid) => params.append("grupo", gid));
    if (produtoFilter) params.set("produto", produtoFilter);
    if (seguradoraFilter) params.set("seguradora", seguradoraFilter);
    if (prioridadeFilter) params.set("prioridade", prioridadeFilter);
    if (renovacaoFilter) params.set("isRenovacao", "true");
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, mesFilter, anoFilter, assigneeFilter, responsavelFilter, JSON.stringify(grupoFilter), produtoFilter, seguradoraFilter, prioridadeFilter, renovacaoFilter, dateFrom, dateTo]);

  // Sync filters to URL (AC10)
  useEffect(() => {
    const params = buildParams();
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    const currentQs = searchParams.toString();
    if (qs !== currentQs) {
      router.replace(`/cotacoes${qs ? `?${qs}` : ""}`, { scroll: false });
    }
  }, [buildParams, page, router, searchParams]);

  const fetchCotacoes = useCallback(async () => {
    setLoading(true);
    const params = buildParams();
    params.set("page", String(page));
    params.set("limit", "25");

    const res = await fetch(`/api/cotacoes?${params}`);
    const json = await res.json();
    setCotacoes(json.data || []);
    setPagination(json.pagination || null);
    setLoading(false);
  }, [page, buildParams]);

  useEffect(() => {
    fetchCotacoes();
  }, [fetchCotacoes]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    fetchCotacoes();
  }

  async function handleExportCSV() {
    setExporting(true);
    try {
      const params = buildParams();
      const res = await fetch(`/api/cotacoes/export?${params}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cotacoes-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erro ao exportar CSV");
    }
    setExporting(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir "${name}"?`)) return;
    await fetch(`/api/cotacoes/${id}`, { method: "DELETE" });
    fetchCotacoes();
  }

  async function handleConcluir(id: string) {
    await fetch(`/api/cotacoes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ situacao: "FECHADO" }),
    });
    fetchCotacoes();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === cotacoes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cotacoes.map((c) => c.id)));
    }
  }

  async function handleBulkStatusUpdate() {
    if (!bulkStatus || selectedIds.size === 0) return;
    if (!confirm(`Alterar status de ${selectedIds.size} cotacao(es) para "${bulkStatus}"?`)) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/cotacoes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "updateStatus", data: { status: bulkStatus } }),
      });
      const json = await res.json();
      if (json.data) {
        alert(`${json.data.updated} atualizada(s), ${json.data.skipped} ignorada(s)`);
        setSelectedIds(new Set());
        setBulkStatus("");
        fetchCotacoes();
      } else {
        alert(json.error || "Erro na operacao");
      }
    } catch {
      alert("Erro de conexao");
    }
    setBulkLoading(false);
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Excluir ${selectedIds.size} cotacao(es)? Esta acao nao pode ser desfeita.`)) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/cotacoes/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: "delete" }),
      });
      const json = await res.json();
      if (json.data) {
        alert(`${json.data.deleted} excluida(s)`);
        setSelectedIds(new Set());
        fetchCotacoes();
      } else {
        alert(json.error || "Erro na operacao");
      }
    } catch {
      alert("Erro de conexao");
    }
    setBulkLoading(false);
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setMesFilter("");
    setAnoFilter("");
    setProdutoFilter("");
    setSeguradoraFilter("");
    setPrioridadeFilter("");
    setRenovacaoFilter(false);
    setResponsavelFilter("");
    setGrupoFilter([]);
    setDateFrom("");
    setDateTo("");
    setPage(1);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  const hasActiveFilters = statusFilter || mesFilter || anoFilter || produtoFilter || seguradoraFilter || prioridadeFilter || renovacaoFilter || responsavelFilter || grupoFilter.length > 0 || dateFrom || dateTo;

  const currentYear = new Date().getFullYear();
  const ANO_OPTIONS = Array.from({ length: 6 }, (_, i) => String(currentYear - i));

  const fmt = (v: number | null) =>
    v != null
      ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "—";

  return (
    <div className="space-y-4">
      {/* Assignee filter banner */}
      {assigneeFilter && (
        <div className="flex items-center justify-between bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
          <p className="text-sm text-sky-800">
            Mostrando cotacoes filtradas por cotador
          </p>
          <Link
            href="/cotacoes"
            className="text-xs font-medium text-sky-700 hover:text-sky-900 underline"
          >
            Limpar filtro
          </Link>
        </div>
      )}
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Buscar por nome, seguradora, indicacao..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
            />
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
            >
              <option value="">Todos os status</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={mesFilter}
              onChange={(e) => { setMesFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
            >
              <option value="">Todos os meses</option>
              {MES_OPTIONS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={anoFilter}
              onChange={(e) => { setAnoFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
            >
              <option value="">Todos os anos</option>
              {ANO_OPTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white rounded-xl bg-[#03a4ed] hover:bg-[#0288d1] transition-all shadow-sm"
            >
              Buscar
            </button>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            >
              {showAdvanced ? "Menos filtros" : "Mais filtros"}
            </button>
            {(hasActiveFilters || search) && (
              <button
                type="button"
                onClick={clearFilters}
                className="px-3 py-2 text-sm font-medium text-[#ff695f] border border-[#ff695f]/30 rounded-xl hover:bg-red-50 transition flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Limpar filtros
              </button>
            )}
          </div>

          {/* Advanced filters */}
          {showAdvanced && (
            <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
              <select
                value={responsavelFilter}
                onChange={(e) => { setResponsavelFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:ring-2 focus:ring-[#03a4ed] outline-none transition"
              >
                <option value="">Todos os responsáveis</option>
                {usuariosOpts.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <div className="relative" ref={grupoDropdownRef}>
                <button
                  type="button"
                  onClick={() => setGrupoDropdownOpen((v) => !v)}
                  className={`px-3 py-2 border rounded-xl text-sm bg-white outline-none transition flex items-center gap-2 min-w-[160px] ${grupoFilter.length > 0 ? "border-[#03a4ed] text-[#03a4ed] font-medium" : "border-slate-200 text-slate-500"}`}
                >
                  <span className="flex-1 text-left truncate">
                    {grupoFilter.length === 0
                      ? "Todos os grupos"
                      : grupoFilter.length === 1
                        ? (gruposOpts.find((g) => g.id === grupoFilter[0])?.nome ?? "1 grupo")
                        : `${grupoFilter.length} grupos`}
                  </span>
                  <svg className={`w-3.5 h-3.5 shrink-0 transition-transform ${grupoDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {grupoDropdownOpen && (
                  <div className="absolute z-50 top-full mt-1 left-0 bg-white border border-slate-200 rounded-xl shadow-lg min-w-[200px] py-1 max-h-60 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => { setGrupoFilter([]); setPage(1); }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 ${grupoFilter.length === 0 ? "text-[#03a4ed] font-medium" : "text-slate-600"}`}
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${grupoFilter.length === 0 ? "bg-[#03a4ed] border-[#03a4ed]" : "border-slate-300"}`}>
                        {grupoFilter.length === 0 && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      Todos os grupos
                    </button>
                    {gruposOpts.map((g) => {
                      const checked = grupoFilter.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => {
                            setGrupoFilter((prev) => checked ? prev.filter((id) => id !== g.id) : [...prev, g.id]);
                            setPage(1);
                          }}
                          className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-slate-50 text-slate-700"
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? "bg-[#03a4ed] border-[#03a4ed]" : "border-slate-300"}`}>
                            {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </span>
                          {g.nome}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <select
                value={produtoFilter}
                onChange={(e) => { setProdutoFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:ring-2 focus:ring-[#03a4ed] outline-none transition"
              >
                <option value="">Todos os produtos</option>
                {PRODUTO_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <select
                value={seguradoraFilter}
                onChange={(e) => { setSeguradoraFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:ring-2 focus:ring-[#03a4ed] outline-none transition"
              >
                <option value="">Todas as seguradoras</option>
                {seguradoras.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={prioridadeFilter}
                onChange={(e) => { setPrioridadeFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:ring-2 focus:ring-[#03a4ed] outline-none transition"
              >
                <option value="">Todas as prioridades</option>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-700 cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={renovacaoFilter}
                  onChange={(e) => { setRenovacaoFilter(e.target.checked); setPage(1); }}
                  className="rounded border-slate-300 text-[#03a4ed] focus:ring-[#03a4ed]"
                />
                Apenas Renovacoes
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">De:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:ring-2 focus:ring-[#03a4ed] outline-none transition"
                />
                <span className="text-xs text-slate-500">Ate:</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-900 bg-white focus:ring-2 focus:ring-[#03a4ed] outline-none transition"
                />
              </div>
            </div>
          )}
        </form>

        {/* Export + Import buttons */}
        <div className="flex flex-wrap justify-end gap-2 mt-3 pt-3 border-t border-slate-100">
          {canBulk && (
            <button
              onClick={() => setShowImport(true)}
              className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3-3m0 0l3 3m-3-3v12" />
              </svg>
              Importar CSV
            </button>
          )}
          <button
            onClick={() => {
              const params = buildParams();
              window.open(`/cotacoes/print?${params}`, "_blank");
            }}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Exportar PDF
          </button>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition disabled:opacity-50 flex items-center gap-2"
          >
            {exporting ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportar CSV
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {canBulk && selectedIds.size > 0 && (
        <div className="bg-[#03a4ed]/5 border border-[#03a4ed]/20 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-[#03a4ed]">
            {selectedIds.size} selecionada(s)
          </span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
          >
            <option value="">Alterar status para...</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={handleBulkStatusUpdate}
            disabled={!bulkStatus || bulkLoading}
            className="px-3 py-1.5 text-sm font-medium text-white bg-[#03a4ed] rounded-lg hover:bg-[#0288d1] transition disabled:opacity-50"
          >
            Aplicar
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkLoading}
            className="px-3 py-1.5 text-sm font-medium text-[#ff695f] border border-[#ff695f]/30 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
          >
            Excluir
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 transition"
          >
            Limpar selecao
          </button>
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 mt-2 text-sm">Carregando...</p>
          </div>
        ) : cotacoes.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Nenhuma cotacao encontrada.
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {cotacoes.map((c) => (
                <div key={c.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    {canBulk && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="mt-1 rounded border-slate-300 text-[#03a4ed] focus:ring-[#03a4ed] min-w-[20px] min-h-[20px]"
                      />
                    )}
                    <Link href={`/cotacoes/${c.id}`} className="text-sm font-semibold text-slate-900 hover:text-[#03a4ed] transition-colors line-clamp-2 flex-1">
                      {c.name}
                    </Link>
                    <span className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${STATUS_COLORS[c.status] || "bg-slate-100 text-slate-600"}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {c.situacao && (
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${SITUACAO_BADGES[c.situacao] || "bg-slate-100 text-slate-500"}`}>
                        {c.situacao}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {c.assigneeNome && (
                      <span>
                        {c.assigneeNome}
                        {c.assigneeGrupoNome && (
                          <span className="ml-1 text-[10px] font-semibold px-1 py-0.5 rounded-full bg-[#03a4ed]/10 text-[#03a4ed]">
                            {c.assigneeGrupoNome}
                          </span>
                        )}
                      </span>
                    )}
                    {c.seguradora && <span>{c.seguradora}</span>}
                    {c.produto && <span>{c.produto}</span>}
                    {c.mesReferencia && c.anoReferencia && (
                      <span>{c.mesReferencia}/{c.anoReferencia}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">{fmt(c.aReceber)}</span>
                    <div className="flex gap-3">
                      <Link
                        href={`/cotacoes/${c.id}/edit`}
                        className="text-[#03a4ed] hover:text-[#0288d1] text-xs font-medium min-h-[44px] flex items-center"
                      >
                        Editar
                      </Link>
                      {c.situacao !== "FECHADO" && (
                        <button
                          onClick={() => handleConcluir(c.id)}
                          className="text-emerald-600 hover:text-emerald-700 text-xs font-medium min-h-[44px] flex items-center"
                        >
                          Concluído
                        </button>
                      )}
                      {canBulk && (
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="text-[#ff695f] hover:text-[#e55a50] text-xs font-medium min-h-[44px] flex items-center"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left">
                  <tr>
                    {canBulk && (
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.size === cotacoes.length && cotacoes.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300 text-[#03a4ed] focus:ring-[#03a4ed]"
                        />
                      </th>
                    )}
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Nome</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Responsável</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Situação</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Produto</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Seguradora</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide text-right">A Receber</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Ref</th>
                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wide">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cotacoes.map((c) => (
                    <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(c.id) ? "bg-sky-50/50" : ""}`}>
                      {canBulk && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(c.id)}
                            onChange={() => toggleSelect(c.id)}
                            className="rounded border-slate-300 text-[#03a4ed] focus:ring-[#03a4ed]"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium text-slate-900 max-w-[220px] truncate">
                        <Link href={`/cotacoes/${c.id}`} className="hover:text-[#03a4ed] transition-colors">
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 min-w-[130px]">
                        {c.assigneeNome ? (
                          <div>
                            <span className="text-xs font-medium text-slate-700">{c.assigneeNome}</span>
                            {c.assigneeGrupoNome && (
                              <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#03a4ed]/10 text-[#03a4ed]">
                                {c.assigneeGrupoNome}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${STATUS_COLORS[c.status] || "bg-slate-100 text-slate-600"}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.situacao ? (
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${SITUACAO_BADGES[c.situacao] || "bg-slate-100 text-slate-500"}`}>
                            {c.situacao}
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{c.produto || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{c.seguradora || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(c.aReceber)}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {c.mesReferencia && c.anoReferencia
                          ? `${c.mesReferencia}/${c.anoReferencia}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Link
                            href={`/cotacoes/${c.id}/edit`}
                            className="text-[#03a4ed] hover:text-[#0288d1] text-xs font-medium"
                          >
                            Editar
                          </Link>
                          {c.situacao !== "FECHADO" && (
                            <button
                              onClick={() => handleConcluir(c.id)}
                              className="text-emerald-600 hover:text-emerald-700 text-xs font-medium"
                            >
                              Concluído
                            </button>
                          )}
                          {canBulk && (
                            <button
                              onClick={() => handleDelete(c.id, c.name)}
                              className="text-[#ff695f] hover:text-[#e55a50] text-xs font-medium"
                            >
                              Excluir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4 border border-slate-100">
          <p className="text-sm text-slate-500">
            {pagination.total} cotacao(es) — pagina {pagination.page} de{" "}
            {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50 text-slate-700 transition"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= pagination.totalPages}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50 text-slate-700 transition"
            >
              Proximo
            </button>
          </div>
        </div>
      )}

      {/* Import CSV modal */}
      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onSuccess={() => { fetchCotacoes(); }}
        />
      )}
    </div>
  );
}

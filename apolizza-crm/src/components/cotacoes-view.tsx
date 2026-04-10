"use client";

import { useState, useEffect, Suspense } from "react";
import { CotacoesList } from "./cotacoes-list";
import { KanbanBoard } from "./kanban-board";

type ViewMode = "lista" | "kanban";

export function CotacoesView({ userRole }: { userRole: "admin" | "cotador" | "proprietario" }) {
  const [view, setView] = useState<ViewMode>("lista");

  // Persist preference
  useEffect(() => {
    const saved = localStorage.getItem("cotacoes-view");
    if (saved === "kanban" || saved === "lista") setView(saved);
  }, []);

  function toggleView(mode: ViewMode) {
    setView(mode);
    localStorage.setItem("cotacoes-view", mode);
  }

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
          <button
            onClick={() => toggleView("lista")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              view === "lista"
                ? "bg-[#03a4ed] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Lista
            </span>
          </button>
          <button
            onClick={() => toggleView("kanban")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              view === "kanban"
                ? "bg-[#03a4ed] text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Kanban
            </span>
          </button>
        </div>
      </div>

      {view === "lista" ? (
        <Suspense fallback={
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <CotacoesList userRole={userRole} />
        </Suspense>
      ) : (
        <KanbanBoard userRole={userRole} />
      )}
    </div>
  );
}

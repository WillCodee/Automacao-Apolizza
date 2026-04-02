"use client";

import { useState } from "react";

interface BriefingFormProps {
  tarefaId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BriefingForm({ tarefaId, onSuccess, onCancel }: BriefingFormProps) {
  const [briefing, setBriefing] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!briefing.trim()) {
      setError("Briefing não pode estar vazio");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/briefings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing: briefing.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        setBriefing("");
        onSuccess();
      } else {
        setError(data.error || "Erro ao adicionar briefing");
      }
    } catch {
      setError("Erro ao adicionar briefing");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="briefing" className="block text-sm font-medium text-slate-700 mb-2">
          Adicionar Briefing
        </label>
        <textarea
          id="briefing"
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
          placeholder="Descreva o progresso da tarefa..."
          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-apolizza-blue focus:border-apolizza-blue transition resize-none"
          rows={4}
          maxLength={2000}
          disabled={loading}
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs text-slate-500">
            {briefing.length}/2000 caracteres
          </span>
          {error && (
            <span className="text-xs text-red-600">
              {error}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !briefing.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-apolizza-blue hover:bg-apolizza-blue-hover rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Adicionando..." : "Adicionar Briefing"}
        </button>
      </div>
    </form>
  );
}

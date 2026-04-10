"use client";

import { useState, useRef, useEffect } from "react";

type Props = {
  cotacaoId: string;
  initialValue: string | null;
};

export function ObservacaoEditor({ cotacaoId, initialValue }: Props) {
  const [value, setValue] = useState(initialValue ?? "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/cotacoes/${cotacaoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observacao: value }),
    });
    setSaving(false);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleCancel() {
    setValue(initialValue ?? "");
    setEditing(false);
  }

  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Observacao</p>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Editar
          </button>
        )}
        {saved && (
          <span className="text-xs text-emerald-600 font-medium">Salvo</span>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={4}
            placeholder="Notas adicionais..."
            className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none resize-none leading-relaxed"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-[#03a4ed] rounded-lg hover:bg-[#0288d1] disabled:opacity-60 transition-colors"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      ) : (
        <p
          className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed cursor-text min-h-[1.5rem]"
          onClick={() => setEditing(true)}
        >
          {value || <span className="text-slate-400 italic">Nenhuma observacao. Clique para adicionar.</span>}
        </p>
      )}
    </div>
  );
}

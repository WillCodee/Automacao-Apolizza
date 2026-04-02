"use client";

import { useState, useEffect } from "react";

type StatusConfigItem = {
  id: string;
  statusName: string;
  displayLabel: string;
  color: string;
  icon: string | null;
  orderIndex: number;
  requiredFields: string[];
  isTerminal: boolean;
};

const FIELD_LABELS: Record<string, string> = {
  fim_vigencia: "Fim Vigencia",
  inicio_vigencia: "Inicio Vigencia",
  indicacao: "Indicacao",
  produto: "Produto",
  seguradora: "Seguradora",
  situacao: "Situacao",
  tipo_cliente: "Tipo Cliente",
  comissao: "Comissao",
  primeiro_pagamento: "1o Pagamento",
  a_receber: "A Receber",
  parcelado_em: "Parcelado Em",
  premio_sem_iof: "Premio s/ IOF",
  valor_perda: "Valor Perda",
  proxima_tratativa: "Prox. Tratativa",
  observacao: "Observacao",
};

const ALL_FIELDS = Object.keys(FIELD_LABELS);

export function StatusConfigList() {
  const [items, setItems] = useState<StatusConfigItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    displayLabel: "",
    color: "#03a4ed",
    icon: "",
    isTerminal: false,
    requiredFields: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  async function fetchItems() {
    const res = await fetch("/api/status-config");
    const json = await res.json();
    setItems(json.data || []);
  }

  useEffect(() => {
    fetchItems();
  }, []);

  function startEdit(item: StatusConfigItem) {
    setForm({
      displayLabel: item.displayLabel,
      color: item.color,
      icon: item.icon || "",
      isTerminal: item.isTerminal,
      requiredFields: item.requiredFields || [],
    });
    setEditingId(item.id);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function toggleField(field: string) {
    setForm((prev) => ({
      ...prev,
      requiredFields: prev.requiredFields.includes(field)
        ? prev.requiredFields.filter((f) => f !== field)
        : [...prev.requiredFields, field],
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setSaving(true);

    await fetch(`/api/status-config/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);
    setEditingId(null);
    fetchItems();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">
          Configuracao de Status
        </h2>
        <p className="text-xs text-slate-500">
          {items.length} status configurados
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
          >
            {/* Status header row */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">{item.icon || "📋"}</span>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {item.displayLabel}
                  </p>
                  <p className="text-xs text-slate-400">{item.statusName}</p>
                </div>
                {item.isTerminal && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-500 uppercase tracking-wide">
                    Terminal
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-wrap gap-1">
                  {(item.requiredFields || []).map((f) => (
                    <span
                      key={f}
                      className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-sky-50 text-[#03a4ed]"
                    >
                      {FIELD_LABELS[f] || f}
                    </span>
                  ))}
                  {(!item.requiredFields || item.requiredFields.length === 0) && (
                    <span className="text-xs text-slate-400 italic">
                      Nenhum campo obrigatorio
                    </span>
                  )}
                </div>
                <button
                  onClick={() => startEdit(item)}
                  className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium whitespace-nowrap"
                >
                  Editar
                </button>
              </div>
            </div>

            {/* Edit form (inline) */}
            {editingId === item.id && (
              <form
                onSubmit={handleSave}
                className="border-t border-slate-100 px-5 py-4 bg-slate-50 space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-slate-500 font-medium">
                      Label
                    </label>
                    <input
                      type="text"
                      required
                      value={form.displayLabel}
                      onChange={(e) =>
                        setForm({ ...form, displayLabel: e.target.value })
                      }
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium">
                      Cor
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={form.color}
                        onChange={(e) =>
                          setForm({ ...form, color: e.target.value })
                        }
                        className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={form.color}
                        onChange={(e) =>
                          setForm({ ...form, color: e.target.value })
                        }
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
                        maxLength={7}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-medium">
                      Icone (emoji)
                    </label>
                    <input
                      type="text"
                      value={form.icon}
                      onChange={(e) =>
                        setForm({ ...form, icon: e.target.value })
                      }
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
                      maxLength={4}
                    />
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer pb-2">
                      <input
                        type="checkbox"
                        checked={form.isTerminal}
                        onChange={(e) =>
                          setForm({ ...form, isTerminal: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-slate-300 text-[#03a4ed] focus:ring-[#03a4ed]"
                      />
                      <span className="text-sm text-slate-700">
                        Status terminal
                      </span>
                    </label>
                  </div>
                </div>

                {/* Required fields multi-select */}
                <div>
                  <label className="text-xs text-slate-500 font-medium">
                    Campos obrigatorios neste status
                  </label>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {ALL_FIELDS.map((field) => {
                      const checked = form.requiredFields.includes(field);
                      return (
                        <label
                          key={field}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs cursor-pointer transition-all ${
                            checked
                              ? "border-[#03a4ed] bg-sky-50 text-[#03a4ed] font-medium"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleField(field)}
                            className="sr-only"
                          />
                          {FIELD_LABELS[field]}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-white text-sm rounded-xl font-medium bg-[#03a4ed] hover:bg-[#0288d1] transition-all shadow-sm disabled:opacity-50"
                  >
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-4 py-2 text-slate-600 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

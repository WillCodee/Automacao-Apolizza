"use client";

import { useState, useRef } from "react";

type ImportResult = {
  imported: number;
  errors: number;
  total: number;
  message: string;
  details?: { line: number; status: string; error?: string }[];
};

export function CsvImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      let text = ev.target?.result as string;
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) return;

      const parseLine = (line: string) => {
        const fields: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
          } else if (ch === ";" && !inQuotes) {
            fields.push(current.trim());
            current = "";
          } else current += ch;
        }
        fields.push(current.trim());
        return fields;
      };

      const h = parseLine(lines[0]);
      setHeaders(h);
      const previewLines = lines.slice(1, 6).map(parseLine);
      setPreview(previewLines);
    };
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/cotacoes/import", { method: "POST", body: formData });
      const json = await res.json();
      if (json.data) {
        setResult(json.data);
        if (json.data.imported > 0) onSuccess();
      } else {
        setResult({ imported: 0, errors: 0, total: 0, message: json.error || "Erro ao importar" });
      }
    } catch {
      setResult({ imported: 0, errors: 0, total: 0, message: "Erro de conexao" });
    }
    setImporting(false);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Importar CSV</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Upload */}
          <div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full py-8 border-2 border-dashed border-slate-300 rounded-xl text-center hover:border-[#03a4ed] hover:bg-sky-50/30 transition"
            >
              <svg className="w-8 h-8 mx-auto text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-slate-600 font-medium">
                {file ? file.name : "Clique para selecionar arquivo CSV"}
              </p>
              <p className="text-xs text-slate-400 mt-1">Separador: ponto-e-virgula (;) · Max 1.000 linhas</p>
            </button>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Preview (primeiras 5 linhas)</p>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium text-slate-500 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                            {cell || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-xl p-4 ${result.imported > 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
              <p className={`text-sm font-semibold ${result.imported > 0 ? "text-emerald-700" : "text-red-700"}`}>
                {result.message}
              </p>
              {result.details && result.details.length > 0 && (
                <div className="mt-2 space-y-1">
                  {result.details.map((d, i) => (
                    <p key={i} className="text-xs text-red-600">
                      Linha {d.line}: {d.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition"
          >
            Fechar
          </button>
          {!result?.imported && (
            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="px-4 py-2 text-sm font-medium text-white rounded-xl bg-[#03a4ed] hover:bg-[#0288d1] transition disabled:opacity-50 flex items-center gap-2"
            >
              {importing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importando...
                </>
              ) : (
                "Importar"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

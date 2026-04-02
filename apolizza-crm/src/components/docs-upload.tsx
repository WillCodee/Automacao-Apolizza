"use client";

import { useState, useEffect, useRef } from "react";

type Doc = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
};

export function DocsUpload({ cotacaoId }: { cotacaoId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/cotacoes/${cotacaoId}/docs`)
      .then((r) => r.json())
      .then((d) => setDocs(d.data || []));
  }, [cotacaoId]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/cotacoes/${cotacaoId}/docs`, {
      method: "POST",
      body: formData,
    });
    const json = await res.json();
    if (json.data) {
      setDocs((prev) => [...prev, json.data]);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDelete(docId: string) {
    if (!confirm("Remover este documento?")) return;
    await fetch(`/api/cotacoes/${cotacaoId}/docs?docId=${docId}`, {
      method: "DELETE",
    });
    setDocs((prev) => prev.filter((d) => d.id !== docId));
  }

  const fmtSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          Documentos ({docs.length})
        </h3>
        <label className="px-3 py-1.5 bg-[#03a4ed] text-white text-sm rounded-xl hover:bg-[#0288d1] cursor-pointer transition-all shadow-sm">
          {uploading ? "Enviando..." : "Upload"}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>
      {docs.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-sm">
                  {doc.mimeType?.startsWith("image/")
                    ? "🖼"
                    : doc.mimeType === "application/pdf"
                    ? "📄"
                    : "📎"}
                </div>
                <div className="min-w-0">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#03a4ed] hover:text-[#0288d1] truncate block font-medium"
                  >
                    {doc.fileName}
                  </a>
                  <span className="text-xs text-slate-400">
                    {fmtSize(doc.fileSize)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc.id)}
                className="text-xs text-[#ff695f] hover:text-[#e55a50] ml-2 font-medium"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-6 text-sm text-slate-400 text-center">
          Nenhum documento anexado.
        </p>
      )}
    </div>
  );
}

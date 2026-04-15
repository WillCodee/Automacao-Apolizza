"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

interface Anexo {
  id: string;
  nomeArquivo: string;
  urlBlob: string;
  tamanho: number;
  mimeType: string;
  createdAt: string;
  usuario: {
    id: string;
    name: string;
    photoUrl: string | null;
  };
}

interface AnexosListProps {
  tarefaId: string;
  refresh: number;
  currentUserId: string;
  currentUserRole: "admin" | "cotador" | "proprietario";
}

export function AnexosList({
  tarefaId,
  refresh,
  currentUserId,
  currentUserRole,
}: AnexosListProps) {
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchAnexos();
  }, [tarefaId, refresh]);

  async function fetchAnexos() {
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/anexos`);
      const data = await res.json();

      if (res.ok && data.success) {
        setAnexos(data.data);
      }
    } catch (error) {
      console.error("Erro ao buscar anexos:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(anexoId: string) {
    if (!confirm("Tem certeza que deseja remover este anexo?")) {
      return;
    }

    setDeleting(anexoId);
    try {
      const res = await fetch(
        `/api/tarefas/${tarefaId}/anexos/${anexoId}`,
        { method: "DELETE" }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erro ao remover anexo");
      }

      // Atualizar lista
      setAnexos((prev) => prev.filter((a) => a.id !== anexoId));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Erro ao remover anexo");
    } finally {
      setDeleting(null);
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType === "application/pdf") return "📄";
    if (mimeType.includes("word")) return "📝";
    if (mimeType.includes("sheet")) return "📊";
    return "📎";
  }

  function isImage(mimeType: string): boolean {
    return mimeType.startsWith("image/");
  }

  function canDelete(anexo: Anexo): boolean {
    return currentUserRole === "admin" || anexo.usuario.id === currentUserId;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (anexos.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        📎 Nenhum anexo enviado ainda
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {anexos.map((anexo) => (
        <div
          key={anexo.id}
          className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-gray-300 transition-colors"
        >
          <div className="flex items-start gap-4">
            {/* Preview ou Ícone */}
            <div className="flex-shrink-0">
              {isImage(anexo.mimeType) ? (
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-200">
                  <Image
                    src={anexo.urlBlob}
                    alt={anexo.nomeArquivo}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-3xl">
                  {getFileIcon(anexo.mimeType)}
                </div>
              )}
            </div>

            {/* Informações */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {anexo.nomeArquivo}
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatFileSize(anexo.tamanho)} •{" "}
                    {new Date(anexo.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    por <span className="font-medium">{anexo.usuario.name}</span>
                  </p>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2">
                  <a
                    href={anexo.urlBlob}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                  >
                    Abrir
                  </a>
                  {canDelete(anexo) && (
                    <button
                      onClick={() => handleDelete(anexo.id)}
                      disabled={deleting === anexo.id}
                      className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-50"
                    >
                      {deleting === anexo.id ? "..." : "Remover"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

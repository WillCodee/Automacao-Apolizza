"use client";

import { useState, useEffect } from "react";
import { formatarDetalhesAtividade, getIconeTipoAcao } from "@/lib/audit-log-utils";

type TipoAcao =
  | "CRIADA"
  | "EDITADA"
  | "STATUS_ALTERADO"
  | "BRIEFING_ADICIONADO"
  | "ANEXO_ADICIONADO"
  | "ANEXO_REMOVIDO";

interface Atividade {
  id: string;
  tipoAcao: TipoAcao;
  detalhes: Record<string, any> | null;
  createdAt: string;
  usuario: {
    id: string;
    name: string;
    photoUrl: string | null;
  };
}

interface AtividadesTimelineProps {
  tarefaId: string;
  refresh: number;
}

export function AtividadesTimeline({ tarefaId, refresh }: AtividadesTimelineProps) {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAtividades();
  }, [tarefaId, refresh]);

  async function fetchAtividades() {
    try {
      const res = await fetch(`/api/tarefas/${tarefaId}/atividades`);
      const data = await res.json();

      if (res.ok && data.success) {
        setAtividades(data.data);
      }
    } catch (error) {
      console.error("Erro ao buscar atividades:", error);
    } finally {
      setLoading(false);
    }
  }

  function formatarTempo(dataISO: string): string {
    const data = new Date(dataISO);
    const agora = new Date();
    const diffMs = agora.getTime() - data.getTime();
    const diffMinutos = Math.floor(diffMs / 60000);

    if (diffMinutos < 1) return "Agora mesmo";
    if (diffMinutos < 60) return `Há ${diffMinutos} min`;

    const diffHoras = Math.floor(diffMinutos / 60);
    if (diffHoras < 24) return `Há ${diffHoras}h`;

    const diffDias = Math.floor(diffHoras / 24);
    if (diffDias < 7) return `Há ${diffDias}d`;

    return data.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: data.getFullYear() !== agora.getFullYear() ? "numeric" : undefined,
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (atividades.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        📝 Nenhuma atividade registrada ainda
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Linha vertical da timeline */}
      <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-gray-200"></div>

      {/* Lista de atividades */}
      <div className="space-y-4">
        {atividades.map((atividade, index) => (
          <div key={atividade.id} className="relative flex gap-4 items-start">
            {/* Ícone da atividade */}
            <div className="relative z-10 flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-lg">
              {getIconeTipoAcao(atividade.tipoAcao)}
            </div>

            {/* Conteúdo da atividade */}
            <div className="flex-1 bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {formatarDetalhesAtividade(
                      atividade.tipoAcao,
                      atividade.detalhes
                    )}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {atividade.usuario.photoUrl ? (
                      <img
                        src={atividade.usuario.photoUrl}
                        alt={atividade.usuario.name}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600">
                        {atividade.usuario.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <p className="text-xs text-gray-600">
                      <span className="font-medium">{atividade.usuario.name}</span>
                      {" • "}
                      {formatarTempo(atividade.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

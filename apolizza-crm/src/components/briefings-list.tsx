"use client";

interface Briefing {
  id: string;
  briefing: string;
  createdAt: string;
  usuario: {
    id: string;
    name: string;
    email: string;
    photoUrl: string | null;
  };
}

interface BriefingsListProps {
  briefings: Briefing[];
}

export function BriefingsList({ briefings }: BriefingsListProps) {
  if (briefings.length === 0) {
    return (
      <div className="text-center py-6 text-slate-500 text-sm">
        Nenhum briefing ainda. Adicione o primeiro!
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      {briefings.map((briefing, index) => (
        <div key={briefing.id} className="flex gap-3">
          {/* Timeline vertical */}
          <div className="flex flex-col items-center">
            {/* Avatar */}
            {briefing.usuario.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={briefing.usuario.photoUrl}
                alt={briefing.usuario.name}
                className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-apolizza-blue/10 flex items-center justify-center text-xs font-semibold text-apolizza-blue border-2 border-white shadow-sm">
                {briefing.usuario.name.charAt(0)}
              </div>
            )}

            {/* Linha vertical (exceto último) */}
            {index < briefings.length - 1 && (
              <div className="w-0.5 flex-1 bg-slate-200 mt-2" />
            )}
          </div>

          {/* Conteúdo */}
          <div className="flex-1 pb-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-slate-900 text-sm">
                  {briefing.usuario.name}
                </span>
                <span className="text-xs text-slate-500">
                  {formatDate(briefing.createdAt)}
                </span>
              </div>

              {/* Briefing */}
              <p className="text-slate-700 text-sm whitespace-pre-wrap">
                {briefing.briefing}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

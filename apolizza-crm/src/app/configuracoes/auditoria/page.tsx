"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AppHeader } from "@/components/app-header";

// ─── Pixel sizes ─────────────────────────────────────────────────────────────
const PX = 3; // cada "game pixel" = 3 canvas pixels
const GW = 213; // game width  (213 × 3 = 639)
const GH = 120; // game height (120 × 3 = 360)

// ─── Color palette (8-bit) ───────────────────────────────────────────────────
const C = {
  wall:    "#1E1433",
  wallL:   "#2A1D44",
  wallS:   "#160F28",
  border:  "#0D0820",
  floor:   "#7B5C14",
  floorD:  "#5E4610",
  floorS:  "#6B4F12",
  desk:    "#C07010",
  deskD:   "#7A4510",
  deskA:   "#E09020",
  paper:   "#FFFDE7",
  paperS:  "#E8D98A",
  clock:   "#F5DEB3",
  clockB:  "#4A2E10",
  clockH:  "#1a1a2e",
  label:   "#FFD700",
  labelBg: "#0D0820",
  skin:    "#FDBCB4",
  hair:    "#3D1F0A",
  coat:    "#1C2537",
  coatI:   "#2E4057",
  pants:   "#455A64",
  shoes:   "#212121",
  glass:   "#556677",
  white:   "#FFFFFF",
  shadow:  "rgba(0,0,0,0.35)",
  glow:    "rgba(255,215,0,0.15)",
};

// ─── Scene positions (game coords) ───────────────────────────────────────────
const STATIONS = {
  relatorios:  { x: 15,  y: 22, label: "RELATÓRIOS" },
  cotacoes:    { x: 158, y: 22, label: "COTAÇÕES"   },
  tarefas:     { x: 15,  y: 77, label: "TAREFAS"    },
  tratativas:  { x: 158, y: 77, label: "TRATATIVAS" },
  main:        { x: 94,  y: 77, label: "AUDITOR"    },
};
const CLOCK = { x: 100, y: 8 };

type StationKey = keyof typeof STATIONS;

// ─── Sprite: auditor (10 × 16 pixels) ────────────────────────────────────────
// 0=transparent,1=hair,2=skin,3=coat,4=coatI,5=pants,6=shoes,7=paper,8=glass
const SPRITE_DOWN = [
  [0,0,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,1,0],
  [0,1,2,2,2,2,2,2,1,0],
  [0,1,2,8,8,2,8,8,1,0],
  [0,1,2,2,2,2,2,2,1,0],
  [0,1,2,2,7,7,2,2,1,0],
  [3,3,3,3,3,3,3,3,3,0],
  [3,4,4,7,4,7,4,4,3,0],
  [3,4,4,7,4,7,4,4,3,0],
  [0,3,3,3,3,3,3,3,0,0],
  [0,0,5,5,0,0,5,5,0,0],
  [0,0,5,5,0,0,5,5,0,0],
  [0,0,6,6,0,0,6,6,0,0],
  [0,0,6,6,0,0,6,6,0,0],
];
const SPRITE_UP = [
  [0,0,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,0],
  [0,3,3,3,3,3,3,3,3,0],
  [3,4,4,4,4,4,4,4,4,3],
  [3,4,4,7,4,7,4,4,4,3],
  [3,4,4,7,4,7,4,4,4,3],
  [0,3,3,3,3,3,3,3,0,0],
  [0,0,5,5,0,0,5,5,0,0],
  [0,0,5,5,0,0,5,5,0,0],
  [0,0,6,6,0,0,6,6,0,0],
  [0,0,6,6,0,0,6,6,0,0],
];
const SPRITE_COLORS: Record<number, string | null> = {
  0: null, 1: C.hair, 2: C.skin, 3: C.coat,
  4: C.coatI, 5: C.pants, 6: C.shoes, 7: C.paper, 8: C.glass,
};

// ─── Walking legs animation ───────────────────────────────────────────────────
const WALK_LEGS = [
  [[0,0,5,0,0,0,5,5,0,0],[0,0,5,5,0,0,5,0,0,0],[0,0,6,5,0,0,6,0,0,0],[0,0,6,6,0,0,6,0,0,0]],
  [[0,0,5,5,0,0,5,0,0,0],[0,0,5,0,0,0,5,5,0,0],[0,0,6,0,0,0,6,5,0,0],[0,0,6,0,0,0,6,6,0,0]],
];

function drawSprite(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number,
  frame: number,
  facingUp: boolean,
  walking: boolean
) {
  const base = facingUp ? SPRITE_UP : SPRITE_DOWN;
  const rows = base.map((row, r) => {
    if (!walking) return row;
    if (r >= 10 && r <= 13) {
      const legRow = r - 10;
      return WALK_LEGS[frame % 2][legRow];
    }
    return row;
  });

  rows.forEach((row, r) => {
    row.forEach((p, c) => {
      const color = SPRITE_COLORS[p];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect((gx + c) * PX, (gy + r) * PX, PX, PX);
    });
  });
}

function drawRoom(ctx: CanvasRenderingContext2D) {
  // Wall
  ctx.fillStyle = C.wall;
  ctx.fillRect(0, 0, GW * PX, 70 * PX);
  // Wall stripes
  ctx.fillStyle = C.wallS;
  for (let x = 0; x < GW; x += 8) ctx.fillRect(x * PX, 0, PX, 70 * PX);
  ctx.fillStyle = C.wallL;
  for (let y = 0; y < 70; y += 12) ctx.fillRect(0, y * PX, GW * PX, PX);
  // Wall border
  ctx.fillStyle = C.border;
  ctx.fillRect(0, 68 * PX, GW * PX, 2 * PX);

  // Floor
  ctx.fillStyle = C.floor;
  ctx.fillRect(0, 70 * PX, GW * PX, (GH - 70) * PX);
  // Floor planks
  ctx.fillStyle = C.floorS;
  for (let y = 70; y < GH; y += 6) ctx.fillRect(0, y * PX, GW * PX, PX);
  ctx.fillStyle = C.floorD;
  for (let x = 0; x < GW; x += 20) ctx.fillRect(x * PX, 70 * PX, PX, (GH - 70) * PX);
}

function drawDesk(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  label: string,
  active: boolean,
  withPapers = true
) {
  const w = 40, h = 18;
  ctx.fillStyle = active ? C.deskA : C.desk;
  ctx.fillRect(x * PX, y * PX, w * PX, (h - 4) * PX);
  ctx.fillStyle = C.deskD;
  ctx.fillRect(x * PX, (y + h - 4) * PX, w * PX, 4 * PX);

  if (withPapers) {
    ctx.fillStyle = C.paper;
    ctx.fillRect((x + 3) * PX, (y + 2) * PX, 12 * PX, 8 * PX);
    ctx.fillStyle = C.paperS;
    ctx.fillRect((x + 6) * PX, (y + 4) * PX, 12 * PX, 8 * PX);
    ctx.fillStyle = C.paper;
    ctx.fillRect((x + 22) * PX, (y + 2) * PX, 14 * PX, 10 * PX);
    // Lines on paper
    ctx.fillStyle = C.paperS;
    for (let l = 0; l < 3; l++) {
      ctx.fillRect((x + 23) * PX, (y + 4 + l * 2) * PX, 12 * PX, PX);
    }
  }

  // Label
  ctx.fillStyle = active ? "#FF9900" : C.label;
  ctx.font = `bold ${PX * 3}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText(label, (x + w / 2) * PX, (y - 3) * PX);
}

function drawClock(ctx: CanvasRenderingContext2D, now: Date) {
  const cx = (CLOCK.x + 7) * PX;
  const cy = (CLOCK.y + 7) * PX;
  const r = 7 * PX;

  // Clock body
  ctx.fillStyle = C.clockB;
  ctx.beginPath();
  ctx.arc(cx, cy, (r + PX * 1.5), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.clock;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Pixel dots at 12/3/6/9
  ctx.fillStyle = C.clockH;
  [[0,-1],[1,0],[0,1],[-1,0]].forEach(([dx, dy]) => {
    ctx.fillRect((cx + dx * r * 0.7 - PX / 2), (cy + dy * r * 0.7 - PX / 2), PX, PX);
  });
  // Hour hand
  const h = (now.getHours() % 12) + now.getMinutes() / 60;
  const hA = h * Math.PI / 6 - Math.PI / 2;
  ctx.strokeStyle = C.clockH;
  ctx.lineWidth = PX;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(hA) * r * 0.5, cy + Math.sin(hA) * r * 0.5);
  ctx.stroke();
  // Minute hand
  const mA = now.getMinutes() * Math.PI / 30 - Math.PI / 2;
  ctx.lineWidth = PX * 0.7;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(mA) * r * 0.75, cy + Math.sin(mA) * r * 0.75);
  ctx.stroke();
  // Center dot
  ctx.fillStyle = C.clockH;
  ctx.beginPath();
  ctx.arc(cx, cy, PX * 0.8, 0, Math.PI * 2);
  ctx.fill();
  // "RELÓGIO" label
  ctx.fillStyle = C.label;
  ctx.font = `bold ${PX * 2.5}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText("⏰ RELÓGIO", (CLOCK.x + 7) * PX, (CLOCK.y + 17) * PX);
}

// ─── Page component ───────────────────────────────────────────────────────────

type ConsultaKey = "atrasados" | "tarefas_hoje" | "tratativas" | "pendentes" | "relatorio" | "resumo";

const OPCOES: { key: ConsultaKey; label: string; station: StationKey; desc: string }[] = [
  { key: "atrasados",    label: "Seguros Atrasados",     station: "cotacoes",   desc: "Cotações fora do prazo" },
  { key: "tarefas_hoje", label: "Tarefas de Hoje",       station: "tarefas",    desc: "Tarefas que vencem hoje" },
  { key: "tratativas",   label: "Próximas Tratativas",   station: "tratativas", desc: "Hoje e amanhã" },
  { key: "pendentes",    label: "Tarefas Pendentes",     station: "tarefas",    desc: "Não finalizadas" },
  { key: "relatorio",    label: "Relatório do Mês",      station: "relatorios", desc: "Resumo anual completo" },
  { key: "resumo",       label: "Resumo Rápido",         station: "main",       desc: "Panorama geral do dia" },
];

export default function AuditoriaPage() {
  const { data: session, status } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Character state
  const charPos = useRef({ x: 99, y: 82 }); // game coords, centered on main desk
  const targetPos = useRef({ x: 99, y: 82 });
  const walkFrame = useRef(0);
  const walkTick = useRef(0);
  const facingUp = useRef(false);

  // UI state
  const [selectedOpcao, setSelectedOpcao] = useState<ConsultaKey | null>(null);
  const [resultado, setResultado] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [activeStation, setActiveStation] = useState<StationKey | null>(null);
  const [typeText, setTypeText] = useState("");
  const [sendTelegram, setSendTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<"idle" | "ok" | "fail">("idle");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [webhookStatus, setWebhookStatus] = useState<"idle" | "loading" | "ok" | "fail">("idle");
  const [dialogLog, setDialogLog] = useState<string[]>([
    "> Auditor pronto para servir.",
    "> Selecione uma consulta abaixo.",
  ]);

  const addLog = useCallback((msg: string) => {
    setDialogLog((prev) => [...prev.slice(-6), msg]);
  }, []);

  // ─── Canvas animation loop ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

    function drawFrame() {
      const now = new Date();

      // Move character toward target
      const dx = targetPos.current.x - charPos.current.x;
      const dy = targetPos.current.y - charPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const walking = dist > 0.5;
      if (walking) {
        const speed = 0.8;
        charPos.current.x = lerp(charPos.current.x, targetPos.current.x, speed * 0.06);
        charPos.current.y = lerp(charPos.current.y, targetPos.current.y, speed * 0.06);
        facingUp.current = dy < -1;
        walkTick.current++;
        if (walkTick.current % 8 === 0) walkFrame.current = (walkFrame.current + 1) % 2;
      }

      // Draw scene
      drawRoom(ctx);
      drawClock(ctx, now);

      // Satellite desks
      Object.entries(STATIONS).forEach(([key, st]) => {
        if (key === "main") return;
        const isActive = activeStation === key;
        drawDesk(ctx, st.x, st.y, st.label, isActive);
      });

      // Main desk (auditor's)
      ctx.fillStyle = activeStation === "main" ? C.deskA : "#9B6820";
      ctx.fillRect(STATIONS.main.x * PX, (STATIONS.main.y - 2) * PX, 40 * PX, 14 * PX);
      ctx.fillStyle = C.deskD;
      ctx.fillRect(STATIONS.main.x * PX, (STATIONS.main.y + 12 - 2) * PX, 40 * PX, 4 * PX);
      ctx.fillStyle = C.paper;
      ctx.fillRect((STATIONS.main.x + 2) * PX, (STATIONS.main.y - 1) * PX, 8 * PX, 10 * PX);
      ctx.fillStyle = C.paper;
      ctx.fillRect((STATIONS.main.x + 12) * PX, (STATIONS.main.y - 1) * PX, 8 * PX, 10 * PX);
      ctx.fillStyle = C.paper;
      ctx.fillRect((STATIONS.main.x + 22) * PX, (STATIONS.main.y) * PX, 14 * PX, 8 * PX);
      // Candle/lamp on main desk
      ctx.fillStyle = "#F59E0B";
      ctx.fillRect((STATIONS.main.x + 32) * PX, (STATIONS.main.y - 4) * PX, PX * 2, PX * 6);
      ctx.fillStyle = "#FDE68A";
      ctx.fillRect((STATIONS.main.x + 32) * PX, (STATIONS.main.y - 6) * PX, PX * 2, PX * 3);

      // Draw shadow under character
      ctx.fillStyle = C.shadow;
      ctx.beginPath();
      ctx.ellipse(
        (charPos.current.x + 5) * PX,
        (charPos.current.y + 14) * PX,
        5 * PX, 2 * PX, 0, 0, Math.PI * 2
      );
      ctx.fill();

      // Draw character
      drawSprite(ctx, Math.round(charPos.current.x), Math.round(charPos.current.y), walkFrame.current, facingUp.current, walking);

      // Glow effect when at active station
      if (!walking && activeStation) {
        const st = STATIONS[activeStation];
        ctx.fillStyle = C.glow;
        ctx.fillRect(st.x * PX, st.y * PX, 40 * PX, 18 * PX);
      }

      animRef.current = requestAnimationFrame(drawFrame);
    }

    animRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animRef.current);
  }, [activeStation]);

  // ─── Consulta ──────────────────────────────────────────────────────────────
  async function handleConsulta(opcao: typeof OPCOES[0]) {
    if (loading) return;
    setSelectedOpcao(opcao.key);
    setResultado("");
    setTypeText("");
    setTelegramStatus("idle");
    setLoading(true);
    addLog(`> Consultando: ${opcao.label}...`);

    // Move to station
    const st = STATIONS[opcao.station];
    targetPos.current = { x: st.x, y: st.y + 4 };
    setActiveStation(opcao.station);

    // Wait for walk (~1.2s)
    await new Promise((r) => setTimeout(r, 1200));

    try {
      const res = await fetch("/api/auditoria/consultar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: opcao.key, enviar_telegram: false }),
      });
      const json = await res.json();
      const txt: string = json.data?.texto || "Sem dados.";

      // Walk back to main desk
      targetPos.current = { x: 99, y: 82 };
      setActiveStation("main");
      await new Promise((r) => setTimeout(r, 800));
      setActiveStation(null);

      // Type-out effect
      setResultado(txt);
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setTypeText(txt.slice(0, i));
        if (i >= txt.length) clearInterval(interval);
      }, 8);

      addLog(`> ${opcao.label}: OK ✓`);

      if (sendTelegram) {
        const r2 = await fetch("/api/auditoria/consultar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tipo: opcao.key, enviar_telegram: true }),
        });
        const j2 = await r2.json();
        setTelegramStatus(j2.data?.telegramOk ? "ok" : "fail");
        addLog(j2.data?.telegramOk ? "> Telegram: enviado ✓" : "> Telegram: falhou ✗");
      }
    } catch {
      setResultado("Erro ao consultar dados.");
      setTypeText("Erro ao consultar dados.");
      addLog("> ERRO na consulta ✗");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTelegram() {
    if (!resultado || !selectedOpcao) return;
    setTelegramStatus("idle");
    const res = await fetch("/api/auditoria/consultar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo: selectedOpcao, enviar_telegram: true }),
    });
    const json = await res.json();
    setTelegramStatus(json.data?.telegramOk ? "ok" : "fail");
    addLog(json.data?.telegramOk ? "> Telegram: enviado ✓" : "> Telegram: falhou ✗");
  }

  async function handleTest(action: "test" | "register_webhook") {
    if (action === "test") setTestStatus("testing");
    else setWebhookStatus("loading");
    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (action === "test") {
        setTestStatus(res.ok ? "ok" : "fail");
        addLog(res.ok ? "> Telegram: conexão OK ✓" : `> Telegram: ${json.error} ✗`);
      } else {
        setWebhookStatus(res.ok ? "ok" : "fail");
        addLog(res.ok ? "> Webhook registrado ✓" : `> Webhook: ${json.error} ✗`);
      }
    } catch {
      if (action === "test") setTestStatus("fail");
      else setWebhookStatus("fail");
    }
  }

  if (status === "loading") return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: "#eeedf2" }}>
      {session?.user && (
        <AppHeader
          userName={session.user.name || ""}
          userRole={session.user.role as "admin" | "cotador" | "proprietario"}
          activePage="auditoria"
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Title bar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--foreground)]">Sala do Auditor</h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Consultas e notificações via Telegram</p>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--primary)" }} />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          </div>
        </div>

        {/* Canvas scene — mantém o estilo pixel art independente do tema */}
        <div className="rounded-2xl overflow-hidden shadow-lg border-2 border-[var(--border)]">
          <canvas
            ref={canvasRef}
            width={GW * PX}
            height={GH * PX}
            className="w-full block"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        {/* Log bar */}
        <div
          className="rounded-xl px-3 py-2 text-[11px] space-y-0.5 font-mono border border-[var(--border)]"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}
        >
          {dialogLog.map((l, i) => (
            <div
              key={i}
              style={{ color: i === dialogLog.length - 1 ? "var(--primary)" : "var(--text-subtle)" }}
            >
              {l}
            </div>
          ))}
        </div>

        {/* Options grid */}
        <div
          className="rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm"
          style={{ background: "var(--surface)" }}
        >
          <div
            className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2"
            style={{ background: "var(--surface-2)" }}
          >
            <span className="text-xs font-bold tracking-wider" style={{ color: "var(--primary)" }}>
              ❯ O QUE VOCÊ DESEJA CONSULTAR?
            </span>
            {loading && (
              <span className="text-[10px] animate-pulse" style={{ color: "var(--text-muted)" }}>
                carregando...
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
            {OPCOES.map((op, i) => {
              const isSelected = selectedOpcao === op.key;
              return (
                <button
                  key={op.key}
                  disabled={loading}
                  onClick={() => handleConsulta(op)}
                  className="text-left px-3 py-2.5 rounded-xl text-xs transition-all border disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    fontFamily: "monospace",
                    background: isSelected ? "var(--primary)" : "var(--surface-2)",
                    borderColor: isSelected ? "var(--primary)" : "var(--border)",
                    color: isSelected ? "#fff" : "var(--foreground)",
                  }}
                >
                  <div className="font-bold text-[10px] mb-0.5 opacity-60">[ {i + 1} ]</div>
                  <div className="font-bold">{op.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-60">{op.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Result box */}
        {(typeText || loading) && (
          <div
            className="rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm"
            style={{ background: "var(--surface)" }}
          >
            <div
              className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-2"
              style={{ background: "var(--surface-2)" }}
            >
              <span className="text-xs font-bold tracking-wider" style={{ color: "var(--primary)" }}>
                ❯ RESULTADO
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-[11px] cursor-pointer" style={{ color: "var(--text-muted)" }}>
                  <input
                    type="checkbox"
                    checked={sendTelegram}
                    onChange={(e) => setSendTelegram(e.target.checked)}
                    className="accent-[var(--primary)]"
                  />
                  Auto-enviar Telegram
                </label>
                <button
                  onClick={handleSendTelegram}
                  disabled={!resultado}
                  className="px-3 py-1 text-[11px] font-semibold rounded-lg border transition disabled:opacity-30"
                  style={{ borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }}
                >
                  📨 Enviar Telegram
                </button>
                {telegramStatus === "ok" && <span className="text-green-500 text-[11px] font-semibold">✓ Enviado!</span>}
                {telegramStatus === "fail" && <span className="text-[var(--accent)] text-[11px] font-semibold">✗ Falhou</span>}
              </div>
            </div>
            <pre
              className="p-4 text-xs whitespace-pre-wrap break-words leading-relaxed font-mono max-h-52 overflow-y-auto"
              style={{ color: "var(--foreground)" }}
            >
              {loading && !typeText ? "..." : typeText}
              {!loading && typeText && <span className="animate-pulse" style={{ color: "var(--primary)" }}>▌</span>}
            </pre>
          </div>
        )}

        {/* Config panels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Telegram config */}
          <div
            className="rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm"
            style={{ background: "var(--surface)" }}
          >
            <div
              className="px-4 py-3 border-b border-[var(--border)]"
              style={{ background: "var(--surface-2)" }}
            >
              <span className="text-xs font-bold tracking-wider" style={{ color: "var(--primary)" }}>
                ⚙ CONFIG TELEGRAM
              </span>
            </div>
            <div className="p-4 space-y-3 text-xs font-mono">
              <div>
                <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>BOT TOKEN</p>
                <p className="truncate text-[10px]" style={{ color: "var(--text-subtle)" }}>
                  ●●●●●●●●●●●●●●●●●●●●●●●●●
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--text-muted)" }}>CHAT ID</p>
                <p className="text-[10px]" style={{ color: "var(--foreground)" }}>-1003995781173</p>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() => handleTest("test")}
                  disabled={testStatus === "testing"}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition disabled:opacity-40"
                  style={{ borderColor: "var(--primary)", color: "var(--primary)", background: "transparent" }}
                >
                  {testStatus === "testing" ? "Testando..." : testStatus === "ok" ? "✓ Conectado!" : testStatus === "fail" ? "✗ Falhou" : "Testar Conexão"}
                </button>
                <button
                  onClick={() => handleTest("register_webhook")}
                  disabled={webhookStatus === "loading"}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition disabled:opacity-40"
                  style={{ borderColor: "var(--accent)", color: "var(--accent)", background: "transparent" }}
                >
                  {webhookStatus === "loading" ? "Registrando..." : webhookStatus === "ok" ? "✓ Webhook OK" : webhookStatus === "fail" ? "✗ Falhou" : "Registrar Webhook"}
                </button>
              </div>
            </div>
          </div>

          {/* Notification rules */}
          <div
            className="rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm"
            style={{ background: "var(--surface)" }}
          >
            <div
              className="px-4 py-3 border-b border-[var(--border)]"
              style={{ background: "var(--surface-2)" }}
            >
              <span className="text-xs font-bold tracking-wider" style={{ color: "var(--primary)" }}>
                📋 REGRAS AUTOMÁTICAS
              </span>
            </div>
            <div className="p-4 space-y-2 text-[11px]">
              {[
                { label: "🚨 Seguro atrasado → Telegram imediato", time: "08:00" },
                { label: "📞 Tratativa amanhã → 08:00 BRT",        time: "08:00" },
                { label: "📞 Tratativa hoje → 08:00 BRT",          time: "08:00" },
                { label: "⏰ Tarefa vence hoje → 15:00 BRT",       time: "15:00" },
                { label: "📋 Tarefas pendentes → 15:00 BRT",       time: "15:00" },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span style={{ color: "var(--foreground)" }}>▶ {r.label}</span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0"
                    style={{ background: "var(--primary)", color: "#fff" }}
                  >
                    {r.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bot commands reference */}
        <div
          className="rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm"
          style={{ background: "var(--surface)" }}
        >
          <div
            className="px-4 py-3 border-b border-[var(--border)]"
            style={{ background: "var(--surface-2)" }}
          >
            <span className="text-xs font-bold tracking-wider" style={{ color: "var(--primary)" }}>
              🤖 COMANDOS DO BOT — TELEGRAM
            </span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2 text-[11px] font-mono">
            {[
              ["/consulta",   "Lista todos os comandos"],
              ["/atrasados",  "Seguros fora do prazo"],
              ["/tarefas",    "Tarefas para hoje"],
              ["/tratativas", "Próximas tratativas"],
              ["/pendentes",  "Tarefas não finalizadas"],
              ["/relatorio",  "Relatório do mês"],
              ["/resumo",     "Resumo geral do dia"],
            ].map(([cmd, desc]) => (
              <div key={cmd} className="flex gap-2 items-baseline">
                <span className="font-bold shrink-0" style={{ color: "var(--primary)" }}>{cmd}</span>
                <span style={{ color: "var(--text-muted)" }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

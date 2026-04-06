import { z } from "zod/v4";
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  TIPO_CLIENTE_OPTIONS,
  MES_OPTIONS,
  PRODUTO_OPTIONS,
} from "@/lib/constants";

export const cotacaoCreateSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio").max(500),
  status: z.enum(STATUS_OPTIONS).default("não iniciado"),
  priority: z.enum(PRIORITY_OPTIONS).optional().default("normal"),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  tipoCliente: z.enum(TIPO_CLIENTE_OPTIONS).nullable().optional(),
  contatoCliente: z.string().nullable().optional(),
  seguradora: z.string().nullable().optional(),
  produto: z.enum(PRODUTO_OPTIONS).nullable().optional(),
  situacao: z.string().max(100).nullable().optional(),
  indicacao: z.string().nullable().optional(),
  inicioVigencia: z.string().nullable().optional(),
  fimVigencia: z.string().nullable().optional(),
  primeiroPagamento: z.string().nullable().optional(),
  parceladoEm: z.number().int().min(1).max(120).nullable().optional(),
  premioSemIof: z.string().nullable().optional(),
  comissao: z.string().nullable().optional(),
  aReceber: z.string().nullable().optional(),
  valorPerda: z.string().nullable().optional(),
  proximaTratativa: z.string().nullable().optional(),
  observacao: z.string().nullable().optional(),
  mesReferencia: z.enum(MES_OPTIONS).nullable().optional(),
  anoReferencia: z.number().int().min(2020).max(2030).nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  isRenovacao: z.boolean().optional().default(false),
});

// For update: remove defaults so missing fields stay undefined (not default values)
export const cotacaoUpdateSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  status: z.enum(STATUS_OPTIONS).optional(),
  priority: z.enum(PRIORITY_OPTIONS).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  tipoCliente: z.enum(TIPO_CLIENTE_OPTIONS).nullable().optional(),
  contatoCliente: z.string().nullable().optional(),
  seguradora: z.string().nullable().optional(),
  produto: z.enum(PRODUTO_OPTIONS).nullable().optional(),
  situacao: z.string().max(100).nullable().optional(),
  indicacao: z.string().nullable().optional(),
  inicioVigencia: z.string().nullable().optional(),
  fimVigencia: z.string().nullable().optional(),
  primeiroPagamento: z.string().nullable().optional(),
  parceladoEm: z.number().int().min(1).max(120).nullable().optional(),
  premioSemIof: z.string().nullable().optional(),
  comissao: z.string().nullable().optional(),
  aReceber: z.string().nullable().optional(),
  valorPerda: z.string().nullable().optional(),
  proximaTratativa: z.string().nullable().optional(),
  observacao: z.string().nullable().optional(),
  mesReferencia: z.enum(MES_OPTIONS).nullable().optional(),
  anoReferencia: z.number().int().min(2020).max(2030).nullable().optional(),
  tags: z.array(z.string()).optional(),
  isRenovacao: z.boolean().optional(),
});

export type CotacaoCreateInput = z.infer<typeof cotacaoCreateSchema>;
export type CotacaoUpdateInput = z.infer<typeof cotacaoUpdateSchema>;

// ============================================================
// TAREFAS (EPIC-003)
// ============================================================

const TAREFA_STATUS_OPTIONS = [
  "Pendente",
  "Em Andamento",
  "Concluída",
  "Cancelada",
] as const;

export const tarefaCreateSchema = z.object({
  titulo: z.string().min(1, "Título é obrigatório").max(255),
  descricao: z.string().nullable().optional(),
  dataVencimento: z.string().datetime().nullable().optional(),
  status: z.enum(TAREFA_STATUS_OPTIONS).default("Pendente"),
  cotadorId: z.string().uuid("ID do cotador inválido"),
  situacao: z.string().max(100).nullable().optional(),
});

export const tarefaUpdateSchema = z.object({
  titulo: z.string().min(1).max(255).optional(),
  descricao: z.string().nullable().optional(),
  dataVencimento: z.string().datetime().nullable().optional(),
  status: z.enum(TAREFA_STATUS_OPTIONS).optional(),
  cotadorId: z.string().uuid().optional(),
});

export type TarefaCreateInput = z.infer<typeof tarefaCreateSchema>;
export type TarefaUpdateInput = z.infer<typeof tarefaUpdateSchema>;

// Story 13.2: Status Update + Briefings
export const updateStatusSchema = z.object({
  status: z.enum(TAREFA_STATUS_OPTIONS),
});

export const createBriefingSchema = z.object({
  briefing: z
    .string()
    .min(1, "Briefing não pode estar vazio")
    .max(2000, "Briefing deve ter no máximo 2000 caracteres"),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type CreateBriefingInput = z.infer<typeof createBriefingSchema>;

// Story 13.6: Upload de Anexos
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
] as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateAnexo(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "Arquivo muito grande (máximo 10MB)" };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
    return {
      valid: false,
      error: "Tipo de arquivo não permitido. Apenas PDF, PNG, JPG, DOCX e XLSX",
    };
  }

  return { valid: true };
}

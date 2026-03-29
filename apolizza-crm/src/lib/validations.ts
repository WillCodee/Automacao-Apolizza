import { z } from "zod/v4";
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  TIPO_CLIENTE_OPTIONS,
  SITUACAO_OPTIONS,
  MES_OPTIONS,
  PRODUTO_OPTIONS,
} from "@/lib/constants";

export const cotacaoCreateSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio").max(500),
  status: z.enum(STATUS_OPTIONS).default("nao iniciado"),
  priority: z.enum(PRIORITY_OPTIONS).optional().default("normal"),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  tipoCliente: z.enum(TIPO_CLIENTE_OPTIONS).nullable().optional(),
  contatoCliente: z.string().nullable().optional(),
  seguradora: z.string().nullable().optional(),
  produto: z.enum(PRODUTO_OPTIONS).nullable().optional(),
  situacao: z.enum(SITUACAO_OPTIONS).nullable().optional(),
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
  situacao: z.enum(SITUACAO_OPTIONS).nullable().optional(),
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

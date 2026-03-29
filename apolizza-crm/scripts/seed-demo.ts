import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/schema";
import { eq } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const COTACOES_DEMO = [
  {
    name: "Ricardo Mendes - Seguro Auto Honda Civic",
    status: "fechado",
    tipoCliente: "NOVO",
    contatoCliente: "(11) 98765-4321",
    seguradora: "Porto Seguro",
    produto: "AUTO",
    situacao: "FECHADO",
    indicacao: "Google Ads",
    inicioVigencia: "2026-01-15",
    fimVigencia: "2027-01-15",
    primeiroPagamento: "2026-01-20",
    parceladoEm: 10,
    premioSemIof: "3200.00",
    comissao: "480.00",
    aReceber: "480.00",
    mesReferencia: "JAN",
    anoReferencia: 2026,
    observacao: "Cliente satisfeito, indicou 2 amigos",
    priority: "alta",
  },
  {
    name: "Fernanda Costa - Saude PF Familia",
    status: "fechado",
    tipoCliente: "NOVO",
    contatoCliente: "(11) 97654-3210",
    seguradora: "SulAmerica",
    produto: "SAUDE PF",
    situacao: "FECHADO",
    indicacao: "Indicacao cliente",
    inicioVigencia: "2026-02-01",
    fimVigencia: "2027-02-01",
    primeiroPagamento: "2026-02-05",
    parceladoEm: 12,
    premioSemIof: "18500.00",
    comissao: "2775.00",
    aReceber: "2775.00",
    mesReferencia: "FEV",
    anoReferencia: 2026,
    observacao: "Plano familiar 4 vidas - Especial 100",
    priority: "alta",
  },
  {
    name: "Carlos Alberto Silva - Renovacao Empresarial",
    status: "fechado",
    tipoCliente: "RENOVAÇÃO",
    contatoCliente: "(11) 99876-5432",
    seguradora: "Allianz",
    produto: "EMPRESARIAL",
    situacao: "FECHADO",
    indicacao: "Carteira propria",
    inicioVigencia: "2026-03-01",
    fimVigencia: "2027-03-01",
    primeiroPagamento: "2026-03-10",
    parceladoEm: 4,
    premioSemIof: "8900.00",
    comissao: "1780.00",
    aReceber: "1780.00",
    mesReferencia: "MAR",
    anoReferencia: 2026,
    observacao: "Renovacao com aumento de cobertura - galpao novo",
    isRenovacao: true,
    priority: "normal",
  },
  {
    name: "Ana Paula Rodrigues - Vida PJ 15 vidas",
    status: "em andamento",
    tipoCliente: "NOVO",
    contatoCliente: "(21) 98765-1234",
    seguradora: "MetLife",
    produto: "VIDA PJ",
    situacao: "COTAR",
    indicacao: "LinkedIn",
    mesReferencia: "MAR",
    anoReferencia: 2026,
    premioSemIof: "12000.00",
    aReceber: "1800.00",
    observacao: "Empresa de tecnologia, 15 colaboradores. Aguardando proposta da seguradora",
    priority: "alta",
    dueDate: "2026-04-05T00:00:00Z",
  },
  {
    name: "Marcos Oliveira - Auto Toyota Corolla",
    status: "em andamento",
    tipoCliente: "NOVO/CASA",
    contatoCliente: "(11) 91234-5678",
    seguradora: "Tokio Marine",
    produto: "AUTO",
    situacao: "CLIENTE",
    indicacao: "Indicacao - Ricardo Mendes",
    mesReferencia: "MAR",
    anoReferencia: 2026,
    premioSemIof: "4100.00",
    aReceber: "615.00",
    observacao: "Indicado pelo Ricardo. Cotacao enviada, aguardando retorno",
    priority: "normal",
    dueDate: "2026-04-02T00:00:00Z",
  },
  {
    name: "Juliana Ferreira - Residencial Alto Padrao",
    status: "aprovado",
    tipoCliente: "NOVO",
    contatoCliente: "(11) 94567-8901",
    seguradora: "Bradesco Seguros",
    produto: "RESIDENCIAL",
    situacao: "CLIENTE",
    indicacao: "Instagram",
    mesReferencia: "MAR",
    anoReferencia: 2026,
    premioSemIof: "2800.00",
    comissao: "560.00",
    aReceber: "560.00",
    observacao: "Apartamento Jardins SP - cobertura completa. Cliente aprovou, aguardando docs",
    priority: "normal",
    dueDate: "2026-04-01T00:00:00Z",
  },
  {
    name: "Roberto Tanaka - Frota 8 veiculos",
    status: "em analise",
    tipoCliente: "NOVO",
    contatoCliente: "(11) 93456-7890",
    seguradora: "HDI Seguros",
    produto: "FROTA/FROTAS",
    situacao: "COTAR",
    indicacao: "Parceiro comercial",
    mesReferencia: "MAR",
    anoReferencia: 2026,
    premioSemIof: "32000.00",
    aReceber: "4800.00",
    observacao: "Frota de 8 Fiat Fiorino - transportadora. Analise de risco em andamento na HDI",
    priority: "urgente",
    dueDate: "2026-04-10T00:00:00Z",
  },
  {
    name: "Patricia Lima - Saude PME 30 vidas",
    status: "pendencia",
    tipoCliente: "NOVO",
    contatoCliente: "(11) 92345-6789",
    seguradora: "Amil",
    produto: "SAUDE PME",
    situacao: "RAUT",
    mesReferencia: "MAR",
    anoReferencia: 2026,
    premioSemIof: "45000.00",
    aReceber: "6750.00",
    observacao: "PME 30 vidas. Pendente CNPJ atualizado e relacao de vidas com CPF",
    priority: "alta",
    dueDate: "2026-04-08T00:00:00Z",
  },
  {
    name: "Eduardo Santos - RC Profissional Engenheiro",
    status: "perda",
    tipoCliente: "NOVO",
    contatoCliente: "(11) 96789-0123",
    seguradora: "Zurich",
    produto: "RC PROFISSIONAL",
    situacao: "PERDA/RESGATE",
    indicacao: "CREA-SP",
    mesReferencia: "FEV",
    anoReferencia: 2026,
    premioSemIof: "5600.00",
    valorPerda: "840.00",
    observacao: "Cliente achou caro, fechou com concorrente por R$ 4.800",
    priority: "normal",
  },
  {
    name: "Luciana Braga - Renovacao Auto + Residencial",
    status: "implantando",
    tipoCliente: "RENOVAÇÃO",
    contatoCliente: "(11) 95678-9012",
    seguradora: "Liberty Seguros",
    produto: "AUTO",
    situacao: "IMPLANTAÇÃO",
    indicacao: "Carteira propria",
    inicioVigencia: "2026-04-01",
    fimVigencia: "2027-04-01",
    primeiroPagamento: "2026-04-05",
    parceladoEm: 8,
    premioSemIof: "5200.00",
    comissao: "780.00",
    aReceber: "780.00",
    mesReferencia: "MAR",
    anoReferencia: 2026,
    observacao: "Renovacao auto + residencial combo. Implantacao em andamento na Liberty",
    isRenovacao: true,
    priority: "normal",
  },
];

async function seedDemo() {
  // Get admin user for assignee
  const [admin] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, "gustavo"));

  // Get or create Maria as cotador
  let [maria] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, "maria"));

  if (!maria) {
    console.log("Maria nao encontrada, usando admin para todas");
  }

  const assignees = [admin, maria || admin];

  for (let i = 0; i < COTACOES_DEMO.length; i++) {
    const c = COTACOES_DEMO[i];
    const assignee = assignees[i % 2]; // Alterna entre admin e maria

    await db.insert(schema.cotacoes).values({
      name: c.name,
      status: c.status,
      priority: c.priority || "normal",
      tipoCliente: c.tipoCliente || null,
      contatoCliente: c.contatoCliente || null,
      seguradora: c.seguradora || null,
      produto: c.produto || null,
      situacao: c.situacao || null,
      indicacao: c.indicacao || null,
      inicioVigencia: c.inicioVigencia || null,
      fimVigencia: c.fimVigencia || null,
      primeiroPagamento: c.primeiroPagamento || null,
      parceladoEm: c.parceladoEm || null,
      premioSemIof: c.premioSemIof || null,
      comissao: c.comissao || null,
      aReceber: c.aReceber || null,
      valorPerda: c.valorPerda || null,
      mesReferencia: c.mesReferencia || null,
      anoReferencia: c.anoReferencia || null,
      observacao: c.observacao || null,
      isRenovacao: c.isRenovacao || false,
      assigneeId: assignee.id,
      dueDate: c.dueDate ? new Date(c.dueDate) : null,
    });

    console.log(`✓ ${c.name} (${c.status})`);
  }

  // Also set meta for presentation
  const existing = await db
    .select()
    .from(schema.metas)
    .where(eq(schema.metas.ano, 2026));

  if (existing.length === 0) {
    await db.insert(schema.metas).values({
      ano: 2026,
      mes: 3,
      metaValor: "50000.00",
      metaQtdCotacoes: 15,
    });
    console.log("\n✓ Meta MAR/2026: R$ 50.000 / 15 cotacoes");
  }

  console.log("\n10 cotacoes demo criadas com sucesso!");
}

seedDemo().catch(console.error);

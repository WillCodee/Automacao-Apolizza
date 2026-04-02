import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies BEFORE imports using vi.hoisted
const { mockGetCurrentUser, mockDbInsert, mockDbValues, mockDbReturning } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockDbInsert: vi.fn().mockReturnThis(),
  mockDbValues: vi.fn().mockReturnThis(),
  mockDbReturning: vi.fn(),
}));

vi.mock('@/lib/auth-helpers', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: mockDbInsert,
    values: mockDbValues,
    returning: mockDbReturning,
  },
}));

// Import after mocks
import { POST } from '@/app/api/tarefas/route';
import { mockAdminUser, mockCotadorUser, mockTarefa } from '../../helpers/mocks';

vi.mock('@/lib/api-helpers', () => ({
  apiSuccess: (data: unknown, status?: number) =>
    Response.json({ success: true, data }, { status: status || 200 }),
  apiError: (message: string, status: number) =>
    Response.json({ success: false, error: message }, { status }),
}));

vi.mock('@/lib/validations', () => ({
  tarefaCreateSchema: {
    parse: (data: unknown) => data, // Pass-through validation in tests
  },
}));

vi.mock('@/lib/schema', () => ({
  tarefas: {},
}));

describe('POST /api/tarefas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbReturning.mockResolvedValue([mockTarefa]);
    mockDbInsert.mockReturnThis();
    mockDbValues.mockReturnThis();
  });

  describe('Autenticação', () => {
    it('deve retornar 401 se usuário não autenticado', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/tarefas', {
        method: 'POST',
        body: JSON.stringify({
          titulo: 'Nova Tarefa',
          descricao: 'Descrição',
          cotadorId: 'cotador-123',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Não autenticado');
    });
  });

  describe('Autorização', () => {
    it('deve retornar 403 se usuário não é admin', async () => {
      mockGetCurrentUser.mockResolvedValue(mockCotadorUser);

      const request = new Request('http://localhost:3000/api/tarefas', {
        method: 'POST',
        body: JSON.stringify({
          titulo: 'Nova Tarefa',
          descricao: 'Descrição',
          cotadorId: 'cotador-123',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Apenas administradores');
    });

    it('deve permitir admin criar tarefa', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);

      const request = new Request('http://localhost:3000/api/tarefas', {
        method: 'POST',
        body: JSON.stringify({
          titulo: 'Nova Tarefa',
          descricao: 'Descrição',
          status: 'Pendente',
          cotadorId: 'cotador-123',
          dataVencimento: '2026-12-31',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });
  });

  describe('Validação', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
    });

    it('deve retornar 400 se título não fornecido', async () => {
      const request = new Request('http://localhost:3000/api/tarefas', {
        method: 'POST',
        body: JSON.stringify({
          descricao: 'Descrição',
          cotadorId: 'cotador-123',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('deve retornar 400 se cotadorId não fornecido', async () => {
      const request = new Request('http://localhost:3000/api/tarefas', {
        method: 'POST',
        body: JSON.stringify({
          titulo: 'Nova Tarefa',
          descricao: 'Descrição',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('deve aceitar tarefa válida com todos os campos', async () => {
      const request = new Request('http://localhost:3000/api/tarefas', {
        method: 'POST',
        body: JSON.stringify({
          titulo: 'Tarefa Completa',
          descricao: 'Descrição detalhada',
          status: 'Pendente',
          cotadorId: 'cotador-123',
          dataVencimento: '2026-12-31',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });

    it('deve aceitar tarefa sem dataVencimento (opcional)', async () => {
      const request = new Request('http://localhost:3000/api/tarefas', {
        method: 'POST',
        body: JSON.stringify({
          titulo: 'Tarefa Sem Data',
          descricao: 'Descrição',
          cotadorId: 'cotador-123',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
    });

    it('deve rejeitar status inválido', async () => {
      const request = new Request('http://localhost:3000/api/tarefas', {
        method: 'POST',
        body: JSON.stringify({
          titulo: 'Tarefa',
          cotadorId: 'cotador-123',
          status: 'StatusInvalido',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('deve rejeitar dataVencimento inválida', async () => {
      const request = new Request('http://localhost:3000/api/tarefas', {
        method: 'POST',
        body: JSON.stringify({
          titulo: 'Tarefa',
          cotadorId: 'cotador-123',
          dataVencimento: 'data-invalida',
        }),
      });

      const response = await POST(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });
});

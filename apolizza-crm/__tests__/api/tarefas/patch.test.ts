import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies BEFORE imports using vi.hoisted
const { mockGetCurrentUser, mockDbFindFirst, mockDbUpdate, mockDbSet, mockDbWhere, mockDbReturning } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockDbFindFirst: vi.fn(),
  mockDbUpdate: vi.fn().mockReturnThis(),
  mockDbSet: vi.fn().mockReturnThis(),
  mockDbWhere: vi.fn().mockReturnThis(),
  mockDbReturning: vi.fn(),
}));

vi.mock('@/lib/auth-helpers', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      tarefas: {
        findFirst: mockDbFindFirst,
      },
    },
    update: mockDbUpdate,
  },
}));

// Import after mocks
import { PATCH } from '@/app/api/tarefas/[id]/route';
import { mockAdminUser, mockCotadorUser, mockTarefa } from '../../helpers/mocks';

vi.mock('@/lib/api-helpers', () => ({
  apiSuccess: (data: unknown, status?: number) =>
    Response.json({ success: true, data }, { status: status || 200 }),
  apiError: (message: string, status: number) =>
    Response.json({ success: false, error: message }, { status }),
}));

vi.mock('@/lib/validations', () => ({
  tarefaUpdateSchema: {
    parse: (data: unknown) => data, // Pass-through validation in tests
  },
}));

vi.mock('@/lib/schema', () => ({
  tarefas: {},
}));

describe('PATCH /api/tarefas/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnThis();
    mockDbSet.mockReturnThis();
    mockDbWhere.mockReturnThis();
    mockDbReturning.mockResolvedValue([mockTarefa]);
  });

  describe('Autenticação', () => {
    it('deve retornar 401 se usuário não autenticado', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'PATCH',
        body: JSON.stringify({ titulo: 'Novo Título' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Não autenticado');
    });
  });

  describe('Autorização', () => {
    it('deve retornar 403 se usuário não é admin', async () => {
      mockGetCurrentUser.mockResolvedValue(mockCotadorUser);
      mockDbFindFirst.mockResolvedValue(mockTarefa);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'PATCH',
        body: JSON.stringify({ titulo: 'Novo Título' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Apenas administradores');
    });

    it('deve permitir admin editar tarefa', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      mockDbFindFirst.mockResolvedValue(mockTarefa);
      mockDbWhere.mockReturnThis();
      mockDbReturning.mockResolvedValue([{ ...mockTarefa, titulo: 'Título Atualizado' }]);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'PATCH',
        body: JSON.stringify({ titulo: 'Título Atualizado' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });
  });

  describe('Tarefa Não Encontrada', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
    });

    it('deve retornar 404 se tarefa não existe', async () => {
      mockDbFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-inexistente', {
        method: 'PATCH',
        body: JSON.stringify({ titulo: 'Novo Título' }),
      });

      const params = Promise.resolve({ id: 'tarefa-inexistente' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('não encontrada');
    });
  });

  describe('Validação de Campos', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      mockDbFindFirst.mockResolvedValue(mockTarefa);
      mockDbWhere.mockReturnThis();
      mockDbReturning.mockResolvedValue([mockTarefa]);
    });

    it('deve permitir atualizar apenas título', async () => {
      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'PATCH',
        body: JSON.stringify({ titulo: 'Novo Título' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('deve permitir atualizar apenas status', async () => {
      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Concluída' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('deve permitir atualizar múltiplos campos', async () => {
      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'PATCH',
        body: JSON.stringify({
          titulo: 'Título Atualizado',
          descricao: 'Nova Descrição',
          status: 'Em Andamento',
        }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('deve permitir remover dataVencimento (null)', async () => {
      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'PATCH',
        body: JSON.stringify({ dataVencimento: null }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      mockDbFindFirst.mockResolvedValue(mockTarefa);
    });

    it('deve rejeitar status inválido', async () => {
      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'StatusInvalido' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('deve rejeitar dataVencimento inválida', async () => {
      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'PATCH',
        body: JSON.stringify({ dataVencimento: 'data-invalida' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('deve aceitar body vazio (nenhum campo para atualizar)', async () => {
      mockDbWhere.mockReturnThis();
      mockDbReturning.mockResolvedValue([mockTarefa]);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'PATCH',
        body: JSON.stringify({}),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

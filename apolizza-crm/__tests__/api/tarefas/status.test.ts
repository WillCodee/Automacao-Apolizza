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

vi.mock('@/lib/api-helpers', () => ({
  apiSuccess: (data: unknown, status?: number) =>
    Response.json({ success: true, data }, { status: status || 200 }),
  apiError: (message: string, status: number) =>
    Response.json({ success: false, error: message }, { status }),
}));

vi.mock('@/lib/validations', () => ({
  updateStatusSchema: {
    parse: (data: unknown) => data,
  },
}));

vi.mock('@/lib/schema', () => ({
  tarefas: {},
}));

// Import after mocks
import { PATCH } from '@/app/api/tarefas/[id]/status/route';

const mockAdminUser = {
  id: 'admin-123',
  email: 'admin@test.com',
  name: 'Admin User',
  role: 'admin' as const,
};

const mockCotadorUser = {
  id: 'cotador-123',
  email: 'cotador@test.com',
  name: 'Cotador User',
  role: 'cotador' as const,
};

const mockCotadorUser2 = {
  id: 'cotador-456',
  email: 'cotador2@test.com',
  name: 'Cotador User 2',
  role: 'cotador' as const,
};

const mockTarefa = {
  id: 'tarefa-123',
  titulo: 'Tarefa de Teste',
  descricao: 'Descrição',
  dataVencimento: new Date('2026-12-31'),
  status: 'Pendente' as const,
  cotadorId: mockCotadorUser.id,
  criadorId: mockAdminUser.id,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PATCH /api/tarefas/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbUpdate.mockReturnThis();
    mockDbSet.mockReturnThis();
    mockDbWhere.mockReturnThis();
    mockDbReturning.mockResolvedValue([{ ...mockTarefa, status: 'Em Andamento' }]);
  });

  describe('Autenticação', () => {
    it('deve retornar 401 se usuário não autenticado', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Em Andamento' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Não autenticado');
    });
  });

  describe('Permissões - Cotador', () => {
    it('deve permitir cotador atualizar status da sua própria tarefa', async () => {
      mockGetCurrentUser.mockResolvedValue(mockCotadorUser);
      mockDbFindFirst.mockResolvedValue(mockTarefa);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Em Andamento' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('deve retornar 403 se cotador tentar atualizar tarefa de outro cotador', async () => {
      mockGetCurrentUser.mockResolvedValue(mockCotadorUser2);
      mockDbFindFirst.mockResolvedValue(mockTarefa); // tarefa pertence a cotador-123

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Em Andamento' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('suas próprias tarefas');
    });
  });

  describe('Permissões - Admin', () => {
    it('deve permitir admin atualizar status de qualquer tarefa', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      mockDbFindFirst.mockResolvedValue(mockTarefa);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Em Andamento' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Tarefa Não Encontrada', () => {
    it('deve retornar 404 se tarefa não existe', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      mockDbFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-inexistente/status', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Em Andamento' }),
      });

      const params = Promise.resolve({ id: 'tarefa-inexistente' });
      const response = await PATCH(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('não encontrada');
    });
  });
});

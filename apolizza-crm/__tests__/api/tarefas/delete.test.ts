import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies BEFORE imports using vi.hoisted
const { mockGetCurrentUser, mockDbFindFirst, mockDbDelete, mockDbWhere } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockDbFindFirst: vi.fn(),
  mockDbDelete: vi.fn().mockReturnThis(),
  mockDbWhere: vi.fn().mockResolvedValue([]),
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
    delete: mockDbDelete,
  },
}));

// Import after mocks
import { DELETE } from '@/app/api/tarefas/[id]/route';
import { mockAdminUser, mockCotadorUser, mockTarefa } from '../../helpers/mocks';

vi.mock('@/lib/api-helpers', () => ({
  apiSuccess: (data: unknown, status?: number) =>
    Response.json({ success: true, data }, { status: status || 200 }),
  apiError: (message: string, status: number) =>
    Response.json({ success: false, error: message }, { status }),
}));

vi.mock('@/lib/schema', () => ({
  tarefas: {},
}));

describe('DELETE /api/tarefas/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbDelete.mockReturnThis();
  });

  describe('Autenticação', () => {
    it('deve retornar 401 se usuário não autenticado', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'DELETE',
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await DELETE(request as any, { params });
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
        method: 'DELETE',
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await DELETE(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Apenas administradores');
    });

    it('deve permitir admin deletar tarefa', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      mockDbFindFirst.mockResolvedValue(mockTarefa);
      mockDbWhere.mockResolvedValue([]);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'DELETE',
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await DELETE(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toContain('deletada com sucesso');
    });
  });

  describe('Tarefa Não Encontrada', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
    });

    it('deve retornar 404 se tarefa não existe', async () => {
      mockDbFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-inexistente', {
        method: 'DELETE',
      });

      const params = Promise.resolve({ id: 'tarefa-inexistente' });
      const response = await DELETE(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('não encontrada');
    });
  });

  describe('Deleção Permanente', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      mockDbFindFirst.mockResolvedValue(mockTarefa);
      mockDbWhere.mockResolvedValue([]);
    });

    it('deve deletar tarefa do banco de dados', async () => {
      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'DELETE',
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      await DELETE(request as any, { params });

      expect(mockDbDelete).toHaveBeenCalled();
      expect(mockDbWhere).toHaveBeenCalled();
    });

    it('deve retornar mensagem de sucesso', async () => {
      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'DELETE',
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await DELETE(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toBe('Tarefa deletada com sucesso');
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
    });

    it('deve lidar com ID inválido (não UUID)', async () => {
      mockDbFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/tarefas/id-invalido', {
        method: 'DELETE',
      });

      const params = Promise.resolve({ id: 'id-invalido' });
      const response = await DELETE(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });

    it('deve permitir deletar tarefa com relations (cascade)', async () => {
      const tarefaComRelations = {
        ...mockTarefa,
        cotador: mockCotadorUser,
        criador: mockAdminUser,
      };
      mockDbFindFirst.mockResolvedValue(tarefaComRelations);
      mockDbWhere.mockResolvedValue([]);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123', {
        method: 'DELETE',
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await DELETE(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

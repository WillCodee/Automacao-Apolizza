import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies BEFORE imports using vi.hoisted
const { mockGetCurrentUser, mockDbFindMany, mockDbSelect, mockDbFrom, mockDbWhere } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockDbFindMany: vi.fn(),
  mockDbSelect: vi.fn().mockReturnThis(),
  mockDbFrom: vi.fn().mockReturnThis(),
  mockDbWhere: vi.fn().mockResolvedValue([{ value: 10 }]),
}));

vi.mock('@/lib/auth-helpers', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      tarefas: {
        findMany: mockDbFindMany,
      },
    },
    select: mockDbSelect,
    from: mockDbFrom,
    where: mockDbWhere,
  },
}));

// Import after mocks
import { GET } from '@/app/api/tarefas/route';
import { mockAdminUser, mockCotadorUser, mockCotadorUser2, mockTarefa } from '../../helpers/mocks';

vi.mock('@/lib/api-helpers', () => ({
  apiSuccess: (data: unknown, status?: number) =>
    Response.json({ success: true, data }, { status: status || 200 }),
  apiError: (message: string, status: number) =>
    Response.json({ success: false, error: message }, { status }),
  apiPaginated: (data: unknown, meta: unknown) =>
    Response.json({ success: true, data, meta }, { status: 200 }),
}));

vi.mock('@/lib/schema', () => ({
  tarefas: {},
}));

describe('GET /api/tarefas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Autenticação', () => {
    it('deve retornar 401 se usuário não autenticado', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/tarefas');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Não autenticado');
    });
  });

  describe('Permissões Admin', () => {
    it('deve permitir admin ver todas as tarefas', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      mockDbFindMany.mockResolvedValue([
        { ...mockTarefa, cotadorId: mockCotadorUser.id },
        { ...mockTarefa, cotadorId: mockCotadorUser2.id },
      ]);

      const request = new Request('http://localhost:3000/api/tarefas');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
    });

    it('deve permitir admin filtrar por cotadorId', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      mockDbFindMany.mockResolvedValue([
        { ...mockTarefa, cotadorId: mockCotadorUser.id },
      ]);

      const request = new Request('http://localhost:3000/api/tarefas?cotadorId=cotador-123');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
    });
  });

  describe('Permissões Cotador', () => {
    it('deve permitir cotador ver apenas suas tarefas', async () => {
      mockGetCurrentUser.mockResolvedValue(mockCotadorUser);
      mockDbFindMany.mockResolvedValue([
        { ...mockTarefa, cotadorId: mockCotadorUser.id },
      ]);

      const request = new Request('http://localhost:3000/api/tarefas');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].cotadorId).toBe(mockCotadorUser.id);
    });

    it('não deve permitir cotador ver tarefas de outro cotador', async () => {
      mockGetCurrentUser.mockResolvedValue(mockCotadorUser);
      mockDbFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost:3000/api/tarefas?cotadorId=cotador-456');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(0);
    });
  });

  describe('Paginação', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
    });

    it('deve usar paginação padrão (página 1, limite 50)', async () => {
      mockDbFindMany.mockResolvedValue([mockTarefa]);

      const request = new Request('http://localhost:3000/api/tarefas');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta).toBeDefined();
      expect(data.meta.page).toBe(1);
      expect(data.meta.limit).toBe(50);
    });

    it('deve respeitar parâmetro de página', async () => {
      mockDbFindMany.mockResolvedValue([mockTarefa]);

      const request = new Request('http://localhost:3000/api/tarefas?page=2');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.page).toBe(2);
    });

    it('deve respeitar parâmetro de limite', async () => {
      mockDbFindMany.mockResolvedValue([mockTarefa]);

      const request = new Request('http://localhost:3000/api/tarefas?limit=10');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.limit).toBe(10);
    });

    it('deve limitar máximo de 100 itens por página', async () => {
      mockDbFindMany.mockResolvedValue([mockTarefa]);

      const request = new Request('http://localhost:3000/api/tarefas?limit=200');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.limit).toBe(100);
    });

    it('deve garantir página mínima de 1', async () => {
      mockDbFindMany.mockResolvedValue([mockTarefa]);

      const request = new Request('http://localhost:3000/api/tarefas?page=0');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.page).toBe(1);
    });
  });

  describe('Filtros', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
    });

    it('deve filtrar por status', async () => {
      mockDbFindMany.mockResolvedValue([
        { ...mockTarefa, status: 'Pendente' },
      ]);

      const request = new Request('http://localhost:3000/api/tarefas?status=Pendente');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('deve combinar múltiplos filtros', async () => {
      mockDbFindMany.mockResolvedValue([
        { ...mockTarefa, status: 'Em Andamento', cotadorId: mockCotadorUser.id },
      ]);

      const request = new Request('http://localhost:3000/api/tarefas?status=Em%20Andamento&cotadorId=cotador-123');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
    });

    it('deve retornar array vazio se não houver tarefas', async () => {
      mockDbFindMany.mockResolvedValue([]);

      const request = new Request('http://localhost:3000/api/tarefas');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(0);
    });

    it('deve incluir relations (cotador, criador)', async () => {
      mockDbFindMany.mockResolvedValue([
        {
          ...mockTarefa,
          cotador: mockCotadorUser,
          criador: mockAdminUser,
        },
      ]);

      const request = new Request('http://localhost:3000/api/tarefas');
      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data[0].cotador).toBeDefined();
      expect(data.data[0].criador).toBeDefined();
    });
  });
});

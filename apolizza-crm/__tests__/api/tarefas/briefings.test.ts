import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies BEFORE imports using vi.hoisted
const {
  mockGetCurrentUser,
  mockDbFindFirst,
  mockDbFindMany,
  mockDbInsert,
  mockDbValues,
  mockDbReturning,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockDbFindFirst: vi.fn(),
  mockDbFindMany: vi.fn(),
  mockDbInsert: vi.fn().mockReturnThis(),
  mockDbValues: vi.fn().mockReturnThis(),
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
      tarefasBriefings: {
        findFirst: mockDbFindFirst,
        findMany: mockDbFindMany,
      },
    },
    insert: mockDbInsert,
  },
}));

vi.mock('@/lib/api-helpers', () => ({
  apiSuccess: (data: unknown, status?: number) =>
    Response.json({ success: true, data }, { status: status || 200 }),
  apiError: (message: string, status: number) =>
    Response.json({ success: false, error: message }, { status }),
}));

vi.mock('@/lib/validations', () => ({
  createBriefingSchema: {
    parse: (data: unknown) => data,
  },
}));

vi.mock('@/lib/schema', () => ({
  tarefas: {},
  tarefasBriefings: {},
}));

// Import after mocks
import { GET, POST } from '@/app/api/tarefas/[id]/briefings/route';

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

const mockBriefing = {
  id: 'briefing-123',
  tarefaId: 'tarefa-123',
  usuarioId: mockCotadorUser.id,
  briefing: 'Briefing de teste',
  createdAt: new Date(),
};

describe('GET /api/tarefas/[id]/briefings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Autenticação', () => {
    it('deve retornar 401 se usuário não autenticado', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123/briefings');
      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await GET(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('Permissões', () => {
    it('deve permitir cotador ver briefings da sua tarefa', async () => {
      mockGetCurrentUser.mockResolvedValue(mockCotadorUser);
      mockDbFindFirst.mockResolvedValue(mockTarefa);
      mockDbFindMany.mockResolvedValue([mockBriefing]);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123/briefings');
      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await GET(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('deve retornar 403 se cotador tentar ver briefings de outra tarefa', async () => {
      mockGetCurrentUser.mockResolvedValue(mockCotadorUser2);
      mockDbFindFirst.mockResolvedValue(mockTarefa);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123/briefings');
      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await GET(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });

  describe('Tarefa Não Encontrada', () => {
    it('deve retornar 404 se tarefa não existe', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      mockDbFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-inexistente/briefings');
      const params = Promise.resolve({ id: 'tarefa-inexistente' });
      const response = await GET(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });
});

describe('POST /api/tarefas/[id]/briefings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbInsert.mockReturnThis();
    mockDbValues.mockReturnThis();
    mockDbReturning.mockResolvedValue([mockBriefing]);
  });

  describe('Autenticação', () => {
    it('deve retornar 401 se usuário não autenticado', async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123/briefings', {
        method: 'POST',
        body: JSON.stringify({ briefing: 'Novo briefing' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await POST(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });
  });

  describe('Permissões', () => {
    it('deve permitir cotador adicionar briefing à sua tarefa', async () => {
      mockGetCurrentUser.mockResolvedValue(mockCotadorUser);
      mockDbFindFirst.mockResolvedValueOnce(mockTarefa); // Para verificar tarefa existe
      mockDbFindFirst.mockResolvedValueOnce({ ...mockBriefing, usuario: mockCotadorUser }); // Para retornar briefing com relations

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123/briefings', {
        method: 'POST',
        body: JSON.stringify({ briefing: 'Novo briefing' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await POST(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });

    it('deve retornar 403 se cotador tentar adicionar briefing a tarefa de outro', async () => {
      mockGetCurrentUser.mockResolvedValue(mockCotadorUser2);
      mockDbFindFirst.mockResolvedValue(mockTarefa);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123/briefings', {
        method: 'POST',
        body: JSON.stringify({ briefing: 'Novo briefing' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await POST(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('suas próprias tarefas');
    });

    it('deve permitir admin adicionar briefing a qualquer tarefa', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      mockDbFindFirst.mockResolvedValueOnce(mockTarefa);
      mockDbFindFirst.mockResolvedValueOnce({ ...mockBriefing, usuario: mockAdminUser });

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-123/briefings', {
        method: 'POST',
        body: JSON.stringify({ briefing: 'Novo briefing' }),
      });

      const params = Promise.resolve({ id: 'tarefa-123' });
      const response = await POST(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });
  });

  describe('Tarefa Não Encontrada', () => {
    it('deve retornar 404 se tarefa não existe', async () => {
      mockGetCurrentUser.mockResolvedValue(mockAdminUser);
      mockDbFindFirst.mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/tarefas/tarefa-inexistente/briefings', {
        method: 'POST',
        body: JSON.stringify({ briefing: 'Novo briefing' }),
      });

      const params = Promise.resolve({ id: 'tarefa-inexistente' });
      const response = await POST(request as any, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });
});

import { vi } from 'vitest';

// Mock user types
export const mockAdminUser = {
  id: 'admin-123',
  email: 'admin@test.com',
  name: 'Admin User',
  role: 'admin' as const,
};

export const mockCotadorUser = {
  id: 'cotador-123',
  email: 'cotador@test.com',
  name: 'Cotador User',
  role: 'cotador' as const,
};

export const mockCotadorUser2 = {
  id: 'cotador-456',
  email: 'cotador2@test.com',
  name: 'Cotador User 2',
  role: 'cotador' as const,
};

// Mock tarefa
export const mockTarefa = {
  id: 'tarefa-123',
  titulo: 'Tarefa de Teste',
  descricao: 'Descrição da tarefa',
  dataVencimento: new Date('2026-12-31'),
  status: 'Pendente' as const,
  cotadorId: mockCotadorUser.id,
  criadorId: mockAdminUser.id,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock DB queries
export const createMockDb = () => ({
  query: {
    tarefas: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn(),
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
});

// Mock getCurrentUser
export const mockGetCurrentUser = vi.fn();

// Mock API helpers
export const mockApiSuccess = vi.fn((data: unknown, status?: number) => ({
  json: async () => ({ success: true, data }),
  status: status || 200,
}));

export const mockApiError = vi.fn((message: string, status: number) => ({
  json: async () => ({ success: false, error: message }),
  status,
}));

export const mockApiPaginated = vi.fn((data: unknown, meta: unknown) => ({
  json: async () => ({ success: true, data, meta }),
  status: 200,
}));

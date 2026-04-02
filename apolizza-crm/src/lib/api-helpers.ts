import { NextResponse } from "next/server";
import { MES_OPTIONS, STATUS_OPTIONS } from "@/lib/constants";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data, error: null }, { status });
}

export function apiError(error: string, status = 400) {
  return NextResponse.json({ data: null, error }, { status });
}

export function apiPaginated<T>(
  data: T[],
  pagination: { page: number; limit: number; total: number }
) {
  return NextResponse.json({
    data,
    error: null,
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
    },
  });
}

// --- Param validation helpers ---

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateMes(value: string | null): value is string {
  return value === null || (MES_OPTIONS as readonly string[]).includes(value);
}

export function validateAno(value: string | null): boolean {
  if (value === null) return true;
  const n = Number(value);
  return Number.isInteger(n) && n >= 2020 && n <= 2030;
}

export function validateStatus(value: string | null): boolean {
  return value === null || (STATUS_OPTIONS as readonly string[]).includes(value);
}

export function validateUuid(value: string | null): boolean {
  return value === null || UUID_RE.test(value);
}

export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100

export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaultLimit = DEFAULT_LIMIT,
) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get('limit') || String(defaultLimit), 10)),
  )
  return { page, limit, skip: (page - 1) * limit }
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit)
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

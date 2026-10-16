export interface PageRequest {
  page?: number;
  pageSize?: number;
}

export const DEFAULT_PAGE_SIZE = 10;

/** Opt-in pagination: any page or pageSize value switches a list endpoint to the paginated envelope. */
export const isPageRequested = (request: PageRequest): boolean => request.page !== undefined || request.pageSize !== undefined;

export const resolvePage = (request: PageRequest) => {
  const page = request.page ?? 1;
  const pageSize = request.pageSize ?? DEFAULT_PAGE_SIZE;
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
};

export const pageEnvelope = <T>(items: T[], total: number, page: number, pageSize: number) => ({
  items,
  total,
  page,
  pageSize,
  totalPages: Math.ceil(total / pageSize),
});

/** Slices an already filtered and ordered array into the shared paginated envelope. */
export const paginateArray = <T>(rows: T[], request: PageRequest) => {
  const { page, pageSize, skip, take } = resolvePage(request);
  return pageEnvelope(rows.slice(skip, skip + take), rows.length, page, pageSize);
};

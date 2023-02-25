export interface PaginationInterface {
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  pagingCounter: number;
}

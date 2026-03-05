"use client";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";

interface PaginatedListProps<T> {
  items: T[];
  perPage: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  children: (paginatedItems: T[]) => React.ReactNode;
}

export function PaginatedList<T>({
  items,
  perPage,
  currentPage,
  onPageChange,
  children,
}: PaginatedListProps<T>) {
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedItems = items.slice(
    (safePage - 1) * perPage,
    safePage * perPage,
  );

  return (
    <>
      {children(paginatedItems)}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(Math.max(1, safePage - 1))}
                aria-disabled={safePage <= 1}
                className={
                  safePage <= 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(
              (page) => {
                if (
                  page === 1 ||
                  page === totalPages ||
                  Math.abs(page - safePage) <= 1
                ) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        isActive={page === safePage}
                        onClick={() => onPageChange(page)}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                }
                if (page === 2 && safePage > 3) {
                  return (
                    <PaginationItem key="ellipsis-start">
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }
                if (page === totalPages - 1 && safePage < totalPages - 2) {
                  return (
                    <PaginationItem key="ellipsis-end">
                      <PaginationEllipsis />
                    </PaginationItem>
                  );
                }
                return null;
              },
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() =>
                  onPageChange(Math.min(totalPages, safePage + 1))
                }
                aria-disabled={safePage >= totalPages}
                className={
                  safePage >= totalPages
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </>
  );
}

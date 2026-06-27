import { useMemo, useState } from 'react';

import type { ColumnDef, ColumnFiltersState, SortingState } from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Bond } from '@/features/bonds';
import { useGetBondsQuery } from '@/features/bonds';

const EMPTY_BONDS: Bond[] = [];
const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6'];
const ALL_TYPES = 'all';
const ALL_RATINGS = 'all';
const NO_RATING = 'none';

// Порядок рейтингов от высшего к низшему (для сортировки опций фильтра).
const RATING_ORDER = [
  'AAA',
  'AA+',
  'AA',
  'AA-',
  'A+',
  'A',
  'A-',
  'BBB+',
  'BBB',
  'BBB-',
  'BB+',
  'BB',
  'BB-',
  'B+',
  'B',
  'B-',
];

const numberFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });
const formatNumber = (value: number | null): string => (value === null ? '—' : numberFormatter.format(value));

const percentChangeFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

const DayChangeCell = ({ value }: { value: number | null }) => {
  if (value === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  const colorClass = value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-muted-foreground';
  return <span className={colorClass}>{`${percentChangeFormatter.format(value)} %`}</span>;
};

// Расшифровка типов облигаций для подписей в фильтре.
const TYPE_DESCRIPTIONS: Record<string, string> = {
  'ОФЗ-ПД': 'фиксированный купон',
  'ОФЗ-ПК': 'переменный купон',
  'ОФЗ-ИН': 'индексируемый номинал',
  'ОФЗ-АД': 'амортизация долга',
  'ОФЗ-н': 'народные',
  ОФЗ: 'гособлигации',
  Корпоративная: 'облигации компаний',
  Биржевая: 'биржевые облигации компаний',
  Субфедеральная: 'облигации регионов',
  Муниципальная: 'облигации городов',
};

const formatTypeLabel = (type: string): string => {
  const description = TYPE_DESCRIPTIONS[type];
  return description ? `${type} (${description})` : type;
};

const COLUMNS: ColumnDef<Bond>[] = [
  { accessorKey: 'shortName', header: 'Название' },
  { accessorKey: 'type', header: 'Тип', filterFn: 'equalsString' },
  {
    accessorKey: 'creditRating',
    header: 'Рейтинг',
    filterFn: (row, columnId, filterValue) => {
      const value = row.getValue<string | null>(columnId);
      return filterValue === NO_RATING ? value === null : value === filterValue;
    },
    cell: ({ getValue }) => getValue<string | null>() ?? <span className="text-muted-foreground">—</span>,
  },
  { accessorKey: 'isin', header: 'ISIN' },
  {
    accessorKey: 'faceValue',
    header: 'Номинал',
    cell: ({ getValue }) => formatNumber(getValue<number | null>()),
  },
  {
    accessorKey: 'priceRub',
    header: 'Цена, ₽',
    cell: ({ getValue }) => formatNumber(getValue<number | null>()),
  },
  {
    accessorKey: 'dayChangePercent',
    header: 'Изм. за день',
    cell: ({ getValue }) => <DayChangeCell value={getValue<number | null>()} />,
  },
  {
    accessorKey: 'couponPercent',
    header: 'Купон, %',
    cell: ({ getValue }) => formatNumber(getValue<number | null>()),
  },
  {
    accessorKey: 'couponValue',
    header: 'Купон, ₽',
    cell: ({ getValue }) => formatNumber(getValue<number | null>()),
  },
  { accessorKey: 'matDate', header: 'Погашение' },
  {
    accessorKey: 'yearsToMaturity',
    header: 'Лет до погашения',
    cell: ({ getValue }) => formatNumber(getValue<number | null>()),
  },
  { accessorKey: 'currency', header: 'Валюта' },
];

export const Bonds = () => {
  const { data: bonds, isLoading, isError, isFetching, refetch } = useGetBondsQuery();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const typeOptions = useMemo(
    () =>
      [...new Set((bonds ?? EMPTY_BONDS).map((bond) => bond.type))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'ru')),
    [bonds],
  );

  const ratingOptions = useMemo(() => {
    const present = new Set((bonds ?? EMPTY_BONDS).map((bond) => bond.creditRating));
    return RATING_ORDER.filter((rating) => present.has(rating));
  }, [bonds]);

  const hasUnrated = useMemo(() => (bonds ?? EMPTY_BONDS).some((bond) => bond.creditRating === null), [bonds]);

  const table = useReactTable({
    data: bonds ?? EMPTY_BONDS,
    columns: COLUMNS,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const typeColumn = table.getColumn('type');
  const selectedType = (typeColumn?.getFilterValue() as string | undefined) ?? ALL_TYPES;

  const handleTypeChange = (value: string) => {
    typeColumn?.setFilterValue(value === ALL_TYPES ? undefined : value);
  };

  const ratingColumn = table.getColumn('creditRating');
  const selectedRating = (ratingColumn?.getFilterValue() as string | undefined) ?? ALL_RATINGS;

  const handleRatingChange = (value: string) => {
    ratingColumn?.setFilterValue(value === ALL_RATINGS ? undefined : value);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Облигации</h1>
        <Button
          variant="outline"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          Обновить
        </Button>
      </div>

      {isError && <p className="text-destructive">Не удалось загрузить облигации с MOEX.</p>}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {SKELETON_KEYS.map((key) => (
            <Skeleton
              key={key}
              className="h-9 w-full"
            />
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Тип:</span>
              <Select
                value={selectedType}
                onValueChange={handleTypeChange}
              >
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Все типы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES}>Все типы</SelectItem>
                  {typeOptions.map((type) => (
                    <SelectItem
                      key={type}
                      value={type}
                    >
                      {formatTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Рейтинг:</span>
              <Select
                value={selectedRating}
                onValueChange={handleRatingChange}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Все рейтинги" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_RATINGS}>Все рейтинги</SelectItem>
                  {ratingOptions.map((rating) => (
                    <SelectItem
                      key={rating}
                      value={rating}
                    >
                      {rating}
                    </SelectItem>
                  ))}
                  {hasUnrated && <SelectItem value={NO_RATING}>Без рейтинга</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const sorted = header.column.getIsSorted();

                      return (
                        <TableHead key={header.id}>
                          <button
                            type="button"
                            className="flex items-center gap-1 font-medium"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <span className="text-muted-foreground">
                              {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : ''}
                            </span>
                          </button>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={COLUMNS.length}
                      className="text-center text-muted-foreground"
                    >
                      Ничего не найдено
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Стр. {table.getState().pagination.pageIndex + 1} из {table.getPageCount() || 1} · всего{' '}
              {table.getFilteredRowModel().rows.length}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                Назад
              </Button>
              <Button
                variant="outline"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                Вперёд
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
};

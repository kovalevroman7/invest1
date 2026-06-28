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
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Bond } from '@/features/bonds';
import { useGetBondsQuery } from '@/features/bonds';
import { cn } from '@/lib/utils';

const EMPTY_BONDS: Bond[] = [];
const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
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

// Колонки с числами (выравнивание вправо, моноширинные цифры) и по центру.
const RIGHT_ALIGNED = new Set([
  'faceValue',
  'priceRub',
  'accruedInt',
  'dayChangePercent',
  'simpleYield',
  'couponPercent',
  'couponValue',
  'couponsPerYear',
  'yearsToMaturity',
]);
const CENTER_ALIGNED = new Set(['type', 'creditRating', 'currency']);

const alignClass = (columnId: string): string =>
  RIGHT_ALIGNED.has(columnId) ? 'text-right' : CENTER_ALIGNED.has(columnId) ? 'text-center' : 'text-left';

const headerJustifyClass = (columnId: string): string =>
  RIGHT_ALIGNED.has(columnId) ? 'justify-end' : CENTER_ALIGNED.has(columnId) ? 'justify-center' : 'justify-start';

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
  if (value === 0) {
    return <span className="text-muted-foreground">0 %</span>;
  }

  const isPositive = value > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center justify-end gap-1', isPositive ? 'text-green-600' : 'text-red-600')}>
      <Icon className="size-3.5" />
      {`${percentChangeFormatter.format(value)} %`}
    </span>
  );
};

const getRatingClassName = (rating: string): string => {
  if (rating.startsWith('AAA')) {
    return 'border-transparent bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400';
  }
  if (rating.startsWith('AA')) {
    return 'border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400';
  }
  if (rating.startsWith('A')) {
    return 'border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400';
  }
  return 'border-transparent bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400';
};

const RatingCell = ({ value }: { value: string | null }) => {
  if (value === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <Badge className={getRatingClassName(value)}>{value}</Badge>;
};

const SortIcon = ({ sorted }: { sorted: false | 'asc' | 'desc' }) => {
  if (sorted === 'asc') {
    return <ArrowUp className="size-3.5" />;
  }
  if (sorted === 'desc') {
    return <ArrowDown className="size-3.5" />;
  }
  return <ChevronsUpDown className="size-3.5 opacity-40" />;
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
  {
    accessorKey: 'shortName',
    header: 'Название',
    cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
  },
  {
    accessorKey: 'type',
    header: 'Тип',
    filterFn: 'equalsString',
    cell: ({ getValue }) => (
      <Badge
        variant="secondary"
        className="font-normal"
      >
        {getValue<string>()}
      </Badge>
    ),
  },
  {
    accessorKey: 'creditRating',
    header: 'Рейтинг',
    filterFn: (row, columnId, filterValue) => {
      const value = row.getValue<string | null>(columnId);
      return filterValue === NO_RATING ? value === null : value === filterValue;
    },
    cell: ({ getValue }) => <RatingCell value={getValue<string | null>()} />,
  },
  {
    accessorKey: 'isin',
    header: 'ISIN',
    cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue<string>()}</span>,
  },
  {
    accessorKey: 'faceValue',
    header: 'Номинал',
    cell: ({ getValue }) => formatNumber(getValue<number | null>()),
  },
  {
    accessorKey: 'priceRub',
    header: 'Цена, ₽',
    cell: ({ getValue }) => <span className="font-medium">{formatNumber(getValue<number | null>())}</span>,
  },
  {
    accessorKey: 'accruedInt',
    header: 'НКД, ₽',
    cell: ({ getValue }) => formatNumber(getValue<number | null>()),
  },
  {
    accessorKey: 'dayChangePercent',
    header: 'Изм. за день',
    cell: ({ getValue }) => <DayChangeCell value={getValue<number | null>()} />,
  },
  {
    accessorKey: 'simpleYield',
    header: 'Доходность, %',
    cell: ({ getValue }) => <span className="font-medium">{formatNumber(getValue<number | null>())}</span>,
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
  {
    accessorKey: 'couponsPerYear',
    header: 'Купонов в год',
    cell: ({ getValue }) => formatNumber(getValue<number | null>()),
  },
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

  const { pageIndex, pageSize } = table.getState().pagination;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const rangeFrom = filteredCount === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeTo = Math.min((pageIndex + 1) * pageSize, filteredCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Облигации</CardTitle>
        <CardDescription>Данные Московской биржи (MOEX ISS)</CardDescription>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => void refetch()}
          >
            <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
            Обновить
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {isError && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Не удалось загрузить облигации с MOEX.
          </p>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {SKELETON_KEYS.map((key) => (
              <Skeleton
                key={key}
                className="h-10 w-full"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
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

              <Badge
                variant="secondary"
                className="ml-auto font-normal"
              >
                Найдено: {filteredCount}
              </Badge>
            </div>

            <div className="max-h-[65vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className={cn('sticky top-0 z-10 bg-muted', alignClass(header.column.id))}
                        >
                          <button
                            type="button"
                            className={cn(
                              'inline-flex w-full items-center gap-1 font-medium transition-colors hover:text-foreground',
                              headerJustifyClass(header.column.id),
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            <SortIcon sorted={header.column.getIsSorted()} />
                          </button>
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={COLUMNS.length}
                        className="h-24 text-center text-muted-foreground"
                      >
                        Ничего не найдено
                      </TableCell>
                    </TableRow>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={cn(
                              alignClass(cell.column.id),
                              RIGHT_ALIGNED.has(cell.column.id) && 'tabular-nums',
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {rangeFrom}–{rangeTo} из {filteredCount} · стр. {pageIndex + 1} из {table.getPageCount() || 1}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.firstPage()}
                  aria-label="Первая страница"
                >
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                  aria-label="Предыдущая страница"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                  aria-label="Следующая страница"
                >
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.lastPage()}
                  aria-label="Последняя страница"
                >
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

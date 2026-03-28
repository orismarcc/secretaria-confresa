import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataTableProps<T> {
  data: T[];
  columns: {
    key: string;
    header: string;
    render?: (item: T) => ReactNode;
    className?: string;
  }[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  title?: string;
  description?: string;
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  isLoading = false,
  emptyMessage = 'Nenhum registro encontrado',
  title,
  description,
}: DataTableProps<T>) {
  const tableContent = isLoading ? (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ) : data.length === 0 ? (
    <div className="text-center py-12 text-muted-foreground text-sm">
      {emptyMessage}
    </div>
  ) : (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((col) => (
            <TableHead key={col.key} className={col.className}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow
            key={keyExtractor(item)}
            onClick={() => onRowClick?.(item)}
            className={cn(onRowClick && 'cursor-pointer')}
          >
            {columns.map((col) => (
              <TableCell key={col.key} className={col.className}>
                {col.render
                  ? col.render(item)
                  : String((item as Record<string, unknown>)[col.key] ?? '')}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (title) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent className="p-0">{tableContent}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">{tableContent}</CardContent>
    </Card>
  );
}

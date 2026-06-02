import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TradeRecordResultsRow } from "@/components/trade-record-results-row";
import type { TradeRecordSearchResponse } from "@/trade/trade-record-search";

export function TradeRecordResultsTable({
  hasCursor,
  params,
  result,
}: {
  hasCursor: boolean;
  params: Record<string, string | string[] | undefined>;
  result: TradeRecordSearchResponse;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{result.pagination.total} registros</CardTitle>
        <CardDescription>
          Mostrando {result.data.length}
          {hasCursor
            ? " desde el cursor actual."
            : ` desde posición ${result.pagination.offset}.`}
          {" "}La columna de fuente muestra trazabilidad segura sin rutas locales,
          claves privadas ni URLs de bucket.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table className="min-w-[1320px]">
          <TableHeader>
            <TableRow>
              <TableHead>Operación</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Correlativo Aduana</TableHead>
              <TableHead>Valor item</TableHead>
              <TableHead>Cantidad / peso</TableHead>
              <TableHead>País</TableHead>
              <TableHead>Logística</TableHead>
              <TableHead>Fuente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No encontramos registros con estos filtros. Prueba ampliar el rango
                  de fechas o usar una partida HS más general.
                </TableCell>
              </TableRow>
            ) : (
              result.data.map((record) => (
                <TradeRecordResultsRow key={record.id} params={params} record={record} />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

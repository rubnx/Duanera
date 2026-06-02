import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNullableIntegerEsCl } from "@/lib/format";
import {
  sourceTradeFlowLabel,
  type SourceFlowCoverage,
} from "@/sources/source-provenance";

const formatNumber = formatNullableIntegerEsCl;

function periodLabelForCoverage(coverage: SourceFlowCoverage) {
  return `${coverage.periodYear}-${String(coverage.periodMonth).padStart(2, "0")}`;
}

export function FlowCoverageTable({ rows }: { rows: SourceFlowCoverage[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Flujo</TableHead>
            <TableHead>Período</TableHead>
            <TableHead className="text-right">Filas crudas</TableHead>
            <TableHead className="text-right">Registros</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                No hay cobertura de filas comerciales para esta fuente.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((coverage) => (
              <TableRow
                key={`${coverage.tradeFlow}:${coverage.periodYear}:${coverage.periodMonth}`}
              >
                <TableCell>{sourceTradeFlowLabel(coverage.tradeFlow)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {periodLabelForCoverage(coverage)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatNumber(coverage.rawRowCount)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatNumber(coverage.tradeRecordCount)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

import {
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import type { Lot } from "../api/client";
import { formatQuantity } from "../catalogue";

type Props = {
  lots: Lot[];
  currency?: string;
  showBroker?: boolean;
  emptyMessage?: string;
};

export function CatalogueLotsTable({
  lots,
  currency = "",
  showBroker = false,
  emptyMessage = "No catalogue lots in this view.",
}: Props) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return lots;
    return lots.filter((lot) => {
      const haystack = [
        String(lot.broker),
        String(lot.lotNumber),
        lot.factoryCode,
        lot.gardenMark,
        lot.invoiceNumber,
        lot.grade,
        lot.packageType,
        lot.sellingMark,
        lot.warehouseOrBasis,
        lot.category,
        lot.sourceLine,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [lots, query]);

  const pageRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <TextField
          size="small"
          label="Search lots"
          placeholder="Factory, garden, invoice, grade, mark…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          sx={{ maxWidth: 420, width: "100%" }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ alignSelf: { sm: "center" } }}>
          Showing {filtered.length.toLocaleString("en-GB")} of {lots.length.toLocaleString("en-GB")} lots
        </Typography>
      </Stack>

      {filtered.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">{emptyMessage}</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {showBroker ? <TableCell>Broker</TableCell> : null}
                <TableCell>Lot</TableCell>
                <TableCell>Factory</TableCell>
                <TableCell>Garden</TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell>Grade</TableCell>
                <TableCell align="right">Bags</TableCell>
                <TableCell>Pkg</TableCell>
                <TableCell align="right">Net / bag</TableCell>
                <TableCell align="right">Net kg</TableCell>
                <TableCell>Selling mark</TableCell>
                <TableCell>Warehouse / basis</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Valuation / kg {currency ? `(${currency})` : ""}</TableCell>
                <TableCell>Source line</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((lot) => (
                <TableRow key={lot.id} hover>
                  {showBroker ? <TableCell>{String(lot.broker)}</TableCell> : null}
                  <TableCell>{lot.lotNumber}</TableCell>
                  <TableCell>{blank(lot.factoryCode)}</TableCell>
                  <TableCell>{lot.gardenMark}</TableCell>
                  <TableCell>{lot.invoiceNumber}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={lot.grade} />
                  </TableCell>
                  <TableCell align="right">{lot.bags}</TableCell>
                  <TableCell>{blank(lot.packageType)}</TableCell>
                  <TableCell align="right">{formatQuantity(lot.netPerBagKg, 3)}</TableCell>
                  <TableCell align="right">{formatQuantity(lot.netWeightKg, 3)}</TableCell>
                  <TableCell>{blank(lot.sellingMark)}</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>{blank(lot.warehouseOrBasis)}</TableCell>
                  <TableCell>{blank(lot.category)}</TableCell>
                  <TableCell align="right">{formatQuantity(lot.valuationPerKg, 2)}</TableCell>
                  <TableCell
                    sx={{
                      maxWidth: 280,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: "0.75rem",
                    }}
                    title={lot.sourceLine || undefined}
                  >
                    {blank(lot.sourceLine)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, next) => setPage(next)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setPage(0);
            }}
            rowsPerPageOptions={[25, 50, 100, 250]}
          />
        </Paper>
      )}
    </Stack>
  );
}

function blank(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "—";
}

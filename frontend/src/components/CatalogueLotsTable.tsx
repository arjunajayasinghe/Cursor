import {
  Chip,
  IconButton,
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
import ClearIcon from "@mui/icons-material/Clear";
import { useMemo, useState } from "react";
import type { Lot } from "../api/client";
import { formatQuantity } from "../catalogue";

type Props = {
  lots: Lot[];
  currency?: string;
  showBroker?: boolean;
  emptyMessage?: string;
  showSalesResults?: boolean;
};

type ColumnKey =
  | "broker"
  | "lotNumber"
  | "factoryCode"
  | "gardenMark"
  | "invoiceNumber"
  | "grade"
  | "bags"
  | "packageType"
  | "netPerBagKg"
  | "netWeightKg"
  | "sellingMark"
  | "warehouseOrBasis"
  | "category"
  | "valuationPerKg"
  | "soldPricePerKg"
  | "buyerCode"
  | "sourceLine";

type ColumnFilters = Partial<Record<ColumnKey, string>>;

const emptyFilters: ColumnFilters = {};

export function CatalogueLotsTable({
  lots,
  currency = "",
  showBroker = false,
  emptyMessage = "No catalogue lots in this view.",
  showSalesResults = false,
}: Props) {
  const [filters, setFilters] = useState<ColumnFilters>(emptyFilters);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const activeFilterCount = Object.values(filters).filter((value) => value?.trim()).length;

  const filtered = useMemo(() => {
    return lots.filter((lot) =>
      (Object.entries(filters) as [ColumnKey, string | undefined][]).every(([key, raw]) => {
        const needle = raw?.trim().toLowerCase();
        if (!needle) return true;
        return cellText(lot, key).toLowerCase().includes(needle);
      }),
    );
  }, [lots, filters]);

  const pageRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  function setFilter(key: ColumnKey, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(0);
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setPage(0);
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Typography variant="body2" color="text.secondary">
          Search under each column header. Showing {filtered.length.toLocaleString("en-GB")} of{" "}
          {lots.length.toLocaleString("en-GB")} lots
          {activeFilterCount ? ` · ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} on` : ""}.
        </Typography>
        <IconButton aria-label="Clear column filters" onClick={clearFilters} disabled={activeFilterCount === 0} size="small">
          <ClearIcon fontSize="small" />
        </IconButton>
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
                {showSalesResults ? (
                  <>
                    <TableCell align="right">Sold / kg {currency ? `(${currency})` : ""}</TableCell>
                    <TableCell>Buyer</TableCell>
                  </>
                ) : null}
                <TableCell>Source line</TableCell>
              </TableRow>
              <TableRow>
                {showBroker ? <HeaderFilter value={filters.broker} onChange={(value) => setFilter("broker", value)} /> : null}
                <HeaderFilter value={filters.lotNumber} onChange={(value) => setFilter("lotNumber", value)} />
                <HeaderFilter value={filters.factoryCode} onChange={(value) => setFilter("factoryCode", value)} />
                <HeaderFilter value={filters.gardenMark} onChange={(value) => setFilter("gardenMark", value)} />
                <HeaderFilter value={filters.invoiceNumber} onChange={(value) => setFilter("invoiceNumber", value)} />
                <HeaderFilter value={filters.grade} onChange={(value) => setFilter("grade", value)} />
                <HeaderFilter value={filters.bags} onChange={(value) => setFilter("bags", value)} align="right" />
                <HeaderFilter value={filters.packageType} onChange={(value) => setFilter("packageType", value)} />
                <HeaderFilter value={filters.netPerBagKg} onChange={(value) => setFilter("netPerBagKg", value)} align="right" />
                <HeaderFilter value={filters.netWeightKg} onChange={(value) => setFilter("netWeightKg", value)} align="right" />
                <HeaderFilter value={filters.sellingMark} onChange={(value) => setFilter("sellingMark", value)} />
                <HeaderFilter value={filters.warehouseOrBasis} onChange={(value) => setFilter("warehouseOrBasis", value)} />
                <HeaderFilter value={filters.category} onChange={(value) => setFilter("category", value)} />
                <HeaderFilter value={filters.valuationPerKg} onChange={(value) => setFilter("valuationPerKg", value)} align="right" />
                {showSalesResults ? (
                  <>
                    <HeaderFilter value={filters.soldPricePerKg} onChange={(value) => setFilter("soldPricePerKg", value)} align="right" />
                    <HeaderFilter value={filters.buyerCode} onChange={(value) => setFilter("buyerCode", value)} />
                  </>
                ) : null}
                <HeaderFilter value={filters.sourceLine} onChange={(value) => setFilter("sourceLine", value)} />
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
                  {showSalesResults ? (
                    <>
                      <TableCell align="right">{formatQuantity(lot.soldPricePerKg, 2)}</TableCell>
                      <TableCell>{blank(lot.buyerCode)}</TableCell>
                    </>
                  ) : null}
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

function HeaderFilter({
  value,
  onChange,
  align,
}: {
  value?: string;
  onChange: (value: string) => void;
  align?: "right";
}) {
  return (
    <TableCell sx={{ top: 37, py: 0.75, bgcolor: "background.paper" }}>
      <TextField
        size="small"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search"
        fullWidth
        slotProps={{
          htmlInput: {
            "aria-label": "Column filter",
            style: align === "right" ? { textAlign: "right" } : undefined,
          },
        }}
      />
    </TableCell>
  );
}

function cellText(lot: Lot, key: ColumnKey) {
  const value = lot[key as keyof Lot];
  if (value === null || value === undefined) return "";
  return String(value);
}

function blank(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "—";
}

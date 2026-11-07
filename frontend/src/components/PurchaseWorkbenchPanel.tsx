import ClearIcon from "@mui/icons-material/Clear";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  getPurchasedInvoiceWorkbench,
  getSale,
  listSales,
  openPurchasedInvoicePdf,
  type PurchasedInvoiceSummary,
} from "../api/client";
import { brokerName } from "../catalogue";
import {
  type ComparedLot,
  type CompareMark,
  compareMarkStyle,
  comparePurchaseToSales,
  summarizeCompare,
} from "../lib/purchaseCompare";

function formatMoney(value: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatKg(value: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Props = {
  saleNumber: string;
  year: number;
};

type SearchState = {
  lotNumber: string;
  mark: string;
  grade: string;
  invoiceNumber: string;
  buyer: string;
};

const emptySearch: SearchState = {
  lotNumber: "",
  mark: "",
  grade: "",
  invoiceNumber: "",
  buyer: "",
};

type DiffFilter = "ALL" | CompareMark | "ISSUES";

function saleNumbersMatch(left: string, right: string) {
  if (left === right) return true;
  return intSafe(left) !== null && intSafe(left) === intSafe(right);
}

function intSafe(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function PurchaseWorkbenchPanel({ saleNumber, year }: Props) {
  const [brokerTab, setBrokerTab] = useState<string>("ALL");
  const [diffFilter, setDiffFilter] = useState<DiffFilter>("ALL");
  const [search, setSearch] = useState<SearchState>(emptySearch);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const deferred = useDeferredValue(search);

  const workbench = useQuery({
    queryKey: ["purchased-invoice-workbench", saleNumber, year],
    queryFn: () => getPurchasedInvoiceWorkbench(saleNumber.trim() || undefined, year || undefined),
    enabled: Boolean(saleNumber.trim() && year),
  });

  const salesIndex = useQuery({ queryKey: ["sales"], queryFn: listSales });

  const compareSaleId = useMemo(() => {
    const boardId = workbench.data?.saleId;
    const rows = salesIndex.data ?? [];
    const numericMatches = rows.filter(
      (sale) => Number(sale.year) === Number(year) && saleNumbersMatch(String(sale.saleNumber), saleNumber),
    );
    // Prefer the sale book that already has after-sales rows for this auction number.
    const withLots = [...numericMatches].sort((a, b) => Number(b.lotCount) - Number(a.lotCount));
    return withLots[0]?.id || boardId || "";
  }, [workbench.data?.saleId, salesIndex.data, saleNumber, year]);

  const saleBook = useQuery({
    queryKey: ["sale", compareSaleId],
    queryFn: () => getSale(compareSaleId),
    enabled: Boolean(compareSaleId),
  });

  const board = workbench.data;

  const compared = useMemo(() => {
    if (!board) return [] as ComparedLot[];
    return comparePurchaseToSales(board.lots, saleBook.data?.lots ?? [], board.invoices);
  }, [board, saleBook.data?.lots]);

  const overall = useMemo(() => summarizeCompare(compared), [compared]);

  const perBroker = useMemo(() => {
    const map = new Map<string, ReturnType<typeof summarizeCompare>>();
    for (const invoice of board?.invoices ?? []) {
      const rows = compared.filter((row) => row.broker === String(invoice.broker));
      map.set(String(invoice.broker), summarizeCompare(rows));
    }
    return map;
  }, [board?.invoices, compared]);

  const filtered = useMemo(() => {
    return compared.filter((row) => {
      if (brokerTab !== "ALL" && row.broker !== brokerTab) return false;
      if (diffFilter === "ISSUES" && row.mark === "match") return false;
      if (diffFilter !== "ALL" && diffFilter !== "ISSUES" && row.mark !== diffFilter) return false;
      if (deferred.lotNumber && !String(row.lotNumber).includes(deferred.lotNumber.trim())) return false;
      if (deferred.mark && !row.sellingMark.toLowerCase().includes(deferred.mark.trim().toLowerCase())) return false;
      if (deferred.grade && !row.grade.toLowerCase().includes(deferred.grade.trim().toLowerCase())) return false;
      if (
        deferred.invoiceNumber &&
        !row.invoiceNumber.toLowerCase().includes(deferred.invoiceNumber.trim().toLowerCase())
      ) {
        return false;
      }
      if (deferred.buyer && !row.salesBuyer.toLowerCase().includes(deferred.buyer.trim().toLowerCase())) return false;
      return true;
    });
  }, [compared, brokerTab, diffFilter, deferred]);

  const pageRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const activeFilters =
    Object.values(search).filter((value) => value.trim()).length +
    (brokerTab === "ALL" ? 0 : 1) +
    (diffFilter === "ALL" ? 0 : 1);

  function updateSearch(key: keyof SearchState, value: string) {
    setSearch((current) => ({ ...current, [key]: value }));
    setPage(0);
  }

  function clearSearch() {
    setSearch(emptySearch);
    setBrokerTab("ALL");
    setDiffFilter("ALL");
    setPage(0);
  }

  if (workbench.isPending) return <CircularProgress aria-label="Loading purchase workbench" />;
  if (workbench.isError) {
    return (
      <Alert severity="error" action={<Button onClick={() => workbench.refetch()}>Retry</Button>}>
        {workbench.error.message}
      </Alert>
    );
  }
  if (!board) {
    return (
      <Alert severity="info">
        No broker purchase invoices for sale {saleNumber}/{year} yet.{" "}
        <Button component={RouterLink} to="/upload-invoices" size="small">
          Upload PDFs
        </Button>
      </Alert>
    );
  }

  const salesReady = (saleBook.data?.lots?.length ?? 0) > 0;

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <div>
          <Typography color="text.secondary">
            Quick check: broker PDF invoice vs after-sales file for this buyer. Same lot number is paired; price,
            kg, bags, invoice #, grade and mark from the invoice are checked.
          </Typography>
        </div>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <Chip size="small" color="success" label={`Match ${overall.match}`} />
          <Chip size="small" color="warning" label={`Differs ${overall.priceDiff}`} />
          <Chip size="small" color="info" label={`PDF only ${overall.pdfOnly}`} />
          <Chip size="small" color="error" label={`Sales only ${overall.salesOnly}`} />
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 1.5, bgcolor: "rgba(26, 95, 122, 0.04)" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ flexWrap: "wrap" }}>
          <LegendItem color="#1f4d3a" title="Match" text="Lot is on both PDF and sales, and invoice values agree." />
          <LegendItem
            color="#b47814"
            title="Differs"
            text="Same lot on both sides, but price / kg / bags / invoice # / grade / mark disagree."
          />
          <LegendItem color="#1a5f7a" title="PDF only" text="On the broker invoice PDF, missing from the sales file." />
          <LegendItem
            color="#8c3f2a"
            title="Sales only"
            text="On the sales file for this buyer, missing from the PDF invoice."
          />
        </Stack>
      </Paper>

      {!salesReady && !saleBook.isPending ? (
        <Alert severity="warning">
          No after-sales lots loaded for sale {saleNumber}/{year} yet. Upload sales files to run the PDF ↔ sales
          comparison. PDF lots still show below.
        </Alert>
      ) : null}

      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" },
        }}
      >
        {board.invoices.map((invoice) => (
          <BrokerCompareCard
            key={invoice.id}
            invoice={invoice}
            summary={perBroker.get(String(invoice.broker)) ?? summarizeCompare([])}
            selected={brokerTab === String(invoice.broker)}
            onSelect={() => {
              setBrokerTab(String(invoice.broker));
              setPage(0);
            }}
            onOpenPdf={() => void openPurchasedInvoicePdf(invoice.id)}
          />
        ))}
      </Box>

      <Paper sx={{ px: 1, bgcolor: "rgba(26, 95, 122, 0.04)" }}>
        <Tabs
          value={brokerTab}
          onChange={(_, value: string) => {
            setBrokerTab(value);
            setPage(0);
          }}
          variant="scrollable"
          allowScrollButtonsMobile
          slotProps={{ indicator: { sx: { backgroundColor: "#1a5f7a", height: 3 } } }}
        >
          <Tab value="ALL" label={`All (${compared.length})`} />
          {board.invoices.map((invoice) => {
            const summary = perBroker.get(String(invoice.broker));
            const issues = summary?.issues ?? 0;
            return (
              <Tab
                key={invoice.broker}
                value={String(invoice.broker)}
                label={`${invoice.broker} (${summary?.total ?? 0}${issues ? ` · ${issues}Δ` : ""})`}
              />
            );
          })}
        </Tabs>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <ToggleButtonGroup
            exclusive
            size="small"
            color="primary"
            value={diffFilter}
            onChange={(_, value: DiffFilter | null) => {
              if (!value) return;
              setDiffFilter(value);
              setPage(0);
            }}
            aria-label="Comparison filter"
            sx={{ flexWrap: "wrap" }}
          >
            <ToggleButton value="ALL">All marks</ToggleButton>
            <ToggleButton value="ISSUES">Issues only</ToggleButton>
            <ToggleButton value="match">Match</ToggleButton>
            <ToggleButton value="priceDiff">Differs</ToggleButton>
            <ToggleButton value="pdfOnly">PDF only</ToggleButton>
            <ToggleButton value="salesOnly">Sales only</ToggleButton>
          </ToggleButtonGroup>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ flexWrap: "wrap", gap: 1.5 }}>
            <TextField
              size="small"
              label="Lot number"
              value={search.lotNumber}
              onChange={(event) => updateSearch("lotNumber", event.target.value)}
              sx={{ minWidth: 130 }}
            />
            <TextField
              size="small"
              label="Mark"
              value={search.mark}
              onChange={(event) => updateSearch("mark", event.target.value)}
              sx={{ minWidth: 140 }}
            />
            <TextField
              size="small"
              label="Grade"
              value={search.grade}
              onChange={(event) => updateSearch("grade", event.target.value)}
              sx={{ minWidth: 120 }}
            />
            <TextField
              size="small"
              label="Invoice number"
              value={search.invoiceNumber}
              onChange={(event) => updateSearch("invoiceNumber", event.target.value)}
              sx={{ minWidth: 140 }}
            />
            <TextField
              size="small"
              label="Buyer"
              value={search.buyer}
              onChange={(event) => updateSearch("buyer", event.target.value)}
              sx={{ minWidth: 120 }}
            />
            <IconButton aria-label="Clear search" onClick={clearSearch} disabled={activeFilters === 0}>
              <ClearIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <SummaryTile label="Shown" value={filtered.length.toLocaleString("en-GB")} />
        <SummaryTile label="Matched" value={filtered.filter((row) => row.mark === "match").length.toLocaleString("en-GB")} />
        <SummaryTile
          label="Issues"
          value={filtered.filter((row) => row.mark !== "match").length.toLocaleString("en-GB")}
        />
        <SummaryTile
          label="Sales book"
          value={
            saleBook.isPending
              ? "…"
              : salesReady
                ? `${Number(saleBook.data?.lots.length ?? 0).toLocaleString("en-GB")} lots`
                : "None"
          }
        />
      </Stack>

      <Paper sx={{ overflow: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Mark</TableCell>
              <TableCell>Broker</TableCell>
              <TableCell align="right">Lot</TableCell>
              <TableCell>Selling mark</TableCell>
              <TableCell>Grade</TableCell>
              <TableCell align="right">Bags</TableCell>
              <TableCell align="right">Net kg</TableCell>
              <TableCell align="right">PDF / kg</TableCell>
              <TableCell align="right">Sales / kg</TableCell>
              <TableCell align="right">Proceeds</TableCell>
              <TableCell>Invoice #</TableCell>
              <TableCell>Note</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((row) => {
              const style = compareMarkStyle[row.mark];
              return (
                <TableRow
                  key={row.key}
                  hover
                  sx={{
                    bgcolor: style.rowBg,
                    borderLeft: `4px solid ${style.bar}`,
                  }}
                >
                  <TableCell>
                    <Chip size="small" color={style.chip} label={style.label} />
                  </TableCell>
                  <TableCell>{row.broker}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600 }}>
                    {row.lotNumber}
                  </TableCell>
                  <TableCell>{row.sellingMark || "—"}</TableCell>
                  <TableCell>{row.grade || "—"}</TableCell>
                  <TableCell align="right">{row.bags ?? "—"}</TableCell>
                  <TableCell align="right">{formatKg(row.netWeightKg)}</TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: row.mark === "priceDiff" ? 700 : 500, color: row.mark === "priceDiff" ? "#8a5a00" : "inherit" }}
                  >
                    {formatMoney(row.pdfPrice)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: row.mark === "priceDiff" ? 700 : 500, color: row.mark === "priceDiff" ? "#8a5a00" : "inherit" }}
                  >
                    {formatMoney(row.salesPrice)}
                  </TableCell>
                  <TableCell align="right">{formatMoney(row.proceeds)}</TableCell>
                  <TableCell>{row.invoiceNumber || "—"}</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>{row.notes}</TableCell>
                </TableRow>
              );
            })}
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12}>
                  <Typography color="text.secondary">No lots for the current filters.</Typography>
                </TableCell>
              </TableRow>
            ) : null}
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
    </Stack>
  );
}

function BrokerCompareCard({
  invoice,
  summary,
  selected,
  onSelect,
  onOpenPdf,
}: {
  invoice: PurchasedInvoiceSummary;
  summary: ReturnType<typeof summarizeCompare>;
  selected: boolean;
  onSelect: () => void;
  onOpenPdf: () => void;
}) {
  const matchedPct = summary.total === 0 ? 0 : Math.round((summary.match / summary.total) * 100);
  return (
    <Paper
      variant="outlined"
      onClick={onSelect}
      sx={{
        p: 2,
        cursor: "pointer",
        borderWidth: 2,
        borderColor: selected ? "#1a5f7a" : summary.issues > 0 ? "rgba(180, 120, 20, 0.55)" : "divider",
        bgcolor: selected ? "rgba(26, 95, 122, 0.08)" : "background.paper",
        transition: "border-color 120ms ease, background-color 120ms ease",
      }}
    >
      <Stack spacing={1}>
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2 }}>
          {invoice.broker} · {brokerName(invoice.broker)}
        </Typography>
        <Typography variant="subtitle2" sx={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
          {invoice.buyerName || invoice.buyerCode || "Buyer"}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-all" }}>
          {invoice.contractNo || invoice.originalFileName}
        </Typography>

        <Box sx={{ pt: 0.5 }}>
          <Stack direction="row" sx={{ justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="caption">{matchedPct}% matched</Typography>
            <Typography variant="caption" color={summary.issues ? "warning.main" : "success.main"}>
              {summary.issues ? `${summary.issues} issue${summary.issues === 1 ? "" : "s"}` : "Clean"}
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={matchedPct}
            sx={{
              height: 8,
              borderRadius: 1,
              bgcolor: "rgba(140, 63, 42, 0.15)",
              "& .MuiLinearProgress-bar": { bgcolor: summary.issues ? "#b47814" : "#1f4d3a" },
            }}
          />
        </Box>

        <Typography variant="caption" color="text.secondary">
          Invoice {invoice.lotCount} lots · {formatKg(invoice.netWeightKg)} kg · proceeds {formatMoney(invoice.proceeds)}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
          <Chip size="small" variant="outlined" label={`PDF ${invoice.lotCount}`} />
          <Chip
            size="small"
            variant="outlined"
            label={`Sales ${summary.match + summary.priceDiff + summary.salesOnly}`}
          />
          <Chip size="small" color="success" variant="outlined" label={`✓ ${summary.match}`} />
          {summary.priceDiff ? <Chip size="small" color="warning" label={`Δ ${summary.priceDiff}`} /> : null}
          {summary.pdfOnly ? <Chip size="small" color="info" label={`PDF+ ${summary.pdfOnly}`} /> : null}
          {summary.salesOnly ? <Chip size="small" color="error" label={`Sales+ ${summary.salesOnly}`} /> : null}
        </Stack>

        <Button
          size="small"
          variant="outlined"
          onClick={(event) => {
            event.stopPropagation();
            onOpenPdf();
          }}
        >
          View PDF
        </Button>
      </Stack>
    </Paper>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <Paper sx={{ p: 1.5, flex: 1 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
        {value}
      </Typography>
    </Paper>
  );
}

function LegendItem({ color, title, text }: { color: string; title: string; text: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ flex: 1, minWidth: 220, alignItems: "flex-start" }}>
      <Box sx={{ width: 10, height: 10, borderRadius: 1, bgcolor: color, mt: 0.7, flexShrink: 0 }} />
      <div>
        <Typography variant="subtitle2" sx={{ lineHeight: 1.2 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {text}
        </Typography>
      </div>
    </Stack>
  );
}

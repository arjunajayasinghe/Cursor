import {
  Chip,
  IconButton,
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
  TableSortLabel,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ClearIcon from "@mui/icons-material/Clear";
import { useDeferredValue, useMemo, useState } from "react";
import type { Lot } from "../api/client";
import { brokers, formatQuantity } from "../catalogue";
import { knownSalesBuyerNames, splitSalesBuyer } from "../lib/purchaseCompare";

const salesBuyerNameLookup = new Map(Object.entries(knownSalesBuyerNames));

export type ExplorerMode = "preAuction" | "afterSales";

type SortKey =
  | "broker"
  | "lotNumber"
  | "gardenMark"
  | "invoiceNumber"
  | "grade"
  | "sellingMark"
  | "bags"
  | "netWeightKg"
  | "valuationPerKg"
  | "soldPricePerKg"
  | "buyerCode";

type BrokerFilter = "ALL" | (typeof brokers)[number]["code"];
type ResultFilter = "ALL" | "SOLD" | "UNSOLD";

type SearchState = {
  lotNumber: string;
  estate: string;
  grade: string;
  invoiceNumber: string;
  mark: string;
  buyer: string;
};

const emptySearch: SearchState = {
  lotNumber: "",
  estate: "",
  grade: "",
  invoiceNumber: "",
  mark: "",
  buyer: "",
};

type Props = {
  lots: Lot[];
  mode: ExplorerMode;
  currency?: string;
  emptyMessage?: string;
};

function isSold(lot: Lot) {
  return (
    (lot.soldPricePerKg != null && Number(lot.soldPricePerKg) > 0) ||
    Boolean(lot.buyerCode && String(lot.buyerCode).trim())
  );
}

function compareLots(a: Lot, b: Lot, key: SortKey, direction: "asc" | "desc") {
  const left = a[key];
  const right = b[key];
  const leftNum = typeof left === "number" ? left : Number(left);
  const rightNum = typeof right === "number" ? right : Number(right);
  let result = 0;
  if (!Number.isNaN(leftNum) && !Number.isNaN(rightNum) && String(left).trim() !== "" && String(right).trim() !== "") {
    result = leftNum - rightNum;
  } else {
    result = String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true, sensitivity: "base" });
  }
  return direction === "asc" ? result : -result;
}

export function ExplorerLotsGrid({
  lots,
  mode,
  currency = "",
  emptyMessage = "No records match the current filters.",
}: Props) {
  const [brokerFilter, setBrokerFilter] = useState<BrokerFilter>("ALL");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("SOLD");
  const [search, setSearch] = useState<SearchState>(emptySearch);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [sortKey, setSortKey] = useState<SortKey>("lotNumber");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const deferred = useDeferredValue(search);

  const soldCountAll = useMemo(() => lots.filter(isSold).length, [lots]);
  const unsoldCountAll = lots.length - soldCountAll;

  const baseLots = useMemo(() => {
    if (mode !== "afterSales") return lots;
    if (resultFilter === "SOLD") return lots.filter(isSold);
    if (resultFilter === "UNSOLD") return lots.filter((lot) => !isSold(lot));
    return lots;
  }, [lots, mode, resultFilter]);

  const brokerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lot of baseLots) {
      const code = String(lot.broker);
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return counts;
  }, [baseLots]);

  const filtered = useMemo(() => {
    return baseLots.filter((lot) => {
      if (brokerFilter !== "ALL" && String(lot.broker) !== brokerFilter) return false;
      if (deferred.lotNumber && !String(lot.lotNumber).includes(deferred.lotNumber.trim())) return false;
      if (deferred.estate && !(lot.gardenMark || "").toLowerCase().includes(deferred.estate.trim().toLowerCase())) return false;
      if (deferred.grade && !(lot.grade || "").toLowerCase().includes(deferred.grade.trim().toLowerCase())) return false;
      if (
        deferred.invoiceNumber &&
        !(lot.invoiceNumber || "").toLowerCase().includes(deferred.invoiceNumber.trim().toLowerCase())
      ) {
        return false;
      }
      if (deferred.mark && !(lot.sellingMark || "").toLowerCase().includes(deferred.mark.trim().toLowerCase())) return false;
      if (deferred.buyer && !(lot.buyerCode || "").toLowerCase().includes(deferred.buyer.trim().toLowerCase())) return false;
      return true;
    });
  }, [baseLots, brokerFilter, deferred]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => compareLots(a, b, sortKey, sortDir));
    return copy;
  }, [filtered, sortKey, sortDir]);

  const pageRows = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const summary = useMemo(() => {
    const bags = filtered.reduce((sum, lot) => sum + Number(lot.bags || 0), 0);
    const kg = filtered.reduce((sum, lot) => sum + Number(lot.netWeightKg || 0), 0);
    const sold = filtered.filter(isSold).length;
    const unsold = filtered.length - sold;
    return { bags, kg, sold, unsold };
  }, [filtered]);

  const activeFilters =
    Object.values(search).filter((value) => value.trim()).length +
    (brokerFilter === "ALL" ? 0 : 1) +
    (mode === "afterSales" && resultFilter !== "SOLD" ? 1 : 0);

  function updateSearch(key: keyof SearchState, value: string) {
    setSearch((current) => ({ ...current, [key]: value }));
    setPage(0);
  }

  function clearSearch() {
    setBrokerFilter("ALL");
    setResultFilter("SOLD");
    setSearch(emptySearch);
    setPage(0);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortHeader({ id, label, align }: { id: SortKey; label: string; align?: "right" }) {
    return (
      <TableCell align={align} sortDirection={sortKey === id ? sortDir : false}>
        <TableSortLabel active={sortKey === id} direction={sortKey === id ? sortDir : "asc"} onClick={() => toggleSort(id)}>
          {label}
        </TableSortLabel>
      </TableCell>
    );
  }

  return (
    <Stack spacing={2}>
      {mode === "afterSales" ? (
        <Paper sx={{ p: 2 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
          >
            <div>
              <Typography variant="subtitle2" sx={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
                Sale result
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Switch between sold and unsold lots. Broker tabs and search filters stay active.
              </Typography>
            </div>
            <ToggleButtonGroup
              exclusive
              size="small"
              color="primary"
              value={resultFilter}
              onChange={(_, value: ResultFilter | null) => {
                if (!value) return;
                setResultFilter(value);
                setPage(0);
              }}
              aria-label="Sold or unsold filter"
            >
              <ToggleButton value="ALL">All ({lots.length.toLocaleString("en-GB")})</ToggleButton>
              <ToggleButton value="SOLD">Sold ({soldCountAll.toLocaleString("en-GB")})</ToggleButton>
              <ToggleButton value="UNSOLD">Unsold ({unsoldCountAll.toLocaleString("en-GB")})</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Paper>
      ) : null}

      <Paper sx={{ px: 1 }}>
        <Tabs
          value={brokerFilter}
          onChange={(_, value: BrokerFilter) => {
            setBrokerFilter(value);
            setPage(0);
          }}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Broker filter"
        >
          <Tab value="ALL" label={`All (${baseLots.length.toLocaleString("en-GB")})`} />
          {brokers.map((broker) => {
            const count = brokerCounts.get(broker.code) ?? 0;
            return (
              <Tab
                key={broker.code}
                value={broker.code}
                disabled={count === 0}
                label={`${broker.code} (${count.toLocaleString("en-GB")})`}
              />
            );
          })}
        </Tabs>
      </Paper>

      <Paper sx={{ p: 2 }}>
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
            label="Estate"
            value={search.estate}
            onChange={(event) => updateSearch("estate", event.target.value)}
            sx={{ minWidth: 150 }}
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
            label="Mark"
            value={search.mark}
            onChange={(event) => updateSearch("mark", event.target.value)}
            sx={{ minWidth: 120 }}
          />
          {mode === "afterSales" ? (
            <TextField
              size="small"
              label="Buyer"
              value={search.buyer}
              onChange={(event) => updateSearch("buyer", event.target.value)}
              sx={{ minWidth: 120 }}
            />
          ) : null}
          <IconButton aria-label="Clear search" onClick={clearSearch} disabled={activeFilters === 0}>
            <ClearIcon />
          </IconButton>
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Summary label="Records" value={filtered.length.toLocaleString("en-GB")} />
        <Summary label="Bags" value={summary.bags.toLocaleString("en-GB")} />
        <Summary label="Net kg" value={formatQuantity(summary.kg, 1)} />
        {mode === "afterSales" ? (
          <>
            <Summary label="Sold lots" value={summary.sold.toLocaleString("en-GB")} />
            <Summary label="Unsold lots" value={summary.unsold.toLocaleString("en-GB")} />
          </>
        ) : (
          <Summary label="Of sale total" value={lots.length.toLocaleString("en-GB")} />
        )}
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Showing {filtered.length.toLocaleString("en-GB")} of {baseLots.length.toLocaleString("en-GB")}{" "}
        {mode === "afterSales"
          ? resultFilter === "UNSOLD"
            ? "unsold"
            : resultFilter === "SOLD"
              ? "sold"
              : "after-sales"
          : "pre-auction"}{" "}
        records
        {activeFilters ? ` · ${activeFilters} search filter${activeFilters === 1 ? "" : "s"} on` : ""}.
      </Typography>

      {sorted.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">{emptyMessage}</Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: "auto" }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <SortHeader id="broker" label="Broker" />
                <SortHeader id="lotNumber" label="Lot" />
                <TableCell>Factory</TableCell>
                <SortHeader id="gardenMark" label="Estate" />
                <SortHeader id="invoiceNumber" label="Invoice" />
                <SortHeader id="grade" label="Grade" />
                <SortHeader id="bags" label="Bags" align="right" />
                <TableCell>Pkg</TableCell>
                <TableCell align="right">Net / bag</TableCell>
                <SortHeader id="netWeightKg" label="Net kg" align="right" />
                <SortHeader id="sellingMark" label="Mark" />
                <TableCell>Warehouse / basis</TableCell>
                <TableCell>Category</TableCell>
                <SortHeader
                  id="valuationPerKg"
                  label={`Valuation / kg${currency ? ` (${currency})` : ""}`}
                  align="right"
                />
                {mode === "afterSales" ? (
                  <>
                    <SortHeader
                      id="soldPricePerKg"
                      label={`Sold / kg${currency ? ` (${currency})` : ""}`}
                      align="right"
                    />
                    <SortHeader id="buyerCode" label="Buyer code / name" />
                    <TableCell>Result</TableCell>
                  </>
                ) : null}
                <TableCell>Source line</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((lot) => {
                const sold = isSold(lot);
                const buyer = sold
                  ? splitSalesBuyer(String(lot.broker), lot.buyerCode, salesBuyerNameLookup)
                  : { buyerCode: "", buyerName: "" };
                return (
                <TableRow key={lot.id} hover selected={mode === "afterSales" && sold}>
                  <TableCell>{String(lot.broker)}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{lot.lotNumber}</TableCell>
                  <TableCell>{blank(lot.factoryCode)}</TableCell>
                  <TableCell>{blank(lot.gardenMark)}</TableCell>
                  <TableCell>{blank(lot.invoiceNumber)}</TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={lot.grade || "—"} />
                  </TableCell>
                  <TableCell align="right">{lot.bags || "—"}</TableCell>
                  <TableCell>{blank(lot.packageType)}</TableCell>
                  <TableCell align="right">{formatQuantity(lot.netPerBagKg, 3)}</TableCell>
                  <TableCell align="right">{formatQuantity(lot.netWeightKg, 3)}</TableCell>
                  <TableCell>{blank(lot.sellingMark)}</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>{blank(lot.warehouseOrBasis)}</TableCell>
                  <TableCell>{blank(lot.category)}</TableCell>
                  <TableCell align="right">{formatQuantity(lot.valuationPerKg, 2)}</TableCell>
                  {mode === "afterSales" ? (
                    <>
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {sold ? formatQuantity(lot.soldPricePerKg, 2) : "—"}
                      </TableCell>
                      <TableCell sx={{ minWidth: 140 }}>
                        {!sold || (!buyer.buyerCode && !buyer.buyerName) ? (
                          "—"
                        ) : (
                          <Stack spacing={0.25}>
                            {buyer.buyerCode ? (
                              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                {buyer.buyerCode}
                              </Typography>
                            ) : null}
                            {buyer.buyerName ? (
                              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                                {buyer.buyerName}
                              </Typography>
                            ) : null}
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={sold ? "success" : "default"} label={sold ? "Sold" : "Unsold"} />
                      </TableCell>
                    </>
                  ) : null}
                  <TableCell
                    sx={{
                      maxWidth: 260,
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
                );
              })}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={sorted.length}
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

function Summary({ label, value }: { label: string; value: string }) {
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

function blank(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : "—";
}

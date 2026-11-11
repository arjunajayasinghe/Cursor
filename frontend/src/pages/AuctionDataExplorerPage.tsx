import {
  Alert,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { getSale, listPurchasedInvoices, listSales, type SaleSummary } from "../api/client";
import { ExplorerLotsGrid, type ExplorerMode } from "../components/ExplorerLotsGrid";
import { PurchaseWorkbenchPanel } from "../components/PurchaseWorkbenchPanel";
import { currencyFor, formatSaleDate } from "../catalogue";

type ExplorerTab = ExplorerMode | "purchases";

const tabColors = {
  preAuction: {
    main: "#1f4d3a",
    soft: "rgba(31, 77, 58, 0.12)",
    label: "#1f4d3a",
  },
  afterSales: {
    main: "#8c3f2a",
    soft: "rgba(140, 63, 42, 0.12)",
    label: "#8c3f2a",
  },
  purchases: {
    main: "#1a5f7a",
    soft: "rgba(26, 95, 122, 0.12)",
    label: "#1a5f7a",
  },
} as const;

function pickDefaultSale(sales: SaleSummary[]) {
  if (sales.length === 0) return "";
  return [...sales].sort((a, b) => Number(b.lotCount) - Number(a.lotCount) || b.saleDate.localeCompare(a.saleDate))[0]
    .id;
}

function readTab(value: string | null): ExplorerTab {
  if (value === "afterSales" || value === "purchases") return value;
  return "preAuction";
}

export function AuctionDataExplorerPage() {
  const [params, setParams] = useSearchParams();
  const tab = readTab(params.get("tab"));
  const saleIdParam = params.get("saleId") ?? "";
  const activeColor = tabColors[tab];

  const sales = useQuery({ queryKey: ["sales"], queryFn: listSales });
  const invoiceIndex = useQuery({ queryKey: ["purchased-invoices"], queryFn: listPurchasedInvoices });
  const orderedSales = useMemo(() => {
    const byKey = new Map<string, SaleSummary>();
    for (const row of sales.data ?? []) {
      byKey.set(`${row.year}|${row.saleNumber}`, row);
    }
    // Keep invoice-only sales visible in the explorer sale list (e.g. 04 with PDFs but no catalogue yet).
    for (const invoice of invoiceIndex.data ?? []) {
      const key = `${invoice.year}|${invoice.saleNumber}`;
      if (byKey.has(key) || !invoice.saleId) continue;
      byKey.set(key, {
        id: invoice.saleId,
        saleNumber: invoice.saleNumber,
        year: invoice.year,
        centre: invoice.centre,
        saleDate: invoice.saleDate,
        status: "Open",
        lotCount: 0,
        createdAt: invoice.createdAt,
      } as SaleSummary);
    }
    return [...byKey.values()].sort(
      (a, b) => Number(b.lotCount) - Number(a.lotCount) || b.saleDate.localeCompare(a.saleDate),
    );
  }, [sales.data, invoiceIndex.data]);

  const selectedSaleId = saleIdParam || (sales.data ? pickDefaultSale(sales.data) : "");

  // Keep the chosen sale in the URL so refresh and share links stay on the full book.
  useEffect(() => {
    if (!selectedSaleId || saleIdParam === selectedSaleId) return;
    const next = new URLSearchParams(params);
    next.set("saleId", selectedSaleId);
    setParams(next, { replace: true });
  }, [selectedSaleId, saleIdParam, params, setParams]);

  const sale = useQuery({
    queryKey: ["sale", selectedSaleId],
    queryFn: () => getSale(selectedSaleId),
    enabled: selectedSaleId.length > 0 && tab !== "purchases",
  });

  function setTab(next: ExplorerTab) {
    const nextParams = new URLSearchParams(params);
    if (next === "preAuction") nextParams.delete("tab");
    else nextParams.set("tab", next);
    setParams(nextParams, { replace: true });
  }

  function setSale(nextId: string) {
    const nextParams = new URLSearchParams(params);
    nextParams.set("saleId", nextId);
    setParams(nextParams, { replace: true });
  }

  const selectedSummary = orderedSales.find((item) => item.id === selectedSaleId);

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}
      >
        <div>
          <Typography variant="h4">Auction Data Explorer</Typography>
          <Typography color="text.secondary">
            Choose a sale, then switch Pre-Auction, After-Sales, or Purchase Workbench. Broker invoices stay in the
            top menu as well for the separate process.
          </Typography>
        </div>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" component={RouterLink} to="/catalogues">
            Upload status
          </Button>
          <Button variant="contained" component={RouterLink} to="/upload">
            Upload catalogues
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
          <FormControl size="small" sx={{ minWidth: 320 }}>
            <InputLabel id="explorer-sale-label">Sale</InputLabel>
            <Select
              labelId="explorer-sale-label"
              label="Sale"
              value={selectedSaleId}
              onChange={(event) => setSale(String(event.target.value))}
              disabled={!orderedSales.length}
            >
              {orderedSales.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.saleNumber}/{item.year} · {item.centre} · {formatSaleDate(item.saleDate)} ·{" "}
                  {Number(item.lotCount).toLocaleString("en-GB")} lots
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedSummary ? (
            <Typography variant="body2" color="text.secondary">
              Showing sale {selectedSummary.saleNumber}/{selectedSummary.year} —{" "}
              {Number(selectedSummary.lotCount).toLocaleString("en-GB")} lots.
            </Typography>
          ) : null}
        </Stack>
      </Paper>

      {selectedSummary && Number(selectedSummary.lotCount) < 50 && tab !== "purchases" ? (
        <Alert severity="warning">
          This sale only has {Number(selectedSummary.lotCount).toLocaleString("en-GB")} lots. Pick a larger sale
          from the Sale list (for example 03/2026) to see all brokers with counts.
        </Alert>
      ) : null}

      {sales.isPending ? <CircularProgress aria-label="Loading sales" /> : null}
      {sales.isError ? (
        <Alert severity="error" action={<Button onClick={() => sales.refetch()}>Retry</Button>}>
          {sales.error.message}
        </Alert>
      ) : null}
      {sales.data && sales.data.length === 0 ? (
        <Alert severity="info">
          No sales yet. Upload pre-auction catalogues first, then open this explorer.
        </Alert>
      ) : null}

      {selectedSaleId || tab === "purchases" ? (
        <Paper
          sx={{
            borderTop: `4px solid ${activeColor.main}`,
            overflow: "hidden",
          }}
        >
          <Tabs
            value={tab}
            onChange={(_, value: ExplorerTab) => setTab(value)}
            variant="fullWidth"
            slotProps={{
              indicator: { sx: { height: 3, backgroundColor: activeColor.main } },
            }}
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              bgcolor: activeColor.soft,
              minHeight: 56,
              "& .MuiTab-root": {
                minHeight: 56,
                fontWeight: 600,
                letterSpacing: "0.02em",
                textTransform: "none",
                fontSize: "0.95rem",
                color: "text.secondary",
                opacity: 1,
              },
              "& .Mui-selected": {
                color: `${activeColor.label} !important`,
                bgcolor: "rgba(255,255,255,0.55)",
              },
            }}
          >
            <Tab
              value="preAuction"
              label="Pre-Auction Data"
              sx={{
                "&.Mui-selected": { color: `${tabColors.preAuction.label} !important` },
                borderTop: tab === "preAuction" ? `3px solid ${tabColors.preAuction.main}` : "3px solid transparent",
              }}
            />
            <Tab
              value="afterSales"
              label="After-Sales Data"
              sx={{
                "&.Mui-selected": { color: `${tabColors.afterSales.label} !important` },
                borderTop: tab === "afterSales" ? `3px solid ${tabColors.afterSales.main}` : "3px solid transparent",
              }}
            />
            <Tab
              value="purchases"
              label="Purchase Workbench"
              sx={{
                "&.Mui-selected": { color: `${tabColors.purchases.label} !important` },
                borderTop: tab === "purchases" ? `3px solid ${tabColors.purchases.main}` : "3px solid transparent",
              }}
            />
          </Tabs>

          <Stack sx={{ p: 2 }} spacing={2}>
            {tab === "purchases" ? (
              selectedSummary ? (
                <PurchaseWorkbenchPanel
                  key={`${selectedSummary.saleNumber}-${selectedSummary.year}`}
                  saleNumber={String(selectedSummary.saleNumber)}
                  year={Number(selectedSummary.year)}
                />
              ) : (
                <Alert severity="info">Choose a sale above to open its purchase workbench.</Alert>
              )
            ) : (
              <>
                {sale.isPending ? <CircularProgress aria-label="Loading sale lots" /> : null}
                {sale.isError ? (
                  <Alert severity="error" action={<Button onClick={() => sale.refetch()}>Retry</Button>}>
                    {sale.error.message}
                  </Alert>
                ) : null}
                {sale.data ? (
                  <>
                    <Typography color="text.secondary">
                      {tab === "preAuction"
                        ? "Pre-auction lot fields for this sale. Broker row: All first, then AS, BC… with lot counts."
                        : "After-sales: use Sold / Unsold / All, then the same broker row and search filters as pre-auction."}
                    </Typography>
                    <ExplorerLotsGrid
                      key={`${sale.data.id}-${tab}`}
                      lots={sale.data.lots}
                      mode={tab}
                      currency={currencyFor(String(sale.data.centre))}
                      emptyMessage={
                        tab === "afterSales"
                          ? "No after-sales results on this sale yet. Upload sales files, then return here."
                          : "No pre-auction lots on this sale."
                      }
                    />
                  </>
                ) : null}
              </>
            )}
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}

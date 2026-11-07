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
import { getSale, listSales, type SaleSummary } from "../api/client";
import { ExplorerLotsGrid, type ExplorerMode } from "../components/ExplorerLotsGrid";
import { currencyFor, formatSaleDate } from "../catalogue";

function pickDefaultSale(sales: SaleSummary[]) {
  if (sales.length === 0) return "";
  return [...sales].sort((a, b) => Number(b.lotCount) - Number(a.lotCount) || b.saleDate.localeCompare(a.saleDate))[0]
    .id;
}

export function AuctionDataExplorerPage() {
  const [params, setParams] = useSearchParams();
  const tab: ExplorerMode = params.get("tab") === "afterSales" ? "afterSales" : "preAuction";
  const saleIdParam = params.get("saleId") ?? "";

  const sales = useQuery({ queryKey: ["sales"], queryFn: listSales });
  const orderedSales = useMemo(() => {
    const rows = sales.data ?? [];
    return [...rows].sort(
      (a, b) => Number(b.lotCount) - Number(a.lotCount) || b.saleDate.localeCompare(a.saleDate),
    );
  }, [sales.data]);

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
    enabled: selectedSaleId.length > 0,
  });

  function setTab(next: ExplorerMode) {
    const nextParams = new URLSearchParams(params);
    if (next === "afterSales") nextParams.set("tab", "afterSales");
    else nextParams.delete("tab");
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
            Choose a sale, then use the horizontal broker row (All, AS, BC…) and search fields. Pre-auction and
            after-sales share the same layout.
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
              {Number(selectedSummary.lotCount).toLocaleString("en-GB")} lots. Use the broker tabs below the data
              tabs.
            </Typography>
          ) : null}
        </Stack>
      </Paper>

      {selectedSummary && Number(selectedSummary.lotCount) < 50 ? (
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

      {selectedSaleId ? (
        <Paper>
          <Tabs
            value={tab}
            onChange={(_, value: ExplorerMode) => setTab(value)}
            variant="fullWidth"
            sx={{ borderBottom: 1, borderColor: "divider" }}
          >
            <Tab value="preAuction" label="Pre-Auction Data" />
            <Tab value="afterSales" label="After-Sales Data" />
          </Tabs>

          <Stack sx={{ p: 2 }} spacing={2}>
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
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}

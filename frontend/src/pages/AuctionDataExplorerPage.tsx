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
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { getSale, listSales } from "../api/client";
import { ExplorerLotsGrid, type ExplorerMode } from "../components/ExplorerLotsGrid";
import { currencyFor, formatSaleDate } from "../catalogue";

export function AuctionDataExplorerPage() {
  const [params, setParams] = useSearchParams();
  const tab: ExplorerMode = params.get("tab") === "afterSales" ? "afterSales" : "preAuction";
  const saleId = params.get("saleId") ?? "";

  const sales = useQuery({ queryKey: ["sales"], queryFn: listSales });
  const selectedSaleId = saleId || sales.data?.[0]?.id || "";
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
            View, search, and filter pre-auction catalogues and after-sales results in one place. Uploads are unchanged.
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
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel id="explorer-sale-label">Sale</InputLabel>
            <Select
              labelId="explorer-sale-label"
              label="Sale"
              value={selectedSaleId}
              onChange={(event) => setSale(String(event.target.value))}
              disabled={!sales.data?.length}
            >
              {(sales.data ?? []).map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.saleNumber}/{item.year} · {item.centre} · {formatSaleDate(item.saleDate)} ·{" "}
                  {item.lotCount.toLocaleString("en-GB")} lots
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {sale.data ? (
            <Typography variant="body2" color="text.secondary">
              {sale.data.centre} · {formatSaleDate(sale.data.saleDate)} · status {sale.data.status}
            </Typography>
          ) : null}
        </Stack>
      </Paper>

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
                    ? "All uploaded pre-auction lot fields for this sale. Search by lot, broker, estate, grade, invoice, or mark."
                    : "After-sales rows with sold price and buyer applied from sales uploads. Same search layout as pre-auction."}
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

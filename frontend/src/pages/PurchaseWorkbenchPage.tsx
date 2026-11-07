import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { getPurchasedInvoiceWorkbench, listPurchasedInvoices } from "../api/client";
import { brokerName } from "../catalogue";

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatKg(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PurchaseWorkbenchPage() {
  const [params, setParams] = useSearchParams();
  const [saleNumber, setSaleNumber] = useState(params.get("saleNumber") ?? "04");
  const [year, setYear] = useState(Number(params.get("year") ?? "2026"));
  const [brokerTab, setBrokerTab] = useState<string>("ALL");

  const invoices = useQuery({
    queryKey: ["purchased-invoices"],
    queryFn: listPurchasedInvoices,
  });

  const saleOptions = useMemo(() => {
    const map = new Map<string, { saleNumber: string; year: number; saleDate: string }>();
    for (const row of invoices.data ?? []) {
      const key = `${row.year}|${row.saleNumber}`;
      if (!map.has(key)) {
        map.set(key, { saleNumber: row.saleNumber, year: row.year, saleDate: row.saleDate });
      }
    }
    return [...map.values()].sort((a, b) => b.year - a.year || Number(b.saleNumber) - Number(a.saleNumber));
  }, [invoices.data]);

  const workbench = useQuery({
    queryKey: ["purchased-invoice-workbench", saleNumber, year],
    queryFn: () => getPurchasedInvoiceWorkbench(saleNumber.trim() || undefined, year || undefined),
    enabled: Boolean(saleNumber.trim() && year),
  });

  const board = workbench.data;
  const filteredLots = useMemo(() => {
    const lots = board?.lots ?? [];
    if (brokerTab === "ALL") return lots;
    return lots.filter((lot) => lot.broker === brokerTab);
  }, [board?.lots, brokerTab]);

  const totals = useMemo(() => {
    const lots = filteredLots;
    return {
      lots: lots.length,
      kg: lots.reduce((sum, lot) => sum + lot.netWeightKg, 0),
      proceeds: lots.reduce((sum, lot) => sum + lot.proceeds, 0),
      vat: lots.reduce((sum, lot) => sum + lot.vatAmount, 0),
    };
  }, [filteredLots]);

  function applySale() {
    setParams({ saleNumber: saleNumber.trim(), year: String(year) });
    setBrokerTab("ALL");
    void workbench.refetch();
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <div>
          <Typography variant="h4">Purchase workbench</Typography>
          <Typography color="text.secondary">
            See purchased lots from every broker invoice together for one sale.
          </Typography>
        </div>
        <Button component={RouterLink} to="/upload-invoices" variant="outlined">
          Upload invoices
        </Button>
      </Stack>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
          <TextField
            label="Sale number"
            value={saleNumber}
            onChange={(event) => setSaleNumber(event.target.value)}
            sx={{ flex: 1 }}
          />
          <TextField
            label="Year"
            type="number"
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
            sx={{ width: { md: 140 } }}
          />
          {saleOptions.length > 0 ? (
            <TextField
              select
              label="Loaded sales"
              value={`${year}|${saleNumber}`}
              onChange={(event) => {
                const [y, n] = event.target.value.split("|");
                setYear(Number(y));
                setSaleNumber(n);
              }}
              sx={{ flex: 1 }}
            >
              {saleOptions.map((option) => (
                <MenuItem key={`${option.year}|${option.saleNumber}`} value={`${option.year}|${option.saleNumber}`}>
                  Sale {option.saleNumber}/{option.year} · {option.saleDate}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
          <Button variant="contained" onClick={applySale}>
            Show
          </Button>
        </Stack>
      </Paper>

      {workbench.isError ? <Alert severity="error">{workbench.error.message}</Alert> : null}
      {workbench.isFetched && !board ? (
        <Alert severity="info">
          No purchased invoices for sale {saleNumber}/{year} yet.{" "}
          <Button component={RouterLink} to="/upload-invoices" size="small">
            Upload PDFs
          </Button>
        </Alert>
      ) : null}

      {board ? (
        <>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" },
            }}
          >
            {board.invoices.map((invoice) => (
              <Paper key={invoice.id} variant="outlined" sx={{ p: 2.5 }}>
                <Typography variant="overline" color="text.secondary">
                  {invoice.broker} · {brokerName(invoice.broker)}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
                  {invoice.buyerName || invoice.buyerCode || "Buyer"}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {invoice.contractNo || invoice.originalFileName}
                </Typography>
                <Typography variant="body2">
                  {invoice.lotCount} lots · {formatKg(invoice.netWeightKg)} kg
                </Typography>
                <Typography variant="body2">Proceeds {formatMoney(invoice.proceeds)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  Payable {formatMoney(invoice.payable)}
                </Typography>
              </Paper>
            ))}
          </Box>

          <Paper sx={{ p: 2 }}>
            <Tabs
              value={brokerTab}
              onChange={(_, value: string) => setBrokerTab(value)}
              variant="scrollable"
              allowScrollButtonsMobile
            >
              <Tab label={`All (${board.lots.length})`} value="ALL" />
              {board.invoices.map((invoice) => (
                <Tab
                  key={invoice.broker}
                  label={`${invoice.broker} (${invoice.lotCount})`}
                  value={invoice.broker}
                />
              ))}
            </Tabs>

            <Stack direction="row" spacing={3} sx={{ px: 2, py: 1.5, flexWrap: "wrap" }}>
              <Typography variant="body2">{totals.lots} lots</Typography>
              <Typography variant="body2">{formatKg(totals.kg)} kg</Typography>
              <Typography variant="body2">Proceeds {formatMoney(totals.proceeds)}</Typography>
              <Typography variant="body2">VAT {formatMoney(totals.vat)}</Typography>
            </Stack>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Broker</TableCell>
                  <TableCell align="right">Lot</TableCell>
                  <TableCell>Mark</TableCell>
                  <TableCell>Grade</TableCell>
                  <TableCell align="right">Bags</TableCell>
                  <TableCell align="right">Net kg</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="right">Proceeds</TableCell>
                  <TableCell>Invoice #</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLots.map((lot) => (
                  <TableRow key={lot.id} hover>
                    <TableCell>{lot.broker}</TableCell>
                    <TableCell align="right">{lot.lotNumber}</TableCell>
                    <TableCell>{lot.sellingMark}</TableCell>
                    <TableCell>{lot.grade}</TableCell>
                    <TableCell align="right">{lot.bags}</TableCell>
                    <TableCell align="right">{formatKg(lot.netWeightKg)}</TableCell>
                    <TableCell align="right">{formatMoney(lot.soldPricePerKg)}</TableCell>
                    <TableCell align="right">{formatMoney(lot.proceeds)}</TableCell>
                    <TableCell>{lot.invoiceNumber}</TableCell>
                  </TableRow>
                ))}
                {filteredLots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography color="text.secondary">No lots for this filter.</Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </Paper>
        </>
      ) : null}
    </Stack>
  );
}

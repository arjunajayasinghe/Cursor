import { Button, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { listPurchasedInvoices } from "../api/client";
import { PurchaseWorkbenchPanel } from "../components/PurchaseWorkbenchPanel";

export function PurchaseWorkbenchPage() {
  const [params, setParams] = useSearchParams();
  const [saleNumber, setSaleNumber] = useState(params.get("saleNumber") ?? "04");
  const [year, setYear] = useState(Number(params.get("year") ?? "2026"));
  const [applied, setApplied] = useState({
    saleNumber: params.get("saleNumber") ?? "04",
    year: Number(params.get("year") ?? "2026"),
  });

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

  function applySale() {
    const next = { saleNumber: saleNumber.trim(), year };
    setApplied(next);
    setParams({ saleNumber: next.saleNumber, year: String(next.year) });
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <div>
          <Typography variant="h4">Purchase workbench</Typography>
          <Typography color="text.secondary">
            Broker purchase invoices for one sale, side by side. Also available as a tab in Auction Data Explorer.
          </Typography>
        </div>
        <Button component={RouterLink} to="/upload-invoices" variant="outlined">
          Upload broker invoices
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

      <PurchaseWorkbenchPanel key={`${applied.saleNumber}-${applied.year}`} saleNumber={applied.saleNumber} year={applied.year} />
    </Stack>
  );
}

import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import { getSale, type Lot, type UploadBatch } from "../api/client";
import { CatalogueLotsTable } from "../components/CatalogueLotsTable";
import { brokerName, brokers, currencyFor, formatQuantity, formatSaleDate } from "../catalogue";
import { StatusChip } from "./StatusChip";

type BrokerFilter = "ALL" | (typeof brokers)[number]["code"];
type ResultFilter = "ALL" | "SOLD" | "UNSOLD";

export function SaleDetailPage() {
  const { saleId = "" } = useParams();
  const [brokerFilter, setBrokerFilter] = useState<BrokerFilter>("ALL");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("ALL");
  const sale = useQuery({
    queryKey: ["sale", saleId],
    queryFn: () => getSale(saleId),
    enabled: saleId.length > 0,
  });

  const lotsByBroker = useMemo(() => {
    const map = new Map<string, Lot[]>();
    for (const lot of sale.data?.lots ?? []) {
      const code = String(lot.broker);
      const list = map.get(code) ?? [];
      list.push(lot);
      map.set(code, list);
    }
    return map;
  }, [sale.data?.lots]);

  if (sale.isPending) return <CircularProgress aria-label="Loading auction" />;
  if (sale.isError) {
    return (
      <Stack spacing={2}>
        <Button component={RouterLink} to="/" sx={{ alignSelf: "flex-start" }}>
          All catalogues
        </Button>
        <Alert severity="error">{sale.error.message}</Alert>
      </Stack>
    );
  }

  const detail = sale.data;
  const currency = currencyFor(String(detail.centre));
  const showSalesResults = detail.lots.some(
    (lot) => lot.soldPricePerKg != null || (lot.buyerCode && String(lot.buyerCode).trim().length > 0),
  );

  const brokerScoped =
    brokerFilter === "ALL" ? detail.lots : (lotsByBroker.get(brokerFilter) ?? []);

  const visibleLots = brokerScoped.filter((lot) => {
    if (resultFilter === "ALL") return true;
    const sold =
      (lot.soldPricePerKg != null && Number(lot.soldPricePerKg) > 0) ||
      Boolean(lot.buyerCode && String(lot.buyerCode).trim());
    return resultFilter === "SOLD" ? sold : !sold;
  });

  const totalBags = visibleLots.reduce((sum, lot) => sum + Number(lot.bags || 0), 0);
  const totalKg = visibleLots.reduce((sum, lot) => sum + Number(lot.netWeightKg || 0), 0);
  const soldCount = brokerScoped.filter(
    (lot) =>
      (lot.soldPricePerKg != null && Number(lot.soldPricePerKg) > 0) ||
      Boolean(lot.buyerCode && String(lot.buyerCode).trim()),
  ).length;
  const brokerCodesPresent = brokers.filter((broker) => (lotsByBroker.get(broker.code)?.length ?? 0) > 0);

  const catalogueUploads = detail.uploads.filter(
    (upload) => String(upload.kind) !== "PostAuctionSales",
  );
  const salesUploads = detail.uploads.filter((upload) => String(upload.kind) === "PostAuctionSales");

  return (
    <Stack spacing={3}>
      <Button component={RouterLink} to="/" sx={{ alignSelf: "flex-start" }}>
        All catalogues
      </Button>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <div>
          <Typography variant="overline" color="text.secondary">
            Auction view · {detail.centre}
          </Typography>
          <Typography variant="h4">
            Sale {detail.saleNumber}/{detail.year}
          </Typography>
          <Typography color="text.secondary">{formatSaleDate(detail.saleDate)}</Typography>
        </div>
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
          <Chip label={detail.status} color={detail.status === "Open" ? "success" : "default"} />
          <Button variant="outlined" component={RouterLink} to="/upload-sales">
            Upload sales
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="broker-filter-label">Broker</InputLabel>
            <Select
              labelId="broker-filter-label"
              label="Broker"
              value={brokerFilter}
              onChange={(event) => setBrokerFilter(event.target.value as BrokerFilter)}
            >
              <MenuItem value="ALL">All brokers ({detail.lots.length})</MenuItem>
              {brokers.map((broker) => {
                const count = lotsByBroker.get(broker.code)?.length ?? 0;
                return (
                  <MenuItem key={broker.code} value={broker.code} disabled={count === 0}>
                    {broker.code} · {broker.name} ({count})
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 180 }} disabled={!showSalesResults}>
            <InputLabel id="result-filter-label">Results</InputLabel>
            <Select
              labelId="result-filter-label"
              label="Results"
              value={resultFilter}
              onChange={(event) => setResultFilter(event.target.value as ResultFilter)}
            >
              <MenuItem value="ALL">All lots</MenuItem>
              <MenuItem value="SOLD">Sold only</MenuItem>
              <MenuItem value="UNSOLD">Unsold only</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {brokerFilter === "ALL"
              ? "Showing every broker on this sale."
              : `Showing ${brokerName(brokerFilter)} only.`}{" "}
            Use the search boxes under each column header to narrow further.
          </Typography>
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <SummaryCard label="Lots" value={visibleLots.length.toLocaleString("en-GB")} />
        <SummaryCard label="Bags" value={totalBags.toLocaleString("en-GB")} />
        <SummaryCard label="Net kg" value={formatQuantity(totalKg, 1)} />
        <SummaryCard
          label={showSalesResults ? "Sold lots" : "Brokers"}
          value={showSalesResults ? soldCount.toLocaleString("en-GB") : String(brokerCodesPresent.length)}
        />
      </Stack>

      <div>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          {showSalesResults ? "Auction results" : "Catalogue lots"}
          {brokerFilter !== "ALL" ? ` · ${brokerName(brokerFilter)}` : " · all brokers"}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {showSalesResults
            ? "Sold price and buyer from the post-auction sales files. Catalogue fields stay on each lot."
            : "Pre-auction offer book. Upload sales files to fill sold price and buyer."}
        </Typography>
        <CatalogueLotsTable
          lots={visibleLots}
          currency={currency}
          showBroker={brokerFilter === "ALL"}
          showSalesResults={showSalesResults}
          emptyMessage={
            resultFilter === "SOLD"
              ? "No sold lots for this broker filter."
              : resultFilter === "UNSOLD"
                ? "No unsold lots for this broker filter."
                : "No lots for this broker filter."
          }
        />
      </div>

      <UploadList
        title="Sales file uploads"
        empty="No post-auction sales files for this sale yet."
        uploads={salesUploads}
      />

      <UploadList
        title="Catalogue uploads"
        empty="No broker catalogues uploaded for this sale yet."
        uploads={catalogueUploads}
      />
    </Stack>
  );
}

function UploadList({
  title,
  empty,
  uploads,
}: {
  title: string;
  empty: string;
  uploads: UploadBatch[];
}) {
  return (
    <div>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {uploads.length === 0 ? (
        <Typography color="text.secondary">{empty}</Typography>
      ) : (
        <Paper sx={{ overflow: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Broker</TableCell>
                <TableCell>File</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Lots</TableCell>
                <TableCell>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uploads.map((upload) => (
                <TableRow key={upload.id} hover>
                  <TableCell>
                    <Button component={RouterLink} to={`/uploads/${upload.id}`}>
                      {String(upload.broker)} · {brokerName(String(upload.broker))}
                    </Button>
                  </TableCell>
                  <TableCell>{upload.originalFileName}</TableCell>
                  <TableCell>
                    <StatusChip status={String(upload.status)} />
                  </TableCell>
                  <TableCell align="right">{upload.lotCount}</TableCell>
                  <TableCell sx={{ maxWidth: 280, whiteSpace: "normal" }}>{upload.error ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Paper sx={{ p: 2, flex: 1 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
        {value}
      </Typography>
    </Paper>
  );
}

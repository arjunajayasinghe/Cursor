import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
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
import { getSale, type Lot } from "../api/client";
import { CatalogueLotsTable } from "../components/CatalogueLotsTable";
import { brokerName, brokers, currencyFor, formatQuantity, formatSaleDate } from "../catalogue";
import { StatusChip } from "./StatusChip";

type BrokerFilter = "ALL" | (typeof brokers)[number]["code"];

export function SaleDetailPage() {
  const { saleId = "" } = useParams();
  const [brokerFilter, setBrokerFilter] = useState<BrokerFilter>("ALL");
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

  if (sale.isPending) return <CircularProgress aria-label="Loading catalogue" />;
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
  const visibleLots =
    brokerFilter === "ALL" ? detail.lots : (lotsByBroker.get(brokerFilter) ?? []);
  const totalBags = visibleLots.reduce((sum, lot) => sum + Number(lot.bags || 0), 0);
  const totalKg = visibleLots.reduce((sum, lot) => sum + Number(lot.netWeightKg || 0), 0);
  const brokerCodesPresent = brokers.filter((broker) => (lotsByBroker.get(broker.code)?.length ?? 0) > 0);

  return (
    <Stack spacing={3}>
      <Button component={RouterLink} to="/" sx={{ alignSelf: "flex-start" }}>
        All catalogues
      </Button>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <div>
          <Typography variant="overline" color="text.secondary">
            Pre-auction catalogue · {detail.centre}
          </Typography>
          <Typography variant="h4">
            Sale {detail.saleNumber}/{detail.year}
          </Typography>
          <Typography color="text.secondary">{formatSaleDate(detail.saleDate)}</Typography>
        </div>
        <Chip label={detail.status} color={detail.status === "Open" ? "success" : "default"} />
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <SummaryCard label="Lots" value={visibleLots.length.toLocaleString("en-GB")} />
        <SummaryCard label="Bags" value={totalBags.toLocaleString("en-GB")} />
        <SummaryCard label="Net kg" value={formatQuantity(totalKg, 1)} />
        <SummaryCard label="Brokers" value={String(brokerCodesPresent.length)} />
      </Stack>

      <Paper sx={{ px: 1 }}>
        <Tabs
          value={brokerFilter}
          onChange={(_, value: BrokerFilter) => setBrokerFilter(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab value="ALL" label={`All (${detail.lots.length})`} />
          {brokers.map((broker) => {
            const count = lotsByBroker.get(broker.code)?.length ?? 0;
            return (
              <Tab
                key={broker.code}
                value={broker.code}
                disabled={count === 0}
                label={`${broker.code} (${count})`}
              />
            );
          })}
        </Tabs>
      </Paper>

      <div>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Catalogue lots
          {brokerFilter !== "ALL" ? ` · ${brokerName(brokerFilter)}` : ""}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          These are the pre-auction offer lines. After the auction, broker sales files will add sold results.
        </Typography>
        <CatalogueLotsTable lots={visibleLots} currency={currency} showBroker={brokerFilter === "ALL"} />
      </div>

      <div>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Pre-auction uploads
        </Typography>
        {detail.uploads.length === 0 ? (
          <Typography color="text.secondary">No broker catalogues uploaded for this sale yet.</Typography>
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
                {detail.uploads.map((upload) => (
                  <TableRow key={upload.id} hover>
                    <TableCell>
                      <Button component={RouterLink} to={`/uploads/${upload.id}`}>
                        {String(upload.broker)} · {brokerName(String(upload.broker))}
                      </Button>
                    </TableCell>
                    <TableCell>{upload.originalFileName}</TableCell>
                    <TableCell>
                      <StatusChip status={upload.status} />
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

      <Paper sx={{ p: 3, bgcolor: "rgba(31, 77, 58, 0.04)" }}>
        <Typography variant="subtitle1" sx={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
          Post-auction sales files
        </Typography>
        <Typography color="text.secondary">
          Once this auction is over, upload each broker’s sales result file by broker. That step will fill sold
          price and buyer against these catalogue lots. Upload for sales results is coming next.
        </Typography>
      </Paper>
    </Stack>
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

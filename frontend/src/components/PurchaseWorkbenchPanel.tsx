import {
  Alert,
  Box,
  Button,
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
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { getPurchasedInvoiceWorkbench, openPurchasedInvoicePdf } from "../api/client";
import { brokerName } from "../catalogue";

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatKg(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Props = {
  saleNumber: string;
  year: number;
};

export function PurchaseWorkbenchPanel({ saleNumber, year }: Props) {
  const [brokerTab, setBrokerTab] = useState<string>("ALL");

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

  return (
    <Stack spacing={2}>
      <Typography color="text.secondary">
        Broker purchase invoices for this sale. Open a PDF from a broker card, or filter lots below.
      </Typography>

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
              {invoice.broker} · {brokerName(invoice.broker)} invoice
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
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
              Payable {formatMoney(invoice.payable)}
            </Typography>
            <Button size="small" variant="outlined" onClick={() => void openPurchasedInvoicePdf(invoice.id)}>
              View PDF
            </Button>
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
            <Tab key={invoice.broker} label={`${invoice.broker} (${invoice.lotCount})`} value={invoice.broker} />
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
    </Stack>
  );
}

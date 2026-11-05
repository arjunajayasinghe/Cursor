import { Alert, Button, Chip, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import { getSale } from "../api/client";
import { currencyFor, formatQuantity, formatSaleDate } from "../catalogue";
import { StatusChip } from "./StatusChip";

export function SaleDetailPage() {
  const { saleId = "" } = useParams();
  const sale = useQuery({
    queryKey: ["sale", saleId],
    queryFn: () => getSale(saleId),
    enabled: saleId.length > 0,
  });

  if (sale.isPending) return <CircularProgress aria-label="Loading sale" />;
  if (sale.isError) {
    return (
      <Stack spacing={2}>
        <Button component={RouterLink} to="/" sx={{ alignSelf: "flex-start" }}>
          All sales
        </Button>
        <Alert severity="error">{sale.error.message}</Alert>
      </Stack>
    );
  }

  const detail = sale.data;
  const currency = currencyFor(String(detail.centre));

  return (
    <Stack spacing={3}>
      <Button component={RouterLink} to="/" sx={{ alignSelf: "flex-start" }}>
        All sales
      </Button>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <div>
          <Typography variant="overline" color="text.secondary">
            {detail.centre}
          </Typography>
          <Typography variant="h4">
            Sale {detail.saleNumber}/{detail.year}
          </Typography>
          <Typography color="text.secondary">{formatSaleDate(detail.saleDate)}</Typography>
        </div>
        <Chip label={detail.status} color={detail.status === "Open" ? "success" : "default"} />
      </Stack>

      <Paper sx={{ overflow: "auto" }}>
        <Table>
            <TableHead>
            <TableRow>
              <TableCell>Broker</TableCell>
              <TableCell>Lot</TableCell>
              <TableCell>Garden mark</TableCell>
              <TableCell>Invoice</TableCell>
              <TableCell>Grade</TableCell>
              <TableCell align="right">Bags</TableCell>
              <TableCell align="right">Net kg</TableCell>
              <TableCell align="right">Valuation / kg {currency ? `(${currency})` : ""}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detail.lots.map((lot) => (
              <TableRow key={lot.id} hover>
                <TableCell>{String(lot.broker)}</TableCell>
                <TableCell>{lot.lotNumber}</TableCell>
                <TableCell>{lot.gardenMark}</TableCell>
                <TableCell>{lot.invoiceNumber}</TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" label={lot.grade} />
                </TableCell>
                <TableCell align="right">{lot.bags}</TableCell>
                <TableCell align="right">{formatQuantity(lot.netWeightKg, 3)}</TableCell>
                <TableCell align="right">{formatQuantity(lot.valuationPerKg, 2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <div>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Uploads
        </Typography>
        {detail.uploads.length === 0 ? (
          <Typography color="text.secondary">This sale has no upload batch.</Typography>
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
                  <TableRow key={upload.id}>
                    <TableCell>{String(upload.broker)}</TableCell>
                    <TableCell>{upload.originalFileName}</TableCell>
                    <TableCell>
                      <StatusChip status={upload.status} />
                    </TableCell>
                    <TableCell align="right">{upload.lotCount}</TableCell>
                    <TableCell>{upload.error ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </div>
    </Stack>
  );
}

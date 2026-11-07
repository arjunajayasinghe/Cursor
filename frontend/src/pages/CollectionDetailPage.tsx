import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import { getCollectionBatch } from "../api/client";
import { formatSaleDate } from "../catalogue";

export function CollectionDetailPage() {
  const { batchId = "" } = useParams();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const batch = useQuery({
    queryKey: ["collection", batchId],
    queryFn: () => getCollectionBatch(batchId),
    enabled: Boolean(batchId),
  });

  if (batch.isPending) return <CircularProgress aria-label="Loading collection batch" />;
  if (batch.isError) {
    return (
      <Alert severity="error" action={<Button onClick={() => batch.refetch()}>Retry</Button>}>
        {batch.error.message}
      </Alert>
    );
  }
  if (!batch.data) {
    return <Alert severity="info">Collection batch not found.</Alert>;
  }

  const detail = batch.data;
  const rows = detail.lots;
  const pageRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <div>
          <Typography variant="overline" color="text.secondary">
            Collection stage
          </Typography>
          <Typography variant="h4">{detail.name}</Typography>
          <Typography color="text.secondary">
            Sale {detail.saleNumber}/{detail.year} · {formatSaleDate(detail.saleDate)} · {detail.centre}
          </Typography>
        </div>
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
          <Chip label={detail.status} />
          <Button component={RouterLink} to="/collections" size="small" variant="outlined">
            All batches
          </Button>
          <Button component={RouterLink} to="/purchases" size="small">
            Add more from invoices
          </Button>
        </Stack>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Summary label="Lots" value={String(detail.lotCount)} />
        <Summary label="Bags" value={String(detail.bagCount)} />
        <Summary
          label="Net kg"
          value={Number(detail.netWeightKg).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        />
      </Stack>

      <Alert severity="info">
        Snapshot from PDF invoice lots + WH from sales file (EXESTATE or named warehouse). Sample / bag tasks,
        barcodes, and blend sheets come next — no auth wired yet.
      </Alert>

      <Paper sx={{ overflow: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Broker</TableCell>
              <TableCell align="right">Lot</TableCell>
              <TableCell>Selling mark</TableCell>
              <TableCell>Seller</TableCell>
              <TableCell>Inv.No</TableCell>
              <TableCell>Grade</TableCell>
              <TableCell align="right">Bags</TableCell>
              <TableCell align="right">Net kg</TableCell>
              <TableCell align="right">Price</TableCell>
              <TableCell>WH</TableCell>
              <TableCell>Buyer</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((lot) => (
              <TableRow key={lot.id} hover>
                <TableCell>{lot.broker}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {lot.lotNumber}
                </TableCell>
                <TableCell>{lot.sellingMark || "—"}</TableCell>
                <TableCell sx={{ minWidth: 140 }}>{lot.sellerName || lot.gardenMark || "—"}</TableCell>
                <TableCell>{lot.invoiceNumber || "—"}</TableCell>
                <TableCell>{lot.grade || "—"}</TableCell>
                <TableCell align="right">{lot.bags || "—"}</TableCell>
                <TableCell align="right">
                  {Number(lot.netWeightKg).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell align="right">
                  {Number(lot.soldPricePerKg).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell sx={{ minWidth: 140, fontSize: "0.8rem" }}>{lot.warehouseOrBasis || "—"}</TableCell>
                <TableCell>
                  <Stack spacing={0.25}>
                    <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                      {lot.buyerCode || "—"}
                    </Typography>
                    {lot.buyerName ? (
                      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                        {lot.buyerName}
                      </Typography>
                    ) : null}
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={rows.length}
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

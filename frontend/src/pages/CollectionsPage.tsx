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
  TableRow,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { listCollectionBatches } from "../api/client";
import { formatSaleDate } from "../catalogue";

export function CollectionsPage() {
  const batches = useQuery({ queryKey: ["collections"], queryFn: listCollectionBatches });

  if (batches.isPending) return <CircularProgress aria-label="Loading collections" />;
  if (batches.isError) {
    return (
      <Alert severity="error" action={<Button onClick={() => batches.refetch()}>Retry</Button>}>
        {batches.error.message}
      </Alert>
    );
  }

  const rows = batches.data ?? [];

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Collection stage</Typography>
        <Typography color="text.secondary">
          Lots selected from broker invoice PDFs for sample collection, bag pickup, labels, and blend sheets.
          Start from Broker invoices → select lots → Send to collection.
        </Typography>
      </div>

      {rows.length === 0 ? (
        <Paper sx={{ p: 3 }}>
          <Typography color="text.secondary">
            No collection batches yet. Open{" "}
            <Button component={RouterLink} to="/purchases" size="small">
              Broker invoices
            </Button>{" "}
            and send PDF lots here.
          </Typography>
        </Paper>
      ) : (
        <Paper sx={{ overflow: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sale</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Lots</TableCell>
                <TableCell align="right">Bags</TableCell>
                <TableCell align="right">Net kg</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((batch) => (
                <TableRow key={batch.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {batch.saleNumber}/{batch.year}
                  </TableCell>
                  <TableCell>{formatSaleDate(batch.saleDate)}</TableCell>
                  <TableCell>{batch.name}</TableCell>
                  <TableCell>
                    <Chip size="small" label={batch.status} />
                  </TableCell>
                  <TableCell align="right">{batch.lotCount}</TableCell>
                  <TableCell align="right">{batch.bagCount}</TableCell>
                  <TableCell align="right">
                    {Number(batch.netWeightKg).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to={`/collections/${batch.id}`} size="small">
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
}

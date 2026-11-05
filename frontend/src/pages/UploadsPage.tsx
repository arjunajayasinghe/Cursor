import {
  Alert,
  Button,
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
import { listUploads } from "../api/client";
import { brokerName, formatSaleDate } from "../catalogue";
import { StatusChip } from "./StatusChip";

export function UploadsPage() {
  const uploads = useQuery({
    queryKey: ["uploads"],
    queryFn: listUploads,
    refetchInterval: (query) => {
      const rows = query.state.data;
      if (!rows) return false;
      return rows.some((row) => row.status === "Pending" || row.status === "Processing") ? 2000 : false;
    },
  });

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}
      >
        <div>
          <Typography variant="h4">Uploads</Typography>
          <Typography color="text.secondary">Catalogue files received and their processing status.</Typography>
        </div>
        <Button variant="contained" component={RouterLink} to="/upload">
          Upload all 8 brokers
        </Button>
      </Stack>

      {uploads.isPending ? <CircularProgress aria-label="Loading uploads" /> : null}
      {uploads.isError ? (
        <Alert severity="error" action={<Button onClick={() => uploads.refetch()}>Retry</Button>}>
          {uploads.error.message}
        </Alert>
      ) : null}

      {uploads.data && uploads.data.length === 0 ? (
        <Paper sx={{ p: 4 }}>
          <Typography>No uploads yet. Send a catalogue to open the book.</Typography>
        </Paper>
      ) : null}

      {uploads.data && uploads.data.length > 0 ? (
        <Paper sx={{ overflow: "auto" }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Uploaded</TableCell>
                <TableCell>Broker</TableCell>
                <TableCell>Sale</TableCell>
                <TableCell>Centre</TableCell>
                <TableCell>Sale date</TableCell>
                <TableCell>File</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Lots</TableCell>
                <TableCell>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uploads.data.map((upload) => (
                <TableRow key={upload.id} hover>
                  <TableCell>
                    {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(upload.createdAt))}
                  </TableCell>
                  <TableCell>{brokerName(String(upload.broker))}</TableCell>
                  <TableCell>
                    {upload.saleId ? (
                      <Button
                        component={RouterLink}
                        to={`/sales/${upload.saleId}`}
                        sx={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: "1.05rem" }}
                      >
                        {upload.saleNumber}/{upload.year}
                      </Button>
                    ) : (
                      `${upload.saleNumber}/${upload.year}`
                    )}
                  </TableCell>
                  <TableCell>{upload.centre}</TableCell>
                  <TableCell>{formatSaleDate(upload.saleDate)}</TableCell>
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
      ) : null}
    </Stack>
  );
}

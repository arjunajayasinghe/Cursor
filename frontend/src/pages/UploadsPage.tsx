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

  const completed = uploads.data?.filter((row) => row.status === "Completed" && Number(row.lotCount) > 0) ?? [];

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}
      >
        <div>
          <Typography variant="h4">Pre-auction uploads</Typography>
          <Typography color="text.secondary">
            Click <strong>View catalogue</strong> on a completed upload to open every lot line from that broker file.
          </Typography>
        </div>
        <Button variant="contained" component={RouterLink} to="/upload">
          Upload all 8 brokers
        </Button>
      </Stack>

      {completed.length > 0 ? (
        <Alert severity="info">
          {completed.length} catalogue{completed.length === 1 ? "" : "s"} ready with lot details. Open any of them below —
          for example{" "}
          <Button
            component={RouterLink}
            to={`/uploads/${completed[0].id}`}
            size="small"
            sx={{ verticalAlign: "baseline", textTransform: "none" }}
          >
            {String(completed[0].broker)} sale {completed[0].saleNumber}/{completed[0].year}
          </Button>
          .
        </Alert>
      ) : null}

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
                <TableCell>Open</TableCell>
                <TableCell>Kind</TableCell>
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
              {uploads.data.map((upload) => {
                const canOpen = upload.status === "Completed" && Number(upload.lotCount) > 0;
                return (
                  <TableRow key={upload.id} hover>
                    <TableCell>
                      <Button
                        variant={canOpen ? "contained" : "outlined"}
                        size="small"
                        component={RouterLink}
                        to={`/uploads/${upload.id}`}
                        disabled={upload.status === "Pending" || upload.status === "Processing"}
                      >
                        {canOpen
                          ? String(upload.kind) === "PostAuctionSales"
                            ? "View sales"
                            : "View catalogue"
                          : "Open"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      {String(upload.kind) === "PostAuctionSales" ? "Sales" : "Catalogue"}
                    </TableCell>
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
                    <TableCell>
                      <Button component={RouterLink} to={`/uploads/${upload.id}`} sx={{ textTransform: "none" }}>
                        {upload.originalFileName}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <StatusChip status={String(upload.status)} />
                    </TableCell>
                    <TableCell align="right">{upload.lotCount}</TableCell>
                    <TableCell sx={{ maxWidth: 280, whiteSpace: "normal" }}>{upload.error ?? ""}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      ) : null}
    </Stack>
  );
}

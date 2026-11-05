import {
  Alert,
  Button,
  CircularProgress,
  FormControlLabel,
  Link,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { listUploads, type UploadBatch } from "../api/client";
import { brokerName, formatSaleDate } from "../catalogue";
import { StatusChip } from "./StatusChip";

function isReady(upload: UploadBatch) {
  return upload.status === "Completed" && Number(upload.lotCount) > 0;
}

function isFailed(upload: UploadBatch) {
  return upload.status === "Failed";
}

function openLabel(upload: UploadBatch) {
  if (isReady(upload)) {
    return String(upload.kind) === "PostAuctionSales" ? "View sales" : "View catalogue";
  }
  if (isFailed(upload)) return "View error";
  if (upload.status === "Pending" || upload.status === "Processing") return "Processing…";
  return "Open";
}

export function UploadsPage() {
  const navigate = useNavigate();
  const [showFailed, setShowFailed] = useState(false);
  const uploads = useQuery({
    queryKey: ["uploads"],
    queryFn: listUploads,
    refetchInterval: (query) => {
      const rows = query.state.data;
      if (!rows) return false;
      return rows.some((row) => row.status === "Pending" || row.status === "Processing") ? 2000 : false;
    },
  });

  const ready = useMemo(
    () => uploads.data?.filter(isReady) ?? [],
    [uploads.data],
  );
  const failed = useMemo(
    () => uploads.data?.filter(isFailed) ?? [],
    [uploads.data],
  );
  const visible = useMemo(() => {
    const rows = uploads.data ?? [];
    if (showFailed) return rows;
    return rows.filter((row) => !isFailed(row));
  }, [uploads.data, showFailed]);

  function openUpload(upload: UploadBatch) {
    if (upload.status === "Pending" || upload.status === "Processing") return;
    navigate(`/uploads/${upload.id}`);
  }

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { sm: "flex-end" } }}
      >
        <div>
          <Typography variant="h4">Uploads</Typography>
          <Typography color="text.secondary">
            Open a completed row to see every lot from that broker file. Failed attempts are hidden by default.
          </Typography>
        </div>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" component={RouterLink} to="/upload-sales">
            Upload sales
          </Button>
          <Button variant="contained" component={RouterLink} to="/upload">
            Upload catalogues
          </Button>
        </Stack>
      </Stack>

      {ready.length > 0 ? (
        <Alert severity="success">
          {ready.length} file{ready.length === 1 ? "" : "s"} ready with lot details. Start with{" "}
          <Link
            component={RouterLink}
            to={`/uploads/${ready[0].id}`}
            underline="hover"
            sx={{ fontWeight: 600 }}
          >
            {String(ready[0].broker)} sale {ready[0].saleNumber}/{ready[0].year}
          </Link>
          {ready[0].saleId ? (
            <>
              {" "}
              or the{" "}
              <Link component={RouterLink} to={`/sales/${ready[0].saleId}`} underline="hover" sx={{ fontWeight: 600 }}>
                full sale catalogue
              </Link>
            </>
          ) : null}
          .
        </Alert>
      ) : null}

      {failed.length > 0 ? (
        <Alert
          severity="warning"
          action={
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={showFailed}
                  onChange={(_, checked) => setShowFailed(checked)}
                  slotProps={{ input: { "aria-label": "Show failed uploads" } }}
                />
              }
              label="Show failed"
              sx={{ mr: 0, whiteSpace: "nowrap" }}
            />
          }
        >
          {failed.length} failed upload{failed.length === 1 ? "" : "s"} (0 lots). These do not contain catalogue
          details — use a completed row for the same broker instead.
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

      {uploads.data && uploads.data.length > 0 && visible.length === 0 ? (
        <Paper sx={{ p: 4 }}>
          <Typography>
            Only failed uploads are on file. Turn on <strong>Show failed</strong> above, or upload catalogues again.
          </Typography>
        </Paper>
      ) : null}

      {visible.length > 0 ? (
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
              {visible.map((upload) => {
                const readyRow = isReady(upload);
                const failedRow = isFailed(upload);
                const busy = upload.status === "Pending" || upload.status === "Processing";
                return (
                  <TableRow
                    key={upload.id}
                    hover={!busy}
                    selected={readyRow}
                    sx={{
                      cursor: busy ? "default" : "pointer",
                      opacity: failedRow ? 0.72 : 1,
                      bgcolor: failedRow ? "rgba(176, 0, 32, 0.04)" : undefined,
                    }}
                    onClick={() => openUpload(upload)}
                  >
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <Button
                        variant={readyRow ? "contained" : "outlined"}
                        color={failedRow ? "error" : "primary"}
                        size="small"
                        disabled={busy}
                        component={RouterLink}
                        to={`/uploads/${upload.id}`}
                      >
                        {openLabel(upload)}
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
                    <TableCell onClick={(event) => event.stopPropagation()}>
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
                    <TableCell sx={{ maxWidth: 220, whiteSpace: "normal" }}>{upload.originalFileName}</TableCell>
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

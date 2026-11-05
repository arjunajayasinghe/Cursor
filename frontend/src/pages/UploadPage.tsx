import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { createUpload, getUpload } from "../api/client";
import {
  BrokerCode,
  brokerName,
  brokers,
  centres,
  csvHeaderError,
  isAllowedCatalogueFile,
} from "../catalogue";
import { StatusChip } from "./StatusChip";

type SaleHeader = {
  saleNumber: string;
  year: number;
  centre: string;
  saleDate: string;
};

type DropState = {
  broker: BrokerCode | null;
  active: boolean;
};

export function UploadPage() {
  const queryClient = useQueryClient();
  const [header, setHeader] = useState<SaleHeader>({
    saleNumber: "03",
    year: 2026,
    centre: "Colombo",
    saleDate: "2026-01-21",
  });
  const [drop, setDrop] = useState<DropState>({ broker: null, active: false });
  const [localError, setLocalError] = useState("");
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [lastBroker, setLastBroker] = useState<BrokerCode | null>(null);

  const mutation = useMutation({
    mutationFn: createUpload,
    onSuccess: (accepted) => {
      setUploadId(accepted.id);
      void queryClient.invalidateQueries({ queryKey: ["uploads"] });
    },
  });

  const upload = useQuery({
    queryKey: ["upload", uploadId],
    queryFn: () => getUpload(uploadId!),
    enabled: Boolean(uploadId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "Completed" || status === "Failed") return false;
      return 1000;
    },
  });

  useEffect(() => {
    const status = upload.data?.status;
    if (status === "Completed" || status === "Failed") {
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
      void queryClient.invalidateQueries({ queryKey: ["uploads"] });
      if (upload.data?.saleId) void queryClient.invalidateQueries({ queryKey: ["sale", upload.data.saleId] });
    }
  }, [queryClient, upload.data?.saleId, upload.data?.status]);

  async function handleFile(broker: BrokerCode, file: File | undefined) {
    setLocalError("");
    if (!file) return;
    if (!header.saleNumber.trim()) {
      setLocalError("Enter the sale number first.");
      return;
    }
    if (!header.saleDate) {
      setLocalError("Choose the sale date first.");
      return;
    }
    if (!isAllowedCatalogueFile(file)) {
      setLocalError("Drop a broker .txt catalogue or a .csv file.");
      return;
    }
    if (file.size <= 0) {
      setLocalError("The file is empty.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setLocalError("The file must be 10 MB or smaller.");
      return;
    }
    const headerError = await csvHeaderError(file);
    if (headerError) {
      setLocalError(headerError);
      return;
    }

    setLastBroker(broker);
    setUploadId(null);
    mutation.mutate({
      saleNumber: header.saleNumber.trim(),
      year: header.year,
      centre: header.centre,
      saleDate: header.saleDate,
      broker,
      file,
    });
  }

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Upload by broker</Typography>
        <Typography color="text.secondary">
          Set the sale once, then drag each broker catalogue onto its tile.
        </Typography>
      </div>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            label="Sale number"
            value={header.saleNumber}
            onChange={(event) => setHeader((current) => ({ ...current, saleNumber: event.target.value }))}
            helperText="For Auction 03 use 03"
            sx={{ flex: 1 }}
          />
          <TextField
            label="Year"
            type="number"
            value={header.year}
            onChange={(event) => setHeader((current) => ({ ...current, year: Number(event.target.value) }))}
            sx={{ width: { md: 140 } }}
          />
          <TextField
            select
            label="Centre"
            value={header.centre}
            onChange={(event) => setHeader((current) => ({ ...current, centre: event.target.value }))}
            sx={{ flex: 1 }}
          >
            {centres.map((centre) => (
              <MenuItem key={centre} value={centre}>
                {centre}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Sale date"
            type="date"
            value={header.saleDate}
            onChange={(event) => setHeader((current) => ({ ...current, saleDate: event.target.value }))}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: 1 }}
          />
        </Stack>
      </Paper>

      {(localError || mutation.isError) && (
        <Alert severity="error">{localError || mutation.error?.message}</Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr 1fr" },
        }}
      >
        {brokers.map((broker) => {
          const active = drop.active && drop.broker === broker.code;
          return (
            <Paper
              key={broker.code}
              variant="outlined"
              onDragEnter={(event) => {
                event.preventDefault();
                setDrop({ broker: broker.code, active: true });
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setDrop({ broker: broker.code, active: true });
              }}
              onDragLeave={() => setDrop({ broker: null, active: false })}
              onDrop={(event) => {
                event.preventDefault();
                setDrop({ broker: null, active: false });
                void handleFile(broker.code, event.dataTransfer.files?.[0]);
              }}
              sx={{
                p: 2.5,
                minHeight: 160,
                display: "flex",
                flexDirection: "column",
                gap: 1.25,
                borderStyle: "dashed",
                borderWidth: 2,
                borderColor: active ? "primary.main" : "divider",
                bgcolor: active ? "rgba(31, 77, 58, 0.08)" : "background.paper",
                transition: "border-color 120ms ease, background-color 120ms ease, transform 120ms ease",
                transform: active ? "translateY(-2px)" : "none",
              }}
            >
              <Typography variant="overline" color="text.secondary">
                {broker.code}
              </Typography>
              <Typography variant="h6" sx={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
                {broker.name}
              </Typography>
              <Stack spacing={0.5} sx={{ color: "text.secondary", flexGrow: 1 }}>
                <CloudUploadOutlinedIcon fontSize="small" />
                <Typography variant="body2">Drag the catalogue here</Typography>
                <Typography variant="caption">.txt broker file or .csv</Typography>
              </Stack>
              <Button variant="outlined" component="label" disabled={mutation.isPending}>
                Choose file
                <input
                  hidden
                  type="file"
                  accept=".txt,.csv,.dat,text/plain,text/csv"
                  onChange={(event) => {
                    void handleFile(broker.code, event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </Button>
            </Paper>
          );
        })}
      </Box>

      {uploadId ? (
        <Paper sx={{ p: 3 }}>
          {mutation.isPending ? <Typography>Sending {lastBroker ? brokerName(lastBroker) : "broker"} file…</Typography> : null}
          {upload.isPending && !mutation.isPending ? <Typography>Waiting for the job…</Typography> : null}
          {upload.data ? (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Typography>
                  {String(upload.data.broker)} · {upload.data.originalFileName}
                </Typography>
                <StatusChip status={String(upload.data.status)} />
              </Stack>
              {upload.data.status === "Completed" && upload.data.saleId ? (
                <Stack direction="row" spacing={1}>
                  <Button component={RouterLink} to={`/sales/${upload.data.saleId}`}>
                    View sale {upload.data.saleNumber}/{upload.data.year}
                  </Button>
                  <Button component={RouterLink} to="/uploads">
                    All uploads
                  </Button>
                </Stack>
              ) : null}
              {upload.data.status === "Failed" ? <Alert severity="error">{upload.data.error}</Alert> : null}
            </Stack>
          ) : null}
          {upload.isError ? <Alert severity="error">{upload.error.message}</Alert> : null}
        </Paper>
      ) : null}
    </Stack>
  );
}

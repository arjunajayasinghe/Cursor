import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import ClearIcon from "@mui/icons-material/Clear";
import {
  Alert,
  Box,
  Button,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { createPurchasedInvoice, type UploadAccepted } from "../api/client";
import {
  BrokerCode,
  brokerName,
  centres,
  detectBrokerCode,
  invoiceBrokers,
  isAllowedPurchasedInvoiceFile,
} from "../catalogue";

type SaleHeader = {
  saleNumber: string;
  year: number;
  centre: string;
  saleDate: string;
};

type StagedFile = {
  file: File;
  error?: string;
};

type BrokerUploadRow = {
  broker: BrokerCode;
  fileName: string;
  accepted?: UploadAccepted;
  error?: string;
};

const emptySlots = (): Record<BrokerCode, StagedFile | null> =>
  Object.fromEntries(invoiceBrokers.map((broker) => [broker.code, null])) as Record<
    BrokerCode,
    StagedFile | null
  >;

export function InvoiceUploadPage() {
  const queryClient = useQueryClient();
  const [header, setHeader] = useState<SaleHeader>({
    saleNumber: "04",
    year: 2026,
    centre: "Colombo",
    saleDate: "2026-01-28",
  });
  const [slots, setSlots] = useState<Record<BrokerCode, StagedFile | null>>(emptySlots);
  const [bulkActive, setBulkActive] = useState(false);
  const [tileActive, setTileActive] = useState<BrokerCode | null>(null);
  const [localError, setLocalError] = useState("");
  const [batchRows, setBatchRows] = useState<BrokerUploadRow[] | null>(null);
  const [uploading, setUploading] = useState(false);

  const stagedBrokers = useMemo(
    () => invoiceBrokers.filter((broker) => slots[broker.code]?.file && !slots[broker.code]?.error),
    [slots],
  );
  const stagedCount = stagedBrokers.length;

  const mutation = useMutation({ mutationFn: createPurchasedInvoice });

  async function validateAndStage(file: File): Promise<StagedFile> {
    if (!isAllowedPurchasedInvoiceFile(file)) {
      return { file, error: "Use a purchased-invoice PDF." };
    }
    if (file.size <= 0) return { file, error: "The file is empty." };
    if (file.size > 20 * 1024 * 1024) return { file, error: "The PDF must be 20 MB or smaller." };
    return { file };
  }

  async function assignFiles(files: FileList | File[], preferredBroker?: BrokerCode) {
    setLocalError("");
    const list = Array.from(files);
    if (list.length === 0) return;

    const next = { ...slots };
    const unassigned: string[] = [];

    for (const file of list) {
      let broker = preferredBroker;
      if (!broker) {
        const detected = detectBrokerCode(file.name);
        if (!detected || !invoiceBrokers.some((b) => b.code === detected)) {
          unassigned.push(file.name);
          continue;
        }
        broker = detected;
      }
      next[broker] = await validateAndStage(file);
    }

    setSlots(next);
    if (unassigned.length > 0) {
      setLocalError(
        `Could not match broker for: ${unassigned.join(", ")}. Use ASC/BP/CTB/FW/JK/LCB/MPB names or drop onto a tile.`,
      );
    }
  }

  function clearSlot(broker: BrokerCode) {
    setSlots((current) => ({ ...current, [broker]: null }));
  }

  function clearAll() {
    setSlots(emptySlots());
    setBatchRows(null);
    setLocalError("");
  }

  async function uploadStaged() {
    setLocalError("");
    setBatchRows(null);

    if (!header.saleNumber.trim()) {
      setLocalError("Enter the sale number first.");
      return;
    }
    if (!header.saleDate) {
      setLocalError("Choose the sale date first.");
      return;
    }
    if (stagedCount === 0) {
      setLocalError("Stage at least one purchased-invoice PDF before uploading.");
      return;
    }

    setUploading(true);
    const rows: BrokerUploadRow[] = [];

    try {
      for (const broker of stagedBrokers) {
        const staged = slots[broker.code]!;
        try {
          const accepted = await mutation.mutateAsync({
            saleNumber: header.saleNumber.trim(),
            year: header.year,
            centre: header.centre,
            saleDate: header.saleDate,
            broker: broker.code,
            file: staged.file,
          });
          rows.push({ broker: broker.code, fileName: staged.file.name, accepted });
        } catch (error) {
          rows.push({
            broker: broker.code,
            fileName: staged.file.name,
            error: error instanceof Error ? error.message : "Upload failed.",
          });
        }
      }
      setBatchRows(rows);
      void queryClient.invalidateQueries({ queryKey: ["purchased-invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["purchased-invoice-workbench"] });
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
    } finally {
      setUploading(false);
    }
  }

  const saleId = batchRows?.find((row) => row.accepted?.saleId)?.accepted?.saleId;
  const workbenchQuery = `?saleNumber=${encodeURIComponent(header.saleNumber.trim())}&year=${header.year}`;

  return (
    <Stack spacing={3}>
      <div>
        <Typography variant="h4">Upload broker purchase invoices</Typography>
        <Typography color="text.secondary">
          Drop each broker’s purchase invoice PDF for the buyer (e.g. Venture). They open together on the
          Purchases workbench so you can see every broker invoice for the sale.
        </Typography>
      </div>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            label="Sale number"
            value={header.saleNumber}
            onChange={(event) => setHeader((current) => ({ ...current, saleNumber: event.target.value }))}
            helperText="For Auction 04 use 04"
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

      <Paper
        variant="outlined"
        onDragEnter={(event) => {
          event.preventDefault();
          setBulkActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setBulkActive(true);
        }}
        onDragLeave={() => setBulkActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setBulkActive(false);
          void assignFiles(event.dataTransfer.files);
        }}
        sx={{
          p: { xs: 3, md: 4 },
          borderStyle: "dashed",
          borderWidth: 2,
          borderColor: bulkActive ? "primary.main" : "divider",
          bgcolor: bulkActive ? "rgba(31, 77, 58, 0.08)" : "background.paper",
          transition: "border-color 120ms ease, background-color 120ms ease",
        }}
      >
        <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <CloudUploadOutlinedIcon color={bulkActive ? "primary" : "action"} />
            <div>
              <Typography variant="h6" sx={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
                Drop purchased-invoice PDFs here
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ASC→AS, BP→BC, CTB→CT, FW, JK, LCB→LC, MPB→MB. Upload any subset — EB is optional.
              </Typography>
            </div>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Button variant="outlined" component="label" disabled={uploading}>
              Choose PDFs
              <input
                hidden
                type="file"
                multiple
                accept=".pdf,application/pdf"
                onChange={(event) => {
                  if (event.target.files) void assignFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </Button>
            <Button variant="text" onClick={clearAll} disabled={uploading || stagedCount === 0}>
              Clear
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
              {stagedCount} of {invoiceBrokers.length} staged
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr 1fr" },
        }}
      >
        {invoiceBrokers.map((broker) => {
          const staged = slots[broker.code];
          const active = tileActive === broker.code;
          const ready = Boolean(staged?.file && !staged.error);
          return (
            <Paper
              key={broker.code}
              variant="outlined"
              onDragEnter={(event) => {
                event.preventDefault();
                setTileActive(broker.code);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setTileActive(broker.code);
              }}
              onDragLeave={() => setTileActive(null)}
              onDrop={(event) => {
                event.preventDefault();
                setTileActive(null);
                const file = event.dataTransfer.files?.[0];
                if (file) void assignFiles([file], broker.code);
              }}
              sx={{
                p: 2.5,
                minHeight: 168,
                display: "flex",
                flexDirection: "column",
                gap: 1,
                borderStyle: "dashed",
                borderWidth: 2,
                borderColor: staged?.error ? "error.main" : active || ready ? "primary.main" : "divider",
                bgcolor: active ? "rgba(31, 77, 58, 0.08)" : ready ? "rgba(31, 77, 58, 0.04)" : "background.paper",
                transition: "border-color 120ms ease, background-color 120ms ease",
              }}
            >
              <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <Typography variant="overline" color="text.secondary">
                    {broker.code}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
                    {broker.name}
                  </Typography>
                </div>
                {staged ? (
                  <IconButton
                    size="small"
                    aria-label={`Clear ${broker.code}`}
                    onClick={() => clearSlot(broker.code)}
                    disabled={uploading}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                ) : null}
              </Stack>

              {ready ? (
                <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
                  <CheckCircleOutlinedIcon color="primary" fontSize="small" />
                  <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
                    {staged!.file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(staged!.file.size / 1024).toFixed(0)} KB
                  </Typography>
                </Stack>
              ) : (
                <Stack spacing={0.5} sx={{ color: "text.secondary", flexGrow: 1 }}>
                  <CloudUploadOutlinedIcon fontSize="small" />
                  <Typography variant="body2">Drop {broker.code} PDF</Typography>
                  {staged?.error ? (
                    <Typography variant="caption" color="error">
                      {staged.error}
                    </Typography>
                  ) : (
                    <Typography variant="caption">.pdf</Typography>
                  )}
                </Stack>
              )}

              <Button variant="outlined" component="label" size="small" disabled={uploading}>
                {staged ? "Replace" : "Choose"}
                <input
                  hidden
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void assignFiles([file], broker.code);
                    event.target.value = "";
                  }}
                />
              </Button>
            </Paper>
          );
        })}
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ alignItems: { sm: "center" } }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => void uploadStaged()}
          disabled={uploading || stagedCount === 0}
        >
          {uploading
            ? `Uploading ${stagedCount} invoice${stagedCount === 1 ? "" : "s"}…`
            : `Upload ${stagedCount || ""} purchased invoice${stagedCount === 1 ? "" : "s"}`.trim()}
        </Button>
        <Typography variant="body2" color="text.secondary">
          {stagedCount === 0
            ? "Stage one or more PDFs to enable upload."
            : `Ready for sale ${header.saleNumber}/${header.year}.`}
        </Typography>
      </Stack>

      {uploading ? <LinearProgress /> : null}

      {batchRows ? (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="h6">Upload results</Typography>
            {batchRows.map((row) => (
              <Stack
                key={row.broker}
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
              >
                <Typography sx={{ minWidth: 220 }}>
                  {row.broker} · {brokerName(row.broker)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1, wordBreak: "break-all" }}>
                  {row.fileName}
                </Typography>
                <Typography
                  variant="body2"
                  color={row.error ? "error.main" : "success.main"}
                  sx={{ fontWeight: 600 }}
                >
                  {row.error ? "Failed" : "Saved"}
                </Typography>
                {row.error ? (
                  <Typography variant="caption" color="error">
                    {row.error}
                  </Typography>
                ) : null}
              </Stack>
            ))}
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
              <Button component={RouterLink} to={`/purchases${workbenchQuery}`} variant="contained">
                Open purchase workbench
              </Button>
              {saleId ? (
                <Button component={RouterLink} to={`/auctions/${saleId}`}>
                  Open auction board
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}

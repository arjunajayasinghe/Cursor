import {
  Alert,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  generateSampleBoxes,
  getCollectionBatch,
  listSampleBoxes,
  markSampleBoxesReceived,
} from "../api/client";
import { formatSaleDate } from "../catalogue";

export function CollectionDetailPage() {
  const { batchId = "" } = useParams();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [selectedLotIds, setSelectedLotIds] = useState<Set<string>>(new Set());
  const [selectedBoxIds, setSelectedBoxIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<"shared" | "perLot">("shared");
  const [collectorName, setCollectorName] = useState("");

  const batch = useQuery({
    queryKey: ["collection", batchId],
    queryFn: () => getCollectionBatch(batchId),
    enabled: Boolean(batchId),
  });

  const boxes = useQuery({
    queryKey: ["collection-boxes", batchId],
    queryFn: () => listSampleBoxes(batchId),
    enabled: Boolean(batchId),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      generateSampleBoxes({
        collectionBatchId: batchId,
        collectionLotIds: [...selectedLotIds],
        mode,
        collectorName: collectorName.trim() || undefined,
      }),
    onSuccess: () => {
      setSelectedLotIds(new Set());
      void queryClient.invalidateQueries({ queryKey: ["collection", batchId] });
      void queryClient.invalidateQueries({ queryKey: ["collection-boxes", batchId] });
    },
  });

  const receiveMutation = useMutation({
    mutationFn: () =>
      markSampleBoxesReceived({
        sampleBoxIds: [...selectedBoxIds],
        receivedBy: "desk",
      }),
    onSuccess: () => {
      setSelectedBoxIds(new Set());
      void queryClient.invalidateQueries({ queryKey: ["collection", batchId] });
      void queryClient.invalidateQueries({ queryKey: ["collection-boxes", batchId] });
    },
  });

  const unboxedLots = useMemo(
    () => (batch.data?.lots ?? []).filter((lot) => !lot.sampleBoxId),
    [batch.data?.lots],
  );

  if (batch.isPending || boxes.isPending) {
    return <CircularProgress aria-label="Loading collection batch" />;
  }
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
  const boxRows = boxes.data?.boxes ?? [];
  const readyForBlending = Boolean(boxes.data?.readyForBlending);
  const pageUnboxedIds = pageRows.filter((lot) => !lot.sampleBoxId).map((lot) => lot.id);
  const allPageUnboxedSelected =
    pageUnboxedIds.length > 0 && pageUnboxedIds.every((id) => selectedLotIds.has(id));
  const somePageUnboxedSelected = pageUnboxedIds.some((id) => selectedLotIds.has(id));

  function toggleLot(id: string) {
    setSelectedLotIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePageLots() {
    setSelectedLotIds((current) => {
      const next = new Set(current);
      if (allPageUnboxedSelected) pageUnboxedIds.forEach((id) => next.delete(id));
      else pageUnboxedIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleBox(id: string) {
    setSelectedBoxIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <Chip label={detail.status} />
          <Button component={RouterLink} to="/collections" size="small" variant="outlined">
            All batches
          </Button>
          <Button component={RouterLink} to="/purchases" size="small">
            Add more from invoices
          </Button>
          <Button
            component={RouterLink}
            to={`/blending?fromBatch=${detail.id}`}
            size="small"
            variant="contained"
            disabled={!readyForBlending}
          >
            Continue to blending
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
        <Summary label="Boxes" value={String(boxRows.length)} />
      </Stack>

      {readyForBlending ? (
        <Alert severity="success">
          All sample boxes received. You can continue to blending for this sale.
        </Alert>
      ) : (
        <Alert severity="info">
          Select lots → generate box numbers (series <strong>BOX-{detail.year}-######</strong>) → print QR/barcode
          sheet → mark received → blending unlocks.
        </Alert>
      )}

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Generate box numbers
        </Typography>
        <Stack spacing={1.5}>
          <RadioGroup
            row
            value={mode}
            onChange={(_, value) => setMode(value as "shared" | "perLot")}
          >
            <FormControlLabel value="shared" control={<Radio />} label="One box for selected lots" />
            <FormControlLabel value="perLot" control={<Radio />} label="One box per lot" />
          </RadioGroup>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
            <TextField
              size="small"
              label="Collector (optional)"
              value={collectorName}
              onChange={(e) => setCollectorName(e.target.value)}
              sx={{ minWidth: 220 }}
            />
            <Button
              size="small"
              variant="outlined"
              disabled={unboxedLots.length === 0}
              onClick={() => setSelectedLotIds(new Set(unboxedLots.map((lot) => lot.id)))}
            >
              Select all unboxed ({unboxedLots.length})
            </Button>
            <Button
              variant="contained"
              disabled={selectedLotIds.size === 0 || generateMutation.isPending}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending
                ? "Generating…"
                : `Generate box number${mode === "perLot" && selectedLotIds.size > 1 ? "s" : ""}`}
            </Button>
          </Stack>
          {generateMutation.isError ? (
            <Alert severity="error">{generateMutation.error.message}</Alert>
          ) : null}
        </Stack>
      </Paper>

      {boxRows.length > 0 ? (
        <Paper sx={{ p: 2 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ mb: 1.5, alignItems: { sm: "center" }, justifyContent: "space-between" }}
          >
            <Typography variant="h6">Sample boxes</Typography>
            <Button
              variant="contained"
              color="secondary"
              disabled={selectedBoxIds.size === 0 || receiveMutation.isPending}
              onClick={() => receiveMutation.mutate()}
            >
              {receiveMutation.isPending ? "Updating…" : `Mark ${selectedBoxIds.size || ""} received`}
            </Button>
          </Stack>
          {receiveMutation.isError ? (
            <Alert severity="error" sx={{ mb: 1 }}>
              {receiveMutation.error.message}
            </Alert>
          ) : null}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Box number</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Lots</TableCell>
                <TableCell align="right">Bags</TableCell>
                <TableCell align="right">Net kg</TableCell>
                <TableCell>WH</TableCell>
                <TableCell align="right">Prints</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {boxRows.map((box) => {
                const received = box.status === "Received" || box.status === "Completed";
                return (
                  <TableRow key={box.id} hover selected={selectedBoxIds.has(box.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedBoxIds.has(box.id)}
                        disabled={received}
                        onChange={() => toggleBox(box.id)}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>{box.boxNumber}</TableCell>
                    <TableCell>
                      <Chip size="small" label={box.status} />
                    </TableCell>
                    <TableCell align="right">{box.lotCount}</TableCell>
                    <TableCell align="right">{box.bagCount}</TableCell>
                    <TableCell align="right">
                      {Number(box.netWeightKg).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem" }}>{box.warehouseOrBasis || "—"}</TableCell>
                    <TableCell align="right">{box.printCount}</TableCell>
                    <TableCell align="right">
                      <Button
                        component={RouterLink}
                        to={`/collections/boxes/${box.id}/print`}
                        size="small"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Print
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      ) : null}

      <Paper sx={{ overflow: "auto" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={somePageUnboxedSelected && !allPageUnboxedSelected}
                  checked={allPageUnboxedSelected}
                  onChange={togglePageLots}
                  disabled={pageUnboxedIds.length === 0}
                />
              </TableCell>
              <TableCell>Broker</TableCell>
              <TableCell align="right">Lot</TableCell>
              <TableCell>Box</TableCell>
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
            {pageRows.map((lot) => {
              const boxed = Boolean(lot.sampleBoxId);
              const checked = selectedLotIds.has(lot.id);
              return (
                <TableRow key={lot.id} hover selected={checked} sx={{ opacity: boxed ? 0.75 : 1 }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={checked}
                      disabled={boxed}
                      onChange={() => toggleLot(lot.id)}
                    />
                  </TableCell>
                  <TableCell>{lot.broker}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {lot.lotNumber}
                  </TableCell>
                  <TableCell>
                    {lot.boxNumber ? (
                      <Chip size="small" label={lot.boxNumber} />
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        —
                      </Typography>
                    )}
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
              );
            })}
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

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Tab,
  Tabs,
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
  reverseSampleBoxes,
  type SampleBoxSummary,
} from "../api/client";
import { formatSaleDate } from "../catalogue";

type TabKey = "lots" | "boxes";

export function CollectionDetailPage() {
  const { batchId = "" } = useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>("lots");
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

  const boxesQuery = useQuery({
    queryKey: ["collection-boxes", batchId],
    queryFn: () => listSampleBoxes(batchId),
    enabled: Boolean(batchId),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["collection", batchId] });
    void queryClient.invalidateQueries({ queryKey: ["collection-boxes", batchId] });
  }

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
      setTab("boxes");
      refresh();
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
      refresh();
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (mode: "selected" | "all") =>
      mode === "all"
        ? reverseSampleBoxes({
            collectionBatchId: batchId,
            reverseAll: true,
            includeReceived: true,
            reason: "Reverse all box numbers from collection desk",
          })
        : reverseSampleBoxes({
            sampleBoxIds: [...selectedBoxIds],
            reason: "Reversed from collection desk",
          }),
    onSuccess: () => {
      setSelectedBoxIds(new Set());
      setTab("lots");
      refresh();
    },
  });

  const unboxedLots = useMemo(
    () => (batch.data?.lots ?? []).filter((lot) => !lot.sampleBoxId),
    [batch.data?.lots],
  );

  if (batch.isPending || boxesQuery.isPending) {
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
  const saleKey = `${detail.saleNumber}/${detail.year}`;
  const rows = detail.lots;
  const pageRows = rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const allBoxes = boxesQuery.data?.boxes ?? [];
  const activeBoxes = allBoxes.filter((b) => b.status !== "Cancelled");
  const cancelledBoxes = allBoxes.filter((b) => b.status === "Cancelled");
  const readyForBlending = Boolean(boxesQuery.data?.readyForBlending);
  const pageUnboxedIds = pageRows.filter((lot) => !lot.sampleBoxId).map((lot) => lot.id);
  const allPageUnboxedSelected =
    pageUnboxedIds.length > 0 && pageUnboxedIds.every((id) => selectedLotIds.has(id));
  const somePageUnboxedSelected = pageUnboxedIds.some((id) => selectedLotIds.has(id));

  const selectedActive = activeBoxes.filter((b) => selectedBoxIds.has(b.id));
  const canMarkCollected = selectedActive.some(
    (b) => b.status === "Open" || b.status === "Printed",
  );
  const canReverse = selectedActive.some(
    (b) => b.status === "Open" || b.status === "Printed",
  );

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

  function toggleBox(box: SampleBoxSummary) {
    if (box.status === "Cancelled" || box.status === "Received" || box.status === "Completed") return;
    setSelectedBoxIds((current) => {
      const next = new Set(current);
      if (next.has(box.id)) next.delete(box.id);
      else next.add(box.id);
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
            Auction / sale <strong>{saleKey}</strong> · {formatSaleDate(detail.saleDate)} · {detail.centre}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Unique lot key = Auction (sale) number + Lot number
          </Typography>
        </div>
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <Chip label={detail.status} />
          <Chip label={`Sale ${saleKey}`} color="primary" variant="outlined" />
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
        <Summary label="Sale" value={saleKey} />
        <Summary label="Lots" value={String(detail.lotCount)} />
        <Summary label="Unboxed" value={String(unboxedLots.length)} />
        <Summary label="Active boxes" value={String(activeBoxes.length)} />
        <Summary
          label="Net kg"
          value={Number(detail.netWeightKg).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        />
      </Stack>

      {readyForBlending ? (
        <Alert severity="success">
          Collected boxes are ready for blending (whole batch need not be finished). Open Blending → Create Blend Sheet
          to temp-allocate those lots.
        </Alert>
      ) : (
        <Alert severity="info">
          Tabs: <strong>Lots</strong> → generate box numbers · <strong>Boxes</strong> → print, reverse, or mark as
          collected. Blending uses collected boxes only — Sale {saleKey} + lot number identifies each purchase.
        </Alert>
      )}

      <Paper>
        <Tabs
          value={tab}
          onChange={(_, value: TabKey) => setTab(value)}
          variant="scrollable"
          allowScrollButtonsMobile
          slotProps={{ indicator: { sx: { height: 3 } } }}
        >
          <Tab value="lots" label={`Lots (${detail.lotCount}) · unboxed ${unboxedLots.length}`} />
          <Tab value="boxes" label={`Boxes (${activeBoxes.length})`} />
        </Tabs>
      </Paper>

      {tab === "lots" ? (
        <Stack spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Generate box numbers
            </Typography>
            <Stack spacing={1.5}>
              <RadioGroup row value={mode} onChange={(_, value) => setMode(value as "shared" | "perLot")}>
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
                  <TableCell>Sale / Auction</TableCell>
                  <TableCell>Broker</TableCell>
                  <TableCell align="right">Lot</TableCell>
                  <TableCell>Box</TableCell>
                  <TableCell>Selling mark</TableCell>
                  <TableCell>Seller</TableCell>
                  <TableCell>Inv.No</TableCell>
                  <TableCell>Grade</TableCell>
                  <TableCell align="right">Bags</TableCell>
                  <TableCell align="right">Net kg</TableCell>
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
                        <Checkbox checked={checked} disabled={boxed} onChange={() => toggleLot(lot.id)} />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{saleKey}</TableCell>
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
                      <TableCell sx={{ minWidth: 120, fontSize: "0.8rem" }}>{lot.warehouseOrBasis || "—"}</TableCell>
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
      ) : (
        <Stack spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              Boxes — print, reverse, mark collected
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Same place after box numbers are generated. Reverse undoes Open/Printed boxes (lots become unboxed again).
              Mark as collected when samples are received — cannot reverse after that.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ flexWrap: "wrap" }}>
              <Button
                variant="contained"
                color="secondary"
                disabled={!canMarkCollected || receiveMutation.isPending}
                onClick={() => receiveMutation.mutate()}
              >
                {receiveMutation.isPending
                  ? "Updating…"
                  : `Mark as collected (${selectedActive.filter((b) => b.status === "Open" || b.status === "Printed").length})`}
              </Button>
              <Button
                variant="outlined"
                color="warning"
                disabled={!canReverse || reverseMutation.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Reverse selected boxes? Lots will be unboxed. Collected boxes in the selection are blocked — use Reverse all for those.",
                    )
                  ) {
                    reverseMutation.mutate("selected");
                  }
                }}
              >
                {reverseMutation.isPending
                  ? "Reversing…"
                  : `Reverse selected (${selectedActive.filter((b) => b.status === "Open" || b.status === "Printed").length})`}
              </Button>
              <Button
                variant="contained"
                color="warning"
                disabled={activeBoxes.length === 0 || reverseMutation.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Reverse ALL ${activeBoxes.length} box number(s) on this sale (including collected)? Every lot becomes unboxed. Old box numbers stay cancelled and are not reused.`,
                    )
                  ) {
                    reverseMutation.mutate("all");
                  }
                }}
              >
                Reverse all box numbers
              </Button>
              <Button size="small" variant="text" onClick={() => setTab("lots")}>
                Back to lots
              </Button>
            </Stack>
            {receiveMutation.isError ? (
              <Alert severity="error" sx={{ mt: 1 }}>
                {receiveMutation.error.message}
              </Alert>
            ) : null}
            {reverseMutation.isError ? (
              <Alert severity="error" sx={{ mt: 1 }}>
                {reverseMutation.error.message}
              </Alert>
            ) : null}
          </Paper>

          {activeBoxes.length === 0 ? (
            <Paper sx={{ p: 3 }}>
              <Typography color="text.secondary">
                No active boxes yet. Open the Lots tab, select lots for sale {saleKey}, and generate box numbers.
              </Typography>
            </Paper>
          ) : (
            <Paper sx={{ overflow: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>Box number</TableCell>
                    <TableCell>Sale / Auction</TableCell>
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
                  {activeBoxes.map((box) => {
                    const locked = box.status === "Received" || box.status === "Completed";
                    return (
                      <TableRow key={box.id} hover selected={selectedBoxIds.has(box.id)}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={selectedBoxIds.has(box.id)}
                            disabled={locked}
                            onChange={() => toggleBox(box)}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>{box.boxNumber}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{saleKey}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={locked ? "success" : box.status === "Printed" ? "info" : "default"}
                            label={locked ? "Collected" : box.status}
                          />
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
          )}

          {cancelledBoxes.length > 0 ? (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                Reversed / cancelled (history — numbers not reused)
              </Typography>
              <Paper sx={{ overflow: "auto" }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Box number</TableCell>
                      <TableCell>Sale / Auction</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cancelledBoxes.map((box) => (
                      <TableRow key={box.id} sx={{ opacity: 0.6 }}>
                        <TableCell>{box.boxNumber}</TableCell>
                        <TableCell>{saleKey}</TableCell>
                        <TableCell>
                          <Chip size="small" label="Cancelled" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          ) : null}
        </Stack>
      )}
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

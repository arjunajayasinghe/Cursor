import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  confirmBlendSheet,
  getBlendSheet,
  listBlendInventory,
  listBlendSheets,
  saveBlendSheet,
  type BlendInventoryLot,
  type BlendSheetSummary,
} from "../api/client";

type AllocMap = Record<string, number>;
type Shelf = "work" | "pending" | "approved" | "history";
type LotSortKey =
  | "sale"
  | "broker"
  | "lotNumber"
  | "sellingMark"
  | "gardenMark"
  | "grade"
  | "availableQtyKg"
  | "unitCostPerKg";

const DND_TYPE = "application/x-blend-lot";

export function BlendWorkbenchPage() {
  const { blendId: routeBlendId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const initialShelf: Shelf =
    params.get("status") === "TempAllocated"
      ? "pending"
      : params.get("status") === "Confirmed"
        ? "approved"
        : params.get("view") === "history"
          ? "history"
          : "work";

  const [shelf, setShelf] = useState<Shelf>(initialShelf);
  const [sheetId, setSheetId] = useState<string | undefined>(routeBlendId);
  const [blendNumber, setBlendNumber] = useState("(new)");
  const [status, setStatus] = useState("Draft");
  const [productName, setProductName] = useState("");
  const [salesOrderRef, setSalesOrderRef] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [targetQty, setTargetQty] = useState<number>(0);
  const [targetPrice, setTargetPrice] = useState<number | "">("");
  const [targetTeaCost, setTargetTeaCost] = useState<number | "">("");
  const [currency, setCurrency] = useState("LKR");
  const [remarks, setRemarks] = useState("");
  const [preparedBy, setPreparedBy] = useState("desk");
  const [alloc, setAlloc] = useState<AllocMap>({});
  const [saleFilter, setSaleFilter] = useState("");
  const [brokerFilter, setBrokerFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [lotSortKey, setLotSortKey] = useState<LotSortKey>("sale");
  const [lotSortDir, setLotSortDir] = useState<"asc" | "desc">("asc");
  const [hydrated, setHydrated] = useState(!routeBlendId);

  const sheets = useQuery({
    queryKey: ["blends", "all"],
    queryFn: () => listBlendSheets(),
  });

  const existing = useQuery({
    queryKey: ["blend", sheetId],
    queryFn: () => getBlendSheet(sheetId!),
    enabled: Boolean(sheetId) && shelf === "work",
  });

  useEffect(() => {
    if (!existing.data || hydrated) return;
    applySheet(existing.data);
    setHydrated(true);
  }, [existing.data, hydrated]);

  function applySheet(d: {
    id: string;
    blendNumber: string;
    status: string;
    productName: string;
    salesOrderRef?: string | null;
    customerName?: string | null;
    targetQuantityKg: number;
    targetPricePerKg?: number | null;
    targetTeaCostPerKg?: number | null;
    currency: string;
    remarks?: string | null;
    preparedBy: string;
    lines: { collectionLotId: string; allocatedQtyKg: number }[];
  }) {
    setSheetId(d.id);
    setBlendNumber(d.blendNumber);
    setStatus(d.status);
    setProductName(d.productName);
    setSalesOrderRef(d.salesOrderRef || "");
    setCustomerName(d.customerName || "");
    setTargetQty(Number(d.targetQuantityKg));
    setTargetPrice(d.targetPricePerKg ?? "");
    setTargetTeaCost(d.targetTeaCostPerKg ?? "");
    setCurrency(d.currency || "LKR");
    setRemarks(d.remarks || "");
    setPreparedBy(d.preparedBy || "desk");
    const map: AllocMap = {};
    for (const line of d.lines) map[line.collectionLotId] = Number(line.allocatedQtyKg);
    setAlloc(map);
  }

  function resetNew() {
    setSheetId(undefined);
    setBlendNumber("(new)");
    setStatus("Draft");
    setProductName("");
    setSalesOrderRef("");
    setCustomerName("");
    setTargetQty(0);
    setTargetPrice("");
    setTargetTeaCost("");
    setCurrency("LKR");
    setRemarks("");
    setPreparedBy("desk");
    setAlloc({});
    setHydrated(true);
    setShelf("work");
    navigate("/blending", { replace: true });
  }

  function openSheet(row: BlendSheetSummary) {
    setHydrated(false);
    setSheetId(row.id);
    setShelf("work");
    navigate(`/blending/sheets/${row.id}`, { replace: true });
  }

  const inventory = useQuery({
    queryKey: ["blend-inventory", sheetId, saleFilter, brokerFilter, gradeFilter],
    queryFn: () =>
      listBlendInventory({
        excludeBlendSheetId: sheetId,
        saleNumber: saleFilter || undefined,
        broker: brokerFilter || undefined,
        grade: gradeFilter || undefined,
      }),
    enabled: shelf === "work" && hydrated,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      saveBlendSheet({
        id: sheetId,
        productName: productName.trim() || "Blend",
        salesOrderRef: salesOrderRef || undefined,
        customerName: customerName || undefined,
        targetQuantityKg: Number(targetQty) || 0,
        targetPricePerKg: targetPrice === "" ? null : Number(targetPrice),
        targetTeaCostPerKg: targetTeaCost === "" ? null : Number(targetTeaCost),
        currency,
        preparedBy,
        remarks: remarks || undefined,
        lines: Object.entries(alloc)
          .filter(([, qty]) => qty > 0)
          .map(([collectionLotId, allocatedQtyKg]) => ({ collectionLotId, allocatedQtyKg })),
      }),
    onSuccess: (detail) => {
      applySheet(detail);
      setHydrated(true);
      void queryClient.invalidateQueries({ queryKey: ["blends"] });
      void queryClient.invalidateQueries({ queryKey: ["blend-inventory"] });
      navigate(`/blending/sheets/${detail.id}`, { replace: true });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const saved = await saveBlendSheet({
        id: sheetId,
        productName: productName.trim() || "Blend",
        salesOrderRef: salesOrderRef || undefined,
        customerName: customerName || undefined,
        targetQuantityKg: Number(targetQty) || 0,
        targetPricePerKg: targetPrice === "" ? null : Number(targetPrice),
        targetTeaCostPerKg: targetTeaCost === "" ? null : Number(targetTeaCost),
        currency,
        preparedBy,
        remarks: remarks || undefined,
        lines: Object.entries(alloc)
          .filter(([, qty]) => qty > 0)
          .map(([collectionLotId, allocatedQtyKg]) => ({ collectionLotId, allocatedQtyKg })),
      });
      return confirmBlendSheet(saved.id);
    },
    onSuccess: (detail) => {
      applySheet(detail);
      setHydrated(true);
      void queryClient.invalidateQueries({ queryKey: ["blends"] });
      void queryClient.invalidateQueries({ queryKey: ["blend-inventory"] });
    },
  });

  const lotsById = useMemo(() => {
    const map = new Map<string, BlendInventoryLot>();
    for (const lot of inventory.data ?? []) map.set(lot.collectionLotId, lot);
    return map;
  }, [inventory.data]);

  const availableLots = useMemo(() => {
    const rows = (inventory.data ?? []).filter((lot) => !alloc[lot.collectionLotId]);
    const dir = lotSortDir === "asc" ? 1 : -1;
    const saleKey = (lot: BlendInventoryLot) =>
      `${String(lot.year).padStart(4, "0")}-${String(lot.saleNumber).padStart(4, "0")}`;
    rows.sort((a, b) => {
      let cmp = 0;
      switch (lotSortKey) {
        case "sale":
          cmp = saleKey(a).localeCompare(saleKey(b));
          break;
        case "broker":
          cmp = String(a.broker).localeCompare(String(b.broker));
          break;
        case "lotNumber":
          cmp = a.lotNumber - b.lotNumber;
          break;
        case "sellingMark":
          cmp = (a.sellingMark || a.estate || "").localeCompare(b.sellingMark || b.estate || "");
          break;
        case "gardenMark":
          cmp = (a.gardenMark || "").localeCompare(b.gardenMark || "");
          break;
        case "grade":
          cmp = (a.grade || "").localeCompare(b.grade || "");
          break;
        case "availableQtyKg":
          cmp = Number(a.availableQtyKg) - Number(b.availableQtyKg);
          break;
        case "unitCostPerKg":
          cmp = Number(a.unitCostPerKg) - Number(b.unitCostPerKg);
          break;
      }
      if (cmp === 0) cmp = a.lotNumber - b.lotNumber;
      return cmp * dir;
    });
    return rows;
  }, [inventory.data, alloc, lotSortKey, lotSortDir]);

  function toggleLotSort(key: LotSortKey) {
    if (lotSortKey === key) setLotSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setLotSortKey(key);
      setLotSortDir("asc");
    }
  }

  const composition = useMemo(() => {
    return Object.entries(alloc)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const lot = lotsById.get(id);
        const unit = lot?.unitCostPerKg ?? 0;
        return { id, lot, qty, unit, cost: qty * unit };
      });
  }, [alloc, lotsById]);

  const totalAllocated = composition.reduce((s, r) => s + r.qty, 0);
  const totalCost = composition.reduce((s, r) => s + r.cost, 0);
  const wavg = totalAllocated > 0 ? totalCost / totalAllocated : 0;
  const remainingTarget = (Number(targetQty) || 0) - totalAllocated;
  const locked = status === "Confirmed" || status === "Cancelled" || status === "Rejected";

  const allSheets = sheets.data ?? [];
  const pendingSheets = allSheets.filter((s) => s.status === "TempAllocated" || s.status === "Draft");
  const approvedSheets = allSheets.filter((s) => s.status === "Confirmed");

  function addLot(lot: BlendInventoryLot) {
    if (locked) return;
    setAlloc((current) => {
      if (current[lot.collectionLotId]) return current;
      const remain = Math.max(0, (Number(targetQty) || 0) - Object.values(current).reduce((a, b) => a + b, 0));
      const qty =
        remain > 0 ? Math.min(lot.availableQtyKg, remain) : Math.min(lot.availableQtyKg, lot.availableQtyKg);
      return { ...current, [lot.collectionLotId]: qty > 0 ? Number(qty.toFixed(3)) : Number(lot.availableQtyKg.toFixed(3)) };
    });
  }

  function removeLot(id: string) {
    if (locked) return;
    setAlloc((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function setQty(id: string, raw: string) {
    if (locked) return;
    const n = Number(raw);
    setAlloc((current) => {
      const next = { ...current };
      if (!raw || Number.isNaN(n) || n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });
  }

  const shelfRows =
    shelf === "pending" ? pendingSheets : shelf === "approved" ? approvedSheets : shelf === "history" ? allSheets : null;

  return (
    <Stack spacing={2} sx={{ minHeight: "70vh" }}>
      {/* Compact shelf / menu */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ alignItems: { md: "center" }, justifyContent: "space-between" }}
      >
        <div>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.14em" }}>
            Tea Operations · Blending
          </Typography>
          <Typography variant="h4" sx={{ lineHeight: 1.15 }}>
            Blend workbench
          </Typography>
        </div>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={shelf}
            onChange={(_, value: Shelf | null) => {
              if (!value) return;
              setShelf(value);
              if (value === "work" && !sheetId) setHydrated(true);
            }}
          >
            <ToggleButton value="work">Workbench</ToggleButton>
            <ToggleButton value="pending">Pending ({pendingSheets.length})</ToggleButton>
            <ToggleButton value="approved">Approved ({approvedSheets.length})</ToggleButton>
            <ToggleButton value="history">History</ToggleButton>
          </ToggleButtonGroup>
          <Button variant="contained" startIcon={<AddIcon />} onClick={resetNew}>
            New
          </Button>
        </Stack>
      </Stack>

      {shelf !== "work" ? (
        <Paper sx={{ overflow: "auto" }}>
          <Stack direction="row" sx={{ px: 2, py: 1.25, justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {shelf === "pending" ? "Pending approvals" : shelf === "approved" ? "Approved blends" : "Blend history"}
            </Typography>
            <Button size="small" onClick={() => setShelf("work")}>
              Back to workbench
            </Button>
          </Stack>
          <Divider />
          {sheets.isPending ? (
            <Box sx={{ p: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (shelfRows ?? []).length === 0 ? (
            <Typography sx={{ p: 3 }} color="text.secondary">
              Nothing here yet.
            </Typography>
          ) : (
            <Stack divider={<Divider />} sx={{ py: 0.5 }}>
              {(shelfRows ?? []).map((row) => (
                <Stack
                  key={row.id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{
                    px: 2,
                    py: 1.25,
                    alignItems: { sm: "center" },
                    justifyContent: "space-between",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                  onClick={() => openSheet(row)}
                >
                  <Stack spacing={0.25}>
                    <Typography sx={{ fontWeight: 700 }}>
                      {row.blendNumber} · {row.productName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.blendDate}
                      {row.salesOrderRef ? ` · SO ${row.salesOrderRef}` : ""} · target{" "}
                      {Number(row.targetQuantityKg).toFixed(2)} kg · allocated{" "}
                      {Number(row.allocatedQuantityKg).toFixed(2)} kg
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Chip size="small" label={row.status} />
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        openSheet(row);
                      }}
                    >
                      Edit
                    </Button>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </Paper>
      ) : (
        <>
          {/* Header strip */}
          <Paper
            sx={{
              p: 1.75,
              background:
                "linear-gradient(135deg, rgba(26,95,122,0.06) 0%, rgba(244,241,234,0.9) 45%, rgba(255,255,255,0.95) 100%)",
            }}
          >
            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.25} useFlexGap sx={{ flexWrap: "wrap" }}>
              <Field label="Blend No.">
                <Typography sx={{ fontWeight: 800, minWidth: 140, pt: 0.75 }}>{blendNumber}</Typography>
              </Field>
              <Field label="Status">
                <Chip size="small" label={status} sx={{ mt: 0.75 }} />
              </Field>
              <Field label="Product / Blend" grow>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="e.g. BOPF Export Blend"
                  value={productName}
                  disabled={locked}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </Field>
              <Field label="Sales Order">
                <TextField
                  size="small"
                  value={salesOrderRef}
                  disabled={locked}
                  onChange={(e) => setSalesOrderRef(e.target.value)}
                  sx={{ width: 130 }}
                />
              </Field>
              <Field label="Customer">
                <TextField
                  size="small"
                  value={customerName}
                  disabled={locked}
                  onChange={(e) => setCustomerName(e.target.value)}
                  sx={{ width: 140 }}
                />
              </Field>
              <Field label="Est. Qty kg">
                <TextField
                  size="small"
                  type="number"
                  value={targetQty}
                  disabled={locked}
                  onChange={(e) => setTargetQty(Number(e.target.value))}
                  sx={{ width: 110 }}
                />
              </Field>
              <Field label="Est. Avg Price">
                <TextField
                  size="small"
                  type="number"
                  value={targetPrice}
                  disabled={locked}
                  onChange={(e) => setTargetPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  sx={{ width: 110 }}
                />
              </Field>
              <Field label="Tea cost / kg">
                <TextField
                  size="small"
                  type="number"
                  value={targetTeaCost}
                  disabled={locked}
                  onChange={(e) => setTargetTeaCost(e.target.value === "" ? "" : Number(e.target.value))}
                  sx={{ width: 110 }}
                />
              </Field>
              <Field label="CCY">
                <TextField
                  size="small"
                  value={currency}
                  disabled={locked}
                  onChange={(e) => setCurrency(e.target.value)}
                  sx={{ width: 72 }}
                />
              </Field>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5, alignItems: { sm: "center" } }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Remarks / blend instructions"
                value={remarks}
                disabled={locked}
                onChange={(e) => setRemarks(e.target.value)}
              />
              <Button variant="outlined" disabled={locked || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="contained"
                disabled={locked || confirmMutation.isPending || totalAllocated <= 0}
                onClick={() => confirmMutation.mutate()}
              >
                {confirmMutation.isPending ? "Confirming…" : "Confirm"}
              </Button>
            </Stack>
            {(saveMutation.isError || confirmMutation.isError) && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {saveMutation.error?.message || confirmMutation.error?.message}
              </Alert>
            )}
          </Paper>

          {/* Live totals */}
          <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
            <MiniStat label="Allocated" value={`${totalAllocated.toFixed(2)} kg`} />
            <MiniStat label="To target" value={`${remainingTarget.toFixed(2)} kg`} tone={Math.abs(remainingTarget) < 0.001 ? "ok" : "warn"} />
            <MiniStat label="WAVG cost" value={wavg.toFixed(2)} />
            <MiniStat label="Raw tea cost" value={totalCost.toFixed(2)} />
            <MiniStat
              label="Lots in blend"
              value={String(composition.length)}
            />
          </Stack>

          {/* Split workbench */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.45fr) minmax(0, 1fr)" },
              gap: 2,
              alignItems: "stretch",
              minHeight: 520,
            }}
          >
            {/* Left: available grid */}
            <Paper sx={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <Box sx={{ px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Available lots
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Sort columns to find lots · drag the handle into the blend box
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                  <TextField size="small" label="Sale" value={saleFilter} onChange={(e) => setSaleFilter(e.target.value)} sx={{ width: 90 }} />
                  <TextField size="small" label="Broker" value={brokerFilter} onChange={(e) => setBrokerFilter(e.target.value)} sx={{ width: 90 }} />
                  <TextField size="small" label="Type / grade" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} sx={{ width: 120 }} />
                </Stack>
              </Box>
              <Box sx={{ overflow: "auto", flex: 1 }}>
                {inventory.isPending ? (
                  <Box sx={{ p: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : inventory.isError ? (
                  <Alert severity="error" sx={{ m: 1 }}>
                    {inventory.error.message}
                  </Alert>
                ) : availableLots.length === 0 ? (
                  <Typography sx={{ p: 2 }} color="text.secondary" variant="body2">
                    No available collected lots. Mark boxes collected first, or clear filters.
                  </Typography>
                ) : (
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell padding="checkbox" />
                        <TableCell>
                          <TableSortLabel active={lotSortKey === "sale"} direction={lotSortKey === "sale" ? lotSortDir : "asc"} onClick={() => toggleLotSort("sale")}>
                            Sale
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel active={lotSortKey === "broker"} direction={lotSortKey === "broker" ? lotSortDir : "asc"} onClick={() => toggleLotSort("broker")}>
                            Broker
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right">
                          <TableSortLabel active={lotSortKey === "lotNumber"} direction={lotSortKey === "lotNumber" ? lotSortDir : "asc"} onClick={() => toggleLotSort("lotNumber")}>
                            Lot
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel active={lotSortKey === "sellingMark"} direction={lotSortKey === "sellingMark" ? lotSortDir : "asc"} onClick={() => toggleLotSort("sellingMark")}>
                            Estate marking
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel active={lotSortKey === "gardenMark"} direction={lotSortKey === "gardenMark" ? lotSortDir : "asc"} onClick={() => toggleLotSort("gardenMark")}>
                            Garden
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>
                          <TableSortLabel active={lotSortKey === "grade"} direction={lotSortKey === "grade" ? lotSortDir : "asc"} onClick={() => toggleLotSort("grade")}>
                            Type of tea
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right">
                          <TableSortLabel active={lotSortKey === "availableQtyKg"} direction={lotSortKey === "availableQtyKg" ? lotSortDir : "asc"} onClick={() => toggleLotSort("availableQtyKg")}>
                            Avail kg
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right">
                          <TableSortLabel active={lotSortKey === "unitCostPerKg"} direction={lotSortKey === "unitCostPerKg" ? lotSortDir : "asc"} onClick={() => toggleLotSort("unitCostPerKg")}>
                            Cost/kg
                          </TableSortLabel>
                        </TableCell>
                        <TableCell padding="checkbox" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {availableLots.map((lot) => {
                        const dragging = draggingId === lot.collectionLotId;
                        return (
                          <TableRow
                            key={lot.collectionLotId}
                            hover
                            draggable={!locked}
                            onDragStart={(e) => {
                              e.dataTransfer.setData(DND_TYPE, lot.collectionLotId);
                              e.dataTransfer.effectAllowed = "copy";
                              setDraggingId(lot.collectionLotId);
                            }}
                            onDragEnd={() => setDraggingId(null)}
                            sx={{
                              cursor: locked ? "default" : "grab",
                              opacity: dragging ? 0.45 : 1,
                              bgcolor: dragging ? "action.selected" : undefined,
                              "&:active": { cursor: locked ? "default" : "grabbing" },
                            }}
                          >
                            <TableCell padding="checkbox" sx={{ color: "text.secondary" }}>
                              <DragIndicatorIcon fontSize="small" />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                              {lot.saleNumber}/{lot.year}
                            </TableCell>
                            <TableCell>{lot.broker}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {lot.lotNumber}
                            </TableCell>
                            <TableCell sx={{ minWidth: 110 }}>{lot.sellingMark || lot.estate || "—"}</TableCell>
                            <TableCell sx={{ minWidth: 100 }}>{lot.gardenMark || "—"}</TableCell>
                            <TableCell>{lot.grade || "—"}</TableCell>
                            <TableCell align="right">{Number(lot.availableQtyKg).toFixed(2)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              {Number(lot.unitCostPerKg).toFixed(2)}
                            </TableCell>
                            <TableCell padding="checkbox">
                              <IconButton size="small" disabled={locked} aria-label="Add lot" onClick={() => addLot(lot)}>
                                <AddIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Box>
            </Paper>

            {/* Right: composition drop zone */}
            <Paper
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                setDropActive(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDropActive(true);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDropActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDropActive(false);
                setDraggingId(null);
                const id = e.dataTransfer.getData(DND_TYPE);
                const lot = lotsById.get(id);
                if (lot) addLot(lot);
              }}
              sx={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                border: dropActive ? "2px solid" : "1px solid",
                borderColor: dropActive ? "primary.main" : "divider",
                boxShadow: dropActive ? "0 0 0 4px rgba(26,95,122,0.12)" : undefined,
                bgcolor: dropActive ? "rgba(26,95,122,0.06)" : "background.paper",
                transition: "border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease",
              }}
            >
              <Box sx={{ px: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Blend box {dropActive ? "· drop to add" : ""}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Drop lots here · edit allocated kg · remainder stays available for other blends
                </Typography>
              </Box>
              <Box sx={{ overflow: "auto", flex: 1, p: 1 }}>
                {composition.length === 0 ? (
                  <Box
                    sx={{
                      m: 1,
                      minHeight: 220,
                      p: 4,
                      border: "2px dashed",
                      borderColor: dropActive ? "primary.main" : "divider",
                      borderRadius: 2,
                      textAlign: "center",
                      color: "text.secondary",
                      display: "grid",
                      placeContent: "center",
                      gap: 0.5,
                      bgcolor: dropActive ? "rgba(26,95,122,0.04)" : "transparent",
                    }}
                  >
                    <DragIndicatorIcon sx={{ mx: "auto", opacity: 0.5 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {dropActive ? "Release to add lot" : "Drag lots from the left grid"}
                    </Typography>
                    <Typography variant="caption">Or use the + button on a row</Typography>
                  </Box>
                ) : (
                  <Stack spacing={0.75}>
                    {composition.map((row) => (
                      <Paper key={row.id} variant="outlined" sx={{ p: 1.25 }}>
                        <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "center" }}>
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              {row.lot
                                ? `${row.lot.saleNumber}/${row.lot.year} · ${row.lot.broker} · Lot ${row.lot.lotNumber}`
                                : row.id}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.lot?.sellingMark || row.lot?.estate || "—"} · {row.lot?.gardenMark || "—"} ·{" "}
                              {row.lot?.grade || "—"} ·{" "}
                              {totalAllocated > 0 ? ((row.qty / totalAllocated) * 100).toFixed(1) : "0"}% ·{" "}
                              {row.unit.toFixed(2)}/kg
                            </Typography>
                          </Box>
                          <TextField
                            size="small"
                            type="number"
                            label="kg"
                            value={row.qty}
                            disabled={locked}
                            onChange={(e) => setQty(row.id, e.target.value)}
                            sx={{ width: 100 }}
                            slotProps={{ htmlInput: { min: 0, step: "0.001" } }}
                          />
                          <IconButton size="small" disabled={locked} aria-label="Remove lot" onClick={() => removeLot(row.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>
            </Paper>
          </Box>

          <Button component={RouterLink} to="/collections" size="small" sx={{ alignSelf: "flex-start" }}>
            Back to collection
          </Button>
        </>
      )}
    </Stack>
  );
}

function Field({
  label,
  children,
  grow,
}: {
  label: string;
  children: ReactNode;
  grow?: boolean;
}) {
  return (
    <Box sx={{ flex: grow ? "1 1 200px" : undefined, minWidth: grow ? 180 : undefined }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: 1.5,
        py: 1,
        minWidth: 110,
        borderColor: tone === "ok" ? "success.light" : tone === "warn" ? "warning.light" : "divider",
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
        {value}
      </Typography>
    </Paper>
  );
}

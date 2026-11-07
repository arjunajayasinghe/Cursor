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
import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
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

type ColKey =
  | "drag"
  | "sale"
  | "broker"
  | "lot"
  | "sellingMark"
  | "gardenMark"
  | "grade"
  | "avail"
  | "cost"
  | "alloc"
  | "pct"
  | "action";

const DND_TYPE = "application/x-blend-lot";

const DEFAULT_LEFT_COLS: Record<ColKey, number> = {
  drag: 28,
  sale: 62,
  broker: 46,
  lot: 44,
  sellingMark: 118,
  gardenMark: 108,
  grade: 68,
  avail: 82,
  cost: 64,
  alloc: 0,
  pct: 0,
  action: 34,
};

const DEFAULT_RIGHT_COLS: Record<ColKey, number> = {
  drag: 0,
  sale: 58,
  broker: 42,
  lot: 42,
  sellingMark: 100,
  gardenMark: 90,
  grade: 58,
  avail: 0,
  cost: 58,
  alloc: 78,
  pct: 48,
  action: 34,
};

const RESIZE_COLS: ColKey[] = ["sale", "broker", "lot", "sellingMark", "gardenMark", "grade", "avail", "cost", "alloc", "pct"];

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
  const [leftCols, setLeftCols] = useState(DEFAULT_LEFT_COLS);
  const [rightCols, setRightCols] = useState(DEFAULT_RIGHT_COLS);
  const [allocHint, setAllocHint] = useState<string | null>(null);
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

  const remainingOf = useCallback(
    (lot: BlendInventoryLot) => Math.max(0, Number(lot.availableQtyKg) - (alloc[lot.collectionLotId] || 0)),
    [alloc],
  );

  const availableLots = useMemo(() => {
    // Keep lots with remainder on the left when only part is in the blend box.
    const rows = (inventory.data ?? [])
      .map((lot) => ({ lot, remain: remainingOf(lot) }))
      .filter((x) => x.remain > 0.0005)
      .map((x) => x.lot);
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
          cmp = remainingOf(a) - remainingOf(b);
          break;
        case "unitCostPerKg":
          cmp = Number(a.unitCostPerKg) - Number(b.unitCostPerKg);
          break;
      }
      if (cmp === 0) cmp = a.lotNumber - b.lotNumber;
      return cmp * dir;
    });
    return rows;
  }, [inventory.data, remainingOf, lotSortKey, lotSortDir]);

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
        const max = lot ? Number(lot.availableQtyKg) : qty;
        return { id, lot, qty, unit, cost: qty * unit, max };
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
    const est = Number(targetQty) || 0;
    if (est <= 0) {
      setAllocHint("Set Est. Qty first — we only pull what the blend still needs from each lot.");
      return;
    }

    const already = alloc[lot.collectionLotId] || 0;
    const lotRemain = Math.max(0, Number(lot.availableQtyKg) - already);
    if (lotRemain <= 0.0005) {
      setAllocHint("No remaining kg on this lot.");
      return;
    }

    const used = Object.values(alloc).reduce((a, b) => a + b, 0);
    const need = Math.max(0, est - used);
    if (need <= 0.0005) {
      setAllocHint("Est. Qty already covered — raise Est. Qty or reduce Alloc kg to take more.");
      return;
    }

    // Required < lot size → take only the need; leftover stays on the left.
    const chunk = Math.min(lotRemain, need);
    const leftover = Number((lotRemain - chunk).toFixed(3));
    setAlloc((current) => ({
      ...current,
      [lot.collectionLotId]: Number(((current[lot.collectionLotId] || 0) + chunk).toFixed(3)),
    }));
    setAllocHint(
      leftover > 0.0005
        ? `Took ${chunk.toFixed(2)} kg of ${lotRemain.toFixed(2)} kg from lot ${lot.lotNumber} (to Est. Qty). ${leftover.toFixed(2)} kg stays available.`
        : `Took ${chunk.toFixed(2)} kg from lot ${lot.lotNumber} (full remainder used).`,
    );
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
    const max = lotsById.get(id)?.availableQtyKg ?? n;
    setAlloc((current) => {
      const next = { ...current };
      if (!raw || Number.isNaN(n) || n <= 0) delete next[id];
      else next[id] = Number(Math.min(n, Number(max)).toFixed(3));
      return next;
    });
  }

  function startColResize(
    side: "left" | "right",
    key: ColKey,
    event: ReactMouseEvent,
  ) {
    if (!RESIZE_COLS.includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startW = side === "left" ? leftCols[key] : rightCols[key];
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(36, Math.min(280, startW + (ev.clientX - startX)));
      if (side === "left") setLeftCols((c) => ({ ...c, [key]: next }));
      else setRightCols((c) => ({ ...c, [key]: next }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
          {allocHint && (
            <Alert severity="info" onClose={() => setAllocHint(null)} sx={{ py: 0 }}>
              {allocHint}
            </Alert>
          )}

          {/* Split workbench */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.85fr) minmax(320px, 1fr)" },
              gap: 1.5,
              alignItems: "stretch",
              minHeight: 580,
              flex: 1,
            }}
          >
            {/* Left: available grid */}
            <Paper sx={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 520 }}>
              <Box sx={{ px: 1.5, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  Available lots
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Drag / + takes only what’s still needed for Est. Qty · leftover Remain kg stays here
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                  <TextField size="small" label="Sale" value={saleFilter} onChange={(e) => setSaleFilter(e.target.value)} sx={{ width: 84 }} />
                  <TextField size="small" label="Broker" value={brokerFilter} onChange={(e) => setBrokerFilter(e.target.value)} sx={{ width: 84 }} />
                  <TextField size="small" label="Type / grade" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} sx={{ width: 110 }} />
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
                  <Table
                    size="small"
                    stickyHeader
                    sx={{
                      tableLayout: "fixed",
                      width: Object.values(leftCols).reduce((a, b) => a + b, 0),
                      minWidth: "100%",
                      "& .MuiTableCell-root": {
                        fontSize: "0.72rem",
                        py: 0.35,
                        px: 0.6,
                        lineHeight: 1.25,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      },
                      "& .MuiTableSortLabel-root": { fontSize: "0.68rem" },
                    }}
                  >
                    <TableHead>
                      <TableRow>
                        <ResizeHead width={leftCols.drag} />
                        <ResizeHead width={leftCols.sale} colKey="sale" onResize={(e, k) => startColResize("left", k, e)}>
                          <TableSortLabel active={lotSortKey === "sale"} direction={lotSortKey === "sale" ? lotSortDir : "asc"} onClick={() => toggleLotSort("sale")}>
                            Sale
                          </TableSortLabel>
                        </ResizeHead>
                        <ResizeHead width={leftCols.broker} colKey="broker" onResize={(e, k) => startColResize("left", k, e)}>
                          <TableSortLabel active={lotSortKey === "broker"} direction={lotSortKey === "broker" ? lotSortDir : "asc"} onClick={() => toggleLotSort("broker")}>
                            Broker
                          </TableSortLabel>
                        </ResizeHead>
                        <ResizeHead width={leftCols.lot} align="right" colKey="lot" onResize={(e, k) => startColResize("left", k, e)}>
                          <TableSortLabel active={lotSortKey === "lotNumber"} direction={lotSortKey === "lotNumber" ? lotSortDir : "asc"} onClick={() => toggleLotSort("lotNumber")}>
                            Lot
                          </TableSortLabel>
                        </ResizeHead>
                        <ResizeHead width={leftCols.sellingMark} colKey="sellingMark" onResize={(e, k) => startColResize("left", k, e)}>
                          <TableSortLabel active={lotSortKey === "sellingMark"} direction={lotSortKey === "sellingMark" ? lotSortDir : "asc"} onClick={() => toggleLotSort("sellingMark")}>
                            Estate marking
                          </TableSortLabel>
                        </ResizeHead>
                        <ResizeHead width={leftCols.gardenMark} colKey="gardenMark" onResize={(e, k) => startColResize("left", k, e)}>
                          <TableSortLabel active={lotSortKey === "gardenMark"} direction={lotSortKey === "gardenMark" ? lotSortDir : "asc"} onClick={() => toggleLotSort("gardenMark")}>
                            Garden
                          </TableSortLabel>
                        </ResizeHead>
                        <ResizeHead width={leftCols.grade} colKey="grade" onResize={(e, k) => startColResize("left", k, e)}>
                          <TableSortLabel active={lotSortKey === "grade"} direction={lotSortKey === "grade" ? lotSortDir : "asc"} onClick={() => toggleLotSort("grade")}>
                            Type of tea
                          </TableSortLabel>
                        </ResizeHead>
                        <ResizeHead width={leftCols.avail} align="right" colKey="avail" onResize={(e, k) => startColResize("left", k, e)}>
                          <TableSortLabel active={lotSortKey === "availableQtyKg"} direction={lotSortKey === "availableQtyKg" ? lotSortDir : "asc"} onClick={() => toggleLotSort("availableQtyKg")}>
                            Remain kg
                          </TableSortLabel>
                        </ResizeHead>
                        <ResizeHead width={leftCols.cost} align="right" colKey="cost" onResize={(e, k) => startColResize("left", k, e)}>
                          <TableSortLabel active={lotSortKey === "unitCostPerKg"} direction={lotSortKey === "unitCostPerKg" ? lotSortDir : "asc"} onClick={() => toggleLotSort("unitCostPerKg")}>
                            Cost/kg
                          </TableSortLabel>
                        </ResizeHead>
                        <ResizeHead width={leftCols.action} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {availableLots.map((lot) => {
                        const dragging = draggingId === lot.collectionLotId;
                        const remain = remainingOf(lot);
                        const inBlend = (alloc[lot.collectionLotId] || 0) > 0;
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
                              bgcolor: dragging ? "action.selected" : inBlend ? "rgba(26,95,122,0.04)" : undefined,
                              "&:active": { cursor: locked ? "default" : "grabbing" },
                            }}
                          >
                            <TableCell sx={{ width: leftCols.drag, color: "text.secondary" }}>
                              <DragIndicatorIcon sx={{ fontSize: 16 }} />
                            </TableCell>
                            <TableCell sx={{ width: leftCols.sale, fontWeight: 700 }}>
                              {lot.saleNumber}/{lot.year}
                            </TableCell>
                            <TableCell sx={{ width: leftCols.broker }}>{lot.broker}</TableCell>
                            <TableCell align="right" sx={{ width: leftCols.lot, fontWeight: 700 }}>
                              {lot.lotNumber}
                            </TableCell>
                            <TableCell sx={{ width: leftCols.sellingMark }} title={lot.sellingMark || lot.estate || ""}>
                              {lot.sellingMark || lot.estate || "—"}
                            </TableCell>
                            <TableCell sx={{ width: leftCols.gardenMark }} title={lot.gardenMark || ""}>
                              {lot.gardenMark || "—"}
                            </TableCell>
                            <TableCell sx={{ width: leftCols.grade }}>{lot.grade || "—"}</TableCell>
                            <TableCell align="right" sx={{ width: leftCols.avail, fontWeight: inBlend ? 700 : 400 }}>
                              {remain.toFixed(2)}
                            </TableCell>
                            <TableCell align="right" sx={{ width: leftCols.cost, fontWeight: 600 }}>
                              {Number(lot.unitCostPerKg).toFixed(2)}
                            </TableCell>
                            <TableCell sx={{ width: leftCols.action }}>
                              <IconButton size="small" disabled={locked} aria-label="Add lot" onClick={() => addLot(lot)}>
                                <AddIcon sx={{ fontSize: 16 }} />
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

            {/* Right: composition grid */}
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
                minHeight: 520,
                border: dropActive ? "2px solid" : "1px solid",
                borderColor: dropActive ? "primary.main" : "divider",
                boxShadow: dropActive ? "0 0 0 4px rgba(26,95,122,0.12)" : undefined,
                bgcolor: dropActive ? "rgba(26,95,122,0.06)" : "background.paper",
                transition: "border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease",
              }}
            >
              <Box sx={{ px: 1.5, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: "0.95rem" }}>
                  Blend box {dropActive ? "· drop to add" : ""}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Same columns · edit Alloc kg up to lot max · unused kg stays on the left
                </Typography>
              </Box>
              <Box sx={{ overflow: "auto", flex: 1 }}>
                {composition.length === 0 ? (
                  <Box
                    sx={{
                      m: 1.25,
                      minHeight: 260,
                      p: 3,
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
                  <Table
                    size="small"
                    stickyHeader
                    sx={{
                      tableLayout: "fixed",
                      width: Object.values(rightCols).reduce((a, b) => a + b, 0),
                      minWidth: "100%",
                      "& .MuiTableCell-root": {
                        fontSize: "0.72rem",
                        py: 0.4,
                        px: 0.55,
                        lineHeight: 1.25,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      },
                    }}
                  >
                    <TableHead>
                      <TableRow>
                        <ResizeHead width={rightCols.sale} colKey="sale" onResize={(e, k) => startColResize("right", k, e)}>
                          Sale
                        </ResizeHead>
                        <ResizeHead width={rightCols.broker} colKey="broker" onResize={(e, k) => startColResize("right", k, e)}>
                          Broker
                        </ResizeHead>
                        <ResizeHead width={rightCols.lot} align="right" colKey="lot" onResize={(e, k) => startColResize("right", k, e)}>
                          Lot
                        </ResizeHead>
                        <ResizeHead width={rightCols.sellingMark} colKey="sellingMark" onResize={(e, k) => startColResize("right", k, e)}>
                          Estate marking
                        </ResizeHead>
                        <ResizeHead width={rightCols.gardenMark} colKey="gardenMark" onResize={(e, k) => startColResize("right", k, e)}>
                          Garden
                        </ResizeHead>
                        <ResizeHead width={rightCols.grade} colKey="grade" onResize={(e, k) => startColResize("right", k, e)}>
                          Type of tea
                        </ResizeHead>
                        <ResizeHead width={rightCols.alloc} align="right" colKey="alloc" onResize={(e, k) => startColResize("right", k, e)}>
                          Alloc kg
                        </ResizeHead>
                        <ResizeHead width={rightCols.pct} align="right" colKey="pct" onResize={(e, k) => startColResize("right", k, e)}>
                          %
                        </ResizeHead>
                        <ResizeHead width={rightCols.cost} align="right" colKey="cost" onResize={(e, k) => startColResize("right", k, e)}>
                          Cost/kg
                        </ResizeHead>
                        <ResizeHead width={rightCols.action} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {composition.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell sx={{ width: rightCols.sale, fontWeight: 700 }}>
                            {row.lot ? `${row.lot.saleNumber}/${row.lot.year}` : "—"}
                          </TableCell>
                          <TableCell sx={{ width: rightCols.broker }}>{row.lot?.broker || "—"}</TableCell>
                          <TableCell align="right" sx={{ width: rightCols.lot, fontWeight: 700 }}>
                            {row.lot?.lotNumber ?? "—"}
                          </TableCell>
                          <TableCell sx={{ width: rightCols.sellingMark }} title={row.lot?.sellingMark || row.lot?.estate || ""}>
                            {row.lot?.sellingMark || row.lot?.estate || "—"}
                          </TableCell>
                          <TableCell sx={{ width: rightCols.gardenMark }} title={row.lot?.gardenMark || ""}>
                            {row.lot?.gardenMark || "—"}
                          </TableCell>
                          <TableCell sx={{ width: rightCols.grade }}>{row.lot?.grade || "—"}</TableCell>
                          <TableCell align="right" sx={{ width: rightCols.alloc }}>
                            <TextField
                              size="small"
                              type="number"
                              value={row.qty}
                              disabled={locked}
                              onChange={(e) => setQty(row.id, e.target.value)}
                              sx={{
                                width: Math.max(64, rightCols.alloc - 8),
                                "& .MuiInputBase-input": { fontSize: "0.72rem", py: 0.4, px: 0.6, textAlign: "right" },
                              }}
                              slotProps={{ htmlInput: { min: 0, max: row.max, step: "0.001" } }}
                            />
                          </TableCell>
                          <TableCell align="right" sx={{ width: rightCols.pct }}>
                            {totalAllocated > 0 ? ((row.qty / totalAllocated) * 100).toFixed(1) : "0"}
                          </TableCell>
                          <TableCell align="right" sx={{ width: rightCols.cost, fontWeight: 600 }}>
                            {row.unit.toFixed(2)}
                          </TableCell>
                          <TableCell sx={{ width: rightCols.action }}>
                            <IconButton size="small" disabled={locked} aria-label="Remove lot" onClick={() => removeLot(row.id)}>
                              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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

function ResizeHead({
  width,
  children,
  align,
  colKey,
  onResize,
}: {
  width: number;
  children?: ReactNode;
  align?: "right" | "left" | "center";
  colKey?: ColKey;
  onResize?: (event: ReactMouseEvent, key: ColKey) => void;
}) {
  return (
    <TableCell
      align={align}
      sx={{
        width,
        position: "relative",
        userSelect: "none",
        bgcolor: "background.paper",
      }}
    >
      {children}
      {colKey && onResize ? (
        <Box
          onMouseDown={(e) => onResize(e, colKey)}
          sx={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 6,
            height: "100%",
            cursor: "col-resize",
            "&:hover": { bgcolor: "primary.light", opacity: 0.45 },
          }}
        />
      ) : null}
    </TableCell>
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

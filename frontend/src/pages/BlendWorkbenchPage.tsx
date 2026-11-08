import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import BalanceIcon from "@mui/icons-material/Balance";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import HistoryIcon from "@mui/icons-material/History";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import { Fragment, useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  confirmBlendSheet,
  getBlendSheet,
  listBlendInventory,
  listBlendSheets,
  saveBlendSheet,
  type BlendInventoryLot,
  type BlendSheetDetail,
  type BlendSheetSummary,
} from "../api/client";

type AllocMap = Record<string, number>;
type LocalOption = { key: string; label: string; alloc: AllocMap };
type Shelf = "work" | "pending" | "approved" | "history";

function emptyOptions(): LocalOption[] {
  return [{ key: "A", label: "Option A", alloc: {} }];
}

function nextOptionKey(existing: LocalOption[]) {
  const used = new Set(existing.map((o) => o.key));
  for (const letter of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    if (!used.has(letter)) return letter;
  }
  return `O${existing.length + 1}`;
}

function optionStats(alloc: AllocMap, lotsById: Map<string, BlendInventoryLot>, targetQty: number, targetPrice: number | "") {
  const rows = Object.entries(alloc)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const lot = lotsById.get(id);
      const unit = lot?.unitCostPerKg ?? 0;
      return { id, lot, qty, unit, cost: qty * unit };
    });
  const allocated = rows.reduce((s, r) => s + r.qty, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const wavg = allocated > 0 ? totalCost / allocated : 0;
  const remaining = (Number(targetQty) || 0) - allocated;
  const target = targetPrice === "" ? null : Number(targetPrice);
  const variance = target == null ? null : wavg - target;
  const spread = target == null ? null : target * allocated - totalCost;
  return { rows, allocated, totalCost, wavg, remaining, variance, spread };
}

type LotSortKey =
  | "sale"
  | "broker"
  | "lotNumber"
  | "sellingMark"
  | "gardenMark"
  | "grade"
  | "physicalStockKg"
  | "reservedQtyKg"
  | "availableQtyKg"
  | "unitCostPerKg";

type ColKey =
  | "expand"
  | "drag"
  | "sale"
  | "broker"
  | "lot"
  | "sellingMark"
  | "gardenMark"
  | "grade"
  | "physical"
  | "reserved"
  | "avail"
  | "cost"
  | "alloc"
  | "pct"
  | "amount"
  | "action";

const DND_TYPE = "application/x-blend-lot";

const DEFAULT_LEFT_COLS: Record<ColKey, number> = {
  expand: 28,
  drag: 26,
  sale: 58,
  broker: 44,
  lot: 42,
  sellingMark: 110,
  gardenMark: 96,
  grade: 62,
  physical: 70,
  reserved: 68,
  avail: 70,
  cost: 60,
  alloc: 0,
  pct: 0,
  amount: 0,
  action: 32,
};

const DEFAULT_RIGHT_COLS: Record<ColKey, number> = {
  expand: 0,
  drag: 0,
  sale: 54,
  broker: 40,
  lot: 40,
  sellingMark: 96,
  gardenMark: 86,
  grade: 54,
  physical: 0,
  reserved: 0,
  avail: 0,
  cost: 56,
  alloc: 72,
  pct: 44,
  amount: 78,
  action: 32,
};

const RESIZE_COLS: ColKey[] = [
  "sale",
  "broker",
  "lot",
  "sellingMark",
  "gardenMark",
  "grade",
  "physical",
  "reserved",
  "avail",
  "cost",
  "alloc",
  "pct",
  "amount",
];

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
  const [options, setOptions] = useState<LocalOption[]>(emptyOptions);
  const [activeOptionKey, setActiveOptionKey] = useState("A");
  const [compareOpen, setCompareOpen] = useState(false);
  const [workTab, setWorkTab] = useState<"options" | "tasting" | "cost" | "notes">("options");
  const [headerMenuEl, setHeaderMenuEl] = useState<null | HTMLElement>(null);
  const [editingHeader, setEditingHeader] = useState(false);
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
  const [expandedLots, setExpandedLots] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(!routeBlendId);

  const activeOption = options.find((o) => o.key === activeOptionKey) ?? options[0];
  const alloc = activeOption?.alloc ?? {};

  function patchActiveAlloc(updater: (current: AllocMap) => AllocMap) {
    setOptions((prev) =>
      prev.map((o) => (o.key === activeOptionKey ? { ...o, alloc: updater(o.alloc) } : o)),
    );
  }

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

  function applySheet(d: BlendSheetDetail) {
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
    const loaded: LocalOption[] =
      d.options && d.options.length > 0
        ? d.options.map((opt) => {
            const map: AllocMap = {};
            for (const line of opt.lines) map[line.collectionLotId] = Number(line.allocatedQtyKg);
            return { key: opt.key, label: opt.label || `Option ${opt.key}`, alloc: map };
          })
        : [
            (() => {
              const map: AllocMap = {};
              for (const line of d.lines) map[line.collectionLotId] = Number(line.allocatedQtyKg);
              return { key: d.activeOptionKey || "A", label: `Option ${d.activeOptionKey || "A"}`, alloc: map };
            })(),
          ];
    setOptions(loaded.length ? loaded : emptyOptions());
    setActiveOptionKey(d.activeOptionKey || loaded[0]?.key || "A");
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
    setOptions(emptyOptions());
    setActiveOptionKey("A");
    setCompareOpen(false);
    setAllocHint(null);
    setHydrated(true);
    setShelf("work");
    navigate("/blending", { replace: true });
  }

  function buildSavePayload() {
    return {
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
      activeOptionKey,
      options: options.map((o) => ({
        key: o.key,
        label: o.label,
        lines: Object.entries(o.alloc)
          .filter(([, qty]) => qty > 0)
          .map(([collectionLotId, allocatedQtyKg]) => ({
            collectionLotId,
            allocatedQtyKg,
            optionKey: o.key,
          })),
      })),
    };
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
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    refetchOnWindowFocus: true,
  });

  const saveMutation = useMutation({
    mutationFn: () => saveBlendSheet(buildSavePayload()),
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
      const saved = await saveBlendSheet(buildSavePayload());
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
        case "physicalStockKg":
          cmp = Number(a.physicalStockKg) - Number(b.physicalStockKg);
          break;
        case "reservedQtyKg":
          cmp = Number(a.reservedQtyKg) - Number(b.reservedQtyKg);
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
  const targetQtyNum = Number(targetQty) || 0;
  const completionPct = targetQtyNum > 0 ? Math.min(100, (totalAllocated / targetQtyNum) * 100) : 0;
  const targetPriceNum = targetPrice === "" ? null : Number(targetPrice);
  const costVariance = targetPriceNum == null ? null : wavg - targetPriceNum;
  const costVariancePct =
    targetPriceNum != null && targetPriceNum > 0 && costVariance != null
      ? (costVariance / targetPriceNum) * 100
      : null;
  const estBlendValue = targetPriceNum == null ? null : targetPriceNum * totalAllocated;
  const grossSpread = estBlendValue == null ? null : estBlendValue - totalCost;
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
    patchActiveAlloc((current) => ({
      ...current,
      [lot.collectionLotId]: Number(((current[lot.collectionLotId] || 0) + chunk).toFixed(3)),
    }));
    setAllocHint(
      leftover > 0.0005
        ? `Option ${activeOptionKey}: took ${chunk.toFixed(2)} kg of ${lotRemain.toFixed(2)} kg from lot ${lot.lotNumber}. ${leftover.toFixed(2)} kg stays available.`
        : `Option ${activeOptionKey}: took ${chunk.toFixed(2)} kg from lot ${lot.lotNumber} (full remainder used).`,
    );
  }

  function removeLot(id: string) {
    if (locked) return;
    patchActiveAlloc((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function setQty(id: string, raw: string) {
    if (locked) return;
    const n = Number(raw);
    const max = lotsById.get(id)?.availableQtyKg ?? n;
    patchActiveAlloc((current) => {
      const next = { ...current };
      if (!raw || Number.isNaN(n) || n <= 0) delete next[id];
      else next[id] = Number(Math.min(n, Number(max)).toFixed(3));
      return next;
    });
  }

  function clearActiveOption() {
    if (locked) return;
    patchActiveAlloc(() => ({}));
    setAllocHint(`Cleared Option ${activeOptionKey}.`);
  }

  function autoBalanceActive() {
    if (locked) return;
    const est = Number(targetQty) || 0;
    if (est <= 0) {
      setAllocHint("Set Est. Qty before Auto Balance.");
      return;
    }
    const ids = Object.keys(alloc).filter((id) => (alloc[id] || 0) > 0 || lotsById.has(id));
    const inBlend = Object.keys(alloc).filter((id) => (alloc[id] || 0) > 0);
    if (inBlend.length === 0) {
      setAllocHint("Add lots to the blend box first, then Auto Balance.");
      return;
    }
    const caps = inBlend.map((id) => ({
      id,
      max: Number(lotsById.get(id)?.availableQtyKg ?? alloc[id] ?? 0),
    }));
    const totalCap = caps.reduce((s, c) => s + c.max, 0);
    if (totalCap <= 0) return;
    const need = Math.min(est, totalCap);
    // Proportional to max available, then fix rounding on last row.
    let remaining = need;
    const next: AllocMap = {};
    caps.forEach((c, idx) => {
      if (idx === caps.length - 1) {
        next[c.id] = Number(Math.min(c.max, remaining).toFixed(3));
      } else {
        const share = Number(((need * c.max) / totalCap).toFixed(3));
        const qty = Math.min(c.max, share);
        next[c.id] = qty;
        remaining = Number((remaining - qty).toFixed(3));
      }
    });
    patchActiveAlloc(() => next);
    setAllocHint(`Option ${activeOptionKey}: auto-balanced to ${need.toFixed(2)} kg across ${caps.length} lots.`);
    void ids;
  }

  function addOption() {
    if (locked) return;
    if (options.length >= 12) {
      setAllocHint("Maximum 12 options on one blend sheet.");
      return;
    }
    const key = nextOptionKey(options);
    setOptions((prev) => [...prev, { key, label: `Option ${key}`, alloc: {} }]);
    setActiveOptionKey(key);
    setAllocHint(`Added Option ${key}. Build an alternate composition to compare.`);
  }

  function removeOption(key: string) {
    if (locked || options.length <= 1) return;
    const next = options.filter((o) => o.key !== key);
    setOptions(next);
    if (activeOptionKey === key) setActiveOptionKey(next[0].key);
  }

  function duplicateActiveOption() {
    if (locked) return;
    const key = nextOptionKey(options);
    const source = activeOption;
    setOptions((prev) => [...prev, { key, label: `Option ${key}`, alloc: { ...source.alloc } }]);
    setActiveOptionKey(key);
    setAllocHint(`Duplicated Option ${source.key} → Option ${key}.`);
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
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: "0.12em" }}>
            Tea Operations › Blending › Blend Workbench
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <LayersOutlinedIcon sx={{ color: "primary.main", fontSize: 28 }} />
            <Typography variant="h4" sx={{ lineHeight: 1.15 }}>
              Blend Workbench
            </Typography>
          </Stack>
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
          <Button
            size="small"
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => setShelf("history")}
          >
            History
          </Button>
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
          {/* Header info bar (mockup-style) */}
          <Paper
            elevation={0}
            sx={{
              px: 2,
              py: 1.35,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={{ xs: 1.25, md: 0 }}
              sx={{ alignItems: { md: "center" }, justifyContent: "space-between", gap: { md: 0 } }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={0}
                divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" }, mx: 2 }} />}
                sx={{ flexWrap: "wrap", alignItems: { sm: "stretch" }, flex: 1, minWidth: 0 }}
              >
                <HeaderInfo label="Blend No.">
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    <Typography sx={{ fontWeight: 800, fontSize: "1rem" }}>{blendNumber}</Typography>
                    <Chip
                      size="small"
                      label={status}
                      sx={{
                        height: 22,
                        fontWeight: 700,
                        bgcolor:
                          status === "Draft"
                            ? "rgba(237,108,2,0.12)"
                            : status === "Confirmed"
                              ? "rgba(46,125,50,0.12)"
                              : "rgba(31,77,58,0.1)",
                        color:
                          status === "Draft"
                            ? "#b54708"
                            : status === "Confirmed"
                              ? "success.dark"
                              : "primary.main",
                      }}
                    />
                  </Stack>
                </HeaderInfo>
                <HeaderInfo label="Product / Blend">
                  {editingHeader && !locked ? (
                    <TextField
                      size="small"
                      variant="standard"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="Product / blend"
                      sx={{ minWidth: 140 }}
                    />
                  ) : (
                    <Typography sx={{ fontWeight: 700 }}>{productName || "—"}</Typography>
                  )}
                </HeaderInfo>
                <HeaderInfo label="Sales Order">
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                    {editingHeader && !locked ? (
                      <TextField
                        size="small"
                        variant="standard"
                        value={salesOrderRef}
                        onChange={(e) => setSalesOrderRef(e.target.value)}
                        placeholder="SO…"
                        sx={{ width: 120 }}
                      />
                    ) : (
                      <Typography sx={{ fontWeight: 700 }}>{salesOrderRef || "—"}</Typography>
                    )}
                    {salesOrderRef ? (
                      <IconButton size="small" aria-label="Open sales order" sx={{ p: 0.25 }} disabled>
                        <OpenInNewIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    ) : null}
                  </Stack>
                </HeaderInfo>
                <HeaderInfo label="Customer">
                  {editingHeader && !locked ? (
                    <TextField
                      size="small"
                      variant="standard"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer"
                      sx={{ minWidth: 140 }}
                    />
                  ) : (
                    <Typography sx={{ fontWeight: 700 }}>{customerName || "—"}</Typography>
                  )}
                </HeaderInfo>
              </Stack>

              <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignItems: "center", pt: { xs: 0.5, md: 0 } }}>
                <Button size="small" variant="outlined" startIcon={<HistoryIcon />} onClick={() => setShelf("history")}>
                  History
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PrintOutlinedIcon />}
                  onClick={() => window.print()}
                >
                  Print
                </Button>
                <IconButton
                  size="small"
                  aria-label="More actions"
                  onClick={(e) => setHeaderMenuEl(e.currentTarget)}
                  sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}
                >
                  <MoreHorizIcon fontSize="small" />
                </IconButton>
                <Menu
                  anchorEl={headerMenuEl}
                  open={Boolean(headerMenuEl)}
                  onClose={() => setHeaderMenuEl(null)}
                >
                  <MenuItem
                    disabled={locked}
                    onClick={() => {
                      setEditingHeader((v) => !v);
                      setHeaderMenuEl(null);
                    }}
                  >
                    <ListItemText>{editingHeader ? "Done editing header" : "Edit header fields"}</ListItemText>
                  </MenuItem>
                  <MenuItem
                    disabled={locked || saveMutation.isPending}
                    onClick={() => {
                      setHeaderMenuEl(null);
                      saveMutation.mutate();
                    }}
                  >
                    <ListItemText>Save draft</ListItemText>
                  </MenuItem>
                  <MenuItem
                    disabled={locked || confirmMutation.isPending || totalAllocated <= 0}
                    onClick={() => {
                      setHeaderMenuEl(null);
                      confirmMutation.mutate();
                    }}
                  >
                    <ListItemText>Confirm blend</ListItemText>
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setHeaderMenuEl(null);
                      setCompareOpen(true);
                    }}
                  >
                    <ListItemIcon>
                      <BalanceIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Compare options</ListItemText>
                  </MenuItem>
                  <MenuItem
                    disabled={locked}
                    onClick={() => {
                      setHeaderMenuEl(null);
                      addOption();
                    }}
                  >
                    <ListItemIcon>
                      <AddIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Add option</ListItemText>
                  </MenuItem>
                </Menu>
              </Stack>
            </Stack>
          </Paper>

          {/* Targets / save bar */}
          <Paper elevation={0} sx={{ px: 2, py: 1.25, border: "1px solid", borderColor: "divider" }}>
            <Stack direction={{ xs: "column", lg: "row" }} spacing={1.25} useFlexGap sx={{ flexWrap: "wrap", alignItems: { lg: "flex-end" } }}>
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
              <Field label="Target price / kg">
                <TextField
                  size="small"
                  type="number"
                  value={targetPrice}
                  disabled={locked}
                  onChange={(e) => setTargetPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  sx={{ width: 120 }}
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
              <Stack direction="row" spacing={1} sx={{ ml: { lg: "auto" } }}>
                <Button variant="outlined" disabled={locked || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                  {saveMutation.isPending ? "Saving…" : "Save draft"}
                </Button>
                <Button
                  variant="contained"
                  disabled={locked || confirmMutation.isPending || totalAllocated <= 0}
                  onClick={() => confirmMutation.mutate()}
                >
                  {confirmMutation.isPending ? "Confirming…" : "Confirm"}
                </Button>
              </Stack>
            </Stack>
            {(saveMutation.isError || confirmMutation.isError) && (
              <Alert severity="error" sx={{ mt: 1.25 }}>
                {saveMutation.error?.message || confirmMutation.error?.message}
              </Alert>
            )}
          </Paper>

          {/* Section tabs */}
          <Paper elevation={0} sx={{ border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
            <Tabs
              value={workTab}
              onChange={(_, v: typeof workTab) => {
                setWorkTab(v);
                if (v === "cost") setCompareOpen(true);
              }}
              variant="scrollable"
              allowScrollButtonsMobile
              sx={{
                minHeight: 46,
                px: 1,
                bgcolor: "rgba(31,77,58,0.05)",
                borderBottom: "1px solid",
                borderColor: "divider",
                "& .MuiTab-root": { textTransform: "none", fontWeight: 650, minHeight: 46 },
                "& .Mui-selected": { color: "primary.main" },
                "& .MuiTabs-indicator": { height: 3, bgcolor: "primary.main" },
              }}
            >
              <Tab value="options" label="Blend Options" />
              <Tab value="tasting" label="Tasting & Quality" />
              <Tab value="cost" label="Cost Comparison" />
              <Tab value="notes" label="Notes & Attachments" />
            </Tabs>

            {workTab === "notes" ? (
              <Box sx={{ p: 2 }}>
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  minRows={4}
                  label="Remarks / blend instructions"
                  value={remarks}
                  disabled={locked}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </Box>
            ) : workTab === "tasting" ? (
              <Box sx={{ p: 2 }}>
                <Alert severity="info">
                  Tasting & quality notes stay on this tab. Cupping scores and lab checks can be added later — blend
                  allocation stays on Blend Options.
                </Alert>
              </Box>
            ) : (
              <Box sx={{ p: 1.75 }}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ justifyContent: "space-between", mb: 1.25 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Options · only the active option reserves inventory
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    <Button size="small" disabled={locked} onClick={duplicateActiveOption}>
                      Duplicate active
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<BalanceIcon />} onClick={() => setCompareOpen(true)}>
                      Compare options
                    </Button>
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  {options.map((opt) => {
                    const stats = optionStats(opt.alloc, lotsById, targetQty, targetPrice);
                    const active = opt.key === activeOptionKey;
                    return (
                      <Paper
                        key={opt.key}
                        variant="outlined"
                        onClick={() => setActiveOptionKey(opt.key)}
                        sx={{
                          px: 1.5,
                          py: 1.15,
                          minWidth: 168,
                          cursor: "pointer",
                          borderWidth: active ? 2 : 1,
                          borderColor: active ? "primary.main" : "divider",
                          bgcolor: active ? "rgba(31,77,58,0.07)" : "background.paper",
                          position: "relative",
                        }}
                      >
                        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                            {active ? <CheckCircleIcon sx={{ fontSize: 16, color: "primary.main" }} /> : null}
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              {opt.label}
                              {active ? " · Active" : ""}
                            </Typography>
                          </Stack>
                          {options.length > 1 && !locked ? (
                            <IconButton
                              size="small"
                              aria-label={`Remove ${opt.label}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                removeOption(opt.key);
                              }}
                            >
                              <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          ) : null}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.35 }}>
                          Tea cost {currency} {stats.wavg.toFixed(2)}/kg
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          {stats.allocated.toFixed(1)} kg · {stats.rows.length} lots
                        </Typography>
                      </Paper>
                    );
                  })}
                  <Paper
                    variant="outlined"
                    onClick={() => {
                      if (!locked && options.length < 12) addOption();
                    }}
                    sx={{
                      px: 1.5,
                      py: 1.15,
                      minWidth: 140,
                      cursor: locked || options.length >= 12 ? "default" : "pointer",
                      borderStyle: "dashed",
                      display: "grid",
                      placeContent: "center",
                      color: "text.secondary",
                      opacity: locked || options.length >= 12 ? 0.5 : 1,
                    }}
                  >
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                      <AddIcon fontSize="small" />
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Add option
                      </Typography>
                    </Stack>
                  </Paper>
                </Stack>
              </Box>
            )}
          </Paper>

          {(workTab === "options" || workTab === "cost") && (
            <>
          {/* KPI strip */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(2, minmax(0, 1fr))",
                sm: "repeat(4, minmax(0, 1fr))",
                lg: "repeat(8, minmax(0, 1fr))",
              },
              gap: 1,
            }}
          >
            <KpiTile label="Target qty" value={`${targetQtyNum.toFixed(2)} kg`} />
            <KpiTile label={`Allocated (${activeOptionKey})`} value={`${totalAllocated.toFixed(2)} kg`} />
            <KpiTile
              label="Remaining"
              value={`${remainingTarget.toFixed(2)} kg`}
              tone={Math.abs(remainingTarget) < 0.001 ? "ok" : "warn"}
            />
            <KpiTile
              label="Completion"
              value={`${completionPct.toFixed(1)}%`}
              tone={completionPct >= 99.9 ? "ok" : undefined}
              progress={completionPct}
            />
            <KpiTile label="WAVG tea cost" value={`${currency} ${wavg.toFixed(2)}`} />
            <KpiTile
              label="Target price"
              value={targetPriceNum == null ? "—" : `${currency} ${targetPriceNum.toFixed(2)}`}
            />
            <KpiTile
              label="Variance"
              value={
                costVariance == null
                  ? "—"
                  : `${costVariance >= 0 ? "+" : ""}${currency} ${costVariance.toFixed(2)}${
                      costVariancePct == null ? "" : ` (${costVariancePct >= 0 ? "+" : ""}${costVariancePct.toFixed(1)}%)`
                    }`
              }
              tone={costVariance == null ? undefined : costVariance <= 0 ? "ok" : "warn"}
            />
            <KpiTile label="Lots in blend" value={String(composition.length)} />
          </Box>
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
              height: { xs: "auto", lg: 560 },
              minHeight: { xs: 480, lg: 560 },
              maxHeight: { lg: 560 },
              flex: 1,
            }}
          >
            {/* Left: available grid — fixed height, internal scroll */}
            <Paper
              sx={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                height: { xs: 480, lg: "100%" },
                minHeight: 0,
              }}
            >
              <Box sx={{ px: 1.5, py: 1, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: "0.98rem" }}>
                  Available auction inventory
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  Fixed panel · scroll lots inside · expand a row for multi-blend allocations
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: "wrap" }}>
                  <TextField size="small" label="Sale" value={saleFilter} onChange={(e) => setSaleFilter(e.target.value)} sx={{ width: 84 }} />
                  <TextField size="small" label="Broker" value={brokerFilter} onChange={(e) => setBrokerFilter(e.target.value)} sx={{ width: 84 }} />
                  <TextField size="small" label="Type / grade" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} sx={{ width: 110 }} />
                </Stack>
              </Box>
              <Box sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>
                {inventory.isPending ? (
                  <Box sx={{ p: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : inventory.isError ? (
                  <Alert
                    severity="error"
                    sx={{ m: 1 }}
                    action={
                      <Button color="inherit" size="small" onClick={() => void inventory.refetch()}>
                        Retry
                      </Button>
                    }
                  >
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
                        <ResizeHead width={leftCols.expand} />
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
                        <ResizeHead width={leftCols.physical} align="right" colKey="physical" onResize={(e, k) => startColResize("left", k, e)}>
                          <TableSortLabel active={lotSortKey === "physicalStockKg"} direction={lotSortKey === "physicalStockKg" ? lotSortDir : "asc"} onClick={() => toggleLotSort("physicalStockKg")}>
                            Physical
                          </TableSortLabel>
                        </ResizeHead>
                        <ResizeHead width={leftCols.reserved} align="right" colKey="reserved" onResize={(e, k) => startColResize("left", k, e)}>
                          <TableSortLabel active={lotSortKey === "reservedQtyKg"} direction={lotSortKey === "reservedQtyKg" ? lotSortDir : "asc"} onClick={() => toggleLotSort("reservedQtyKg")}>
                            Reserved
                          </TableSortLabel>
                        </ResizeHead>
                        <ResizeHead width={leftCols.avail} align="right" colKey="avail" onResize={(e, k) => startColResize("left", k, e)}>
                          <TableSortLabel active={lotSortKey === "availableQtyKg"} direction={lotSortKey === "availableQtyKg" ? lotSortDir : "asc"} onClick={() => toggleLotSort("availableQtyKg")}>
                            Remain
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
                        const expanded = Boolean(expandedLots[lot.collectionLotId]);
                        const localUses = options
                          .map((o) => ({ key: o.key, label: o.label, qty: o.alloc[lot.collectionLotId] || 0, active: o.key === activeOptionKey }))
                          .filter((x) => x.qty > 0);
                        const serverUses = lot.allocations ?? [];
                        const useCount = localUses.length + serverUses.length;
                        return (
                          <Fragment key={lot.collectionLotId}>
                            <TableRow
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
                              <TableCell sx={{ width: leftCols.expand, px: 0.25 }}>
                                <IconButton
                                  size="small"
                                  aria-label={expanded ? "Collapse allocations" : "Expand allocations"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedLots((m) => ({ ...m, [lot.collectionLotId]: !m[lot.collectionLotId] }));
                                  }}
                                  sx={{ p: 0.25 }}
                                >
                                  {expanded ? (
                                    <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
                                  ) : (
                                    <KeyboardArrowRightIcon sx={{ fontSize: 16, opacity: useCount ? 1 : 0.35 }} />
                                  )}
                                </IconButton>
                              </TableCell>
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
                              <TableCell align="right" sx={{ width: leftCols.physical }}>
                                {Number(lot.physicalStockKg).toFixed(2)}
                              </TableCell>
                              <TableCell align="right" sx={{ width: leftCols.reserved }}>
                                {Number(lot.reservedQtyKg).toFixed(2)}
                              </TableCell>
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
                            {expanded ? (
                              <TableRow>
                                <TableCell
                                  colSpan={12}
                                  sx={{
                                    py: 1,
                                    px: 1.5,
                                    bgcolor: "rgba(26,95,122,0.04)",
                                    whiteSpace: "normal",
                                    overflow: "visible",
                                  }}
                                >
                                  <Typography variant="caption" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
                                    Allocations for lot {lot.lotNumber}
                                  </Typography>
                                  {localUses.length === 0 && serverUses.length === 0 ? (
                                    <Typography variant="caption" color="text.secondary">
                                      Not allocated to any blend yet.
                                    </Typography>
                                  ) : (
                                    <Stack spacing={0.5}>
                                      {localUses.map((u) => (
                                        <Typography key={`local-${u.key}`} variant="caption" sx={{ display: "block" }}>
                                          This sheet · {u.label}
                                          {u.active ? " (editing)" : ""} · {u.qty.toFixed(2)} kg
                                          {!sheetId ? " · unsaved" : " · draft/local"}
                                        </Typography>
                                      ))}
                                      {serverUses.map((a) => (
                                        <Typography
                                          key={`${a.blendSheetId}-${a.optionKey}`}
                                          variant="caption"
                                          sx={{ display: "block" }}
                                        >
                                          {a.blendNumber} · {a.productName || "Blend"} · Option {a.optionKey}
                                          {a.isActiveOption ? " (active)" : ""} · {Number(a.reservedQtyKg).toFixed(2)} kg ·{" "}
                                          {a.status}/{a.reservationStatus}
                                        </Typography>
                                      ))}
                                    </Stack>
                                  )}
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </Fragment>
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
                height: { xs: 480, lg: "100%" },
                minHeight: 0,
                border: dropActive ? "2px solid" : "1px solid",
                borderColor: dropActive ? "primary.main" : "divider",
                boxShadow: dropActive ? "0 0 0 4px rgba(26,95,122,0.12)" : undefined,
                bgcolor: dropActive ? "rgba(26,95,122,0.06)" : "background.paper",
                transition: "border-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease",
              }}
            >
              <Box sx={{ px: 1.5, py: 1, borderBottom: "1px solid", borderColor: "divider", flexShrink: 0 }}>
                <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: "0.98rem" }}>
                      Blend composition — Option {activeOptionKey}
                      {dropActive ? " · drop to add" : ""}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Edit Alloc kg · leftover Remain stays in inventory
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <Button size="small" disabled={locked || composition.length === 0} onClick={autoBalanceActive}>
                      Auto balance
                    </Button>
                    <Button size="small" disabled={locked || composition.length === 0} onClick={clearActiveOption}>
                      Clear
                    </Button>
                  </Stack>
                </Stack>
              </Box>
              <Box sx={{ overflow: "auto", flex: 1, minHeight: 0 }}>
                {composition.length === 0 ? (
                  <Box
                    sx={{
                      m: 1.25,
                      minHeight: 180,
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
                        <ResizeHead width={rightCols.amount} align="right" colKey="amount" onResize={(e, k) => startColResize("right", k, e)}>
                          Amount
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
                          <TableCell align="right" sx={{ width: rightCols.amount, fontWeight: 600 }}>
                            {row.cost.toFixed(2)}
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
              <Box
                sx={{
                  px: 1.25,
                  py: 1,
                  borderTop: "1px solid",
                  borderColor: "divider",
                  bgcolor: "rgba(31,77,58,0.04)",
                  flexShrink: 0,
                }}
              >
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                  <KpiTile
                    compact
                    label="Target price"
                    value={targetPriceNum == null ? "—" : `${currency} ${targetPriceNum.toFixed(2)}`}
                  />
                  <KpiTile compact label="Tea cost (WAVG)" value={`${currency} ${wavg.toFixed(2)}`} />
                  <KpiTile
                    compact
                    label="Variance"
                    value={
                      costVariance == null
                        ? "—"
                        : `${costVariance >= 0 ? "+" : ""}${currency} ${Math.abs(costVariance).toFixed(2)}`
                    }
                    tone={costVariance == null ? undefined : costVariance <= 0 ? "ok" : "warn"}
                  />
                  <KpiTile
                    compact
                    label="Est. blend value"
                    value={estBlendValue == null ? "—" : `${currency} ${estBlendValue.toFixed(2)}`}
                  />
                  <KpiTile compact label="Est. tea cost" value={`${currency} ${totalCost.toFixed(2)}`} />
                  <KpiTile
                    compact
                    label="Gross spread"
                    value={grossSpread == null ? "—" : `${currency} ${grossSpread.toFixed(2)}`}
                    tone={grossSpread == null ? undefined : grossSpread >= 0 ? "ok" : "warn"}
                  />
                </Stack>
              </Box>
            </Paper>
          </Box>
            </>
          )}

          <Button component={RouterLink} to="/collections" size="small" sx={{ alignSelf: "flex-start" }}>
            Back to collection
          </Button>

          <Dialog open={compareOpen} onClose={() => setCompareOpen(false)} maxWidth="md" fullWidth>
            <DialogTitle>Compare blend options</DialogTitle>
            <DialogContent dividers>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Same Est. Qty / target price · only the active option reserves inventory on Save / Confirm.
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Option</TableCell>
                    <TableCell align="right">Allocated</TableCell>
                    <TableCell align="right">To target</TableCell>
                    <TableCell align="right">WAVG cost</TableCell>
                    <TableCell align="right">vs target price</TableCell>
                    <TableCell align="right">Raw tea cost</TableCell>
                    <TableCell align="right">Lots</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {options.map((opt) => {
                    const stats = optionStats(opt.alloc, lotsById, targetQty, targetPrice);
                    const active = opt.key === activeOptionKey;
                    return (
                      <TableRow key={opt.key} selected={active}>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {opt.label}
                          {active ? " (active)" : ""}
                        </TableCell>
                        <TableCell align="right">{stats.allocated.toFixed(2)}</TableCell>
                        <TableCell align="right">{stats.remaining.toFixed(2)}</TableCell>
                        <TableCell align="right">{stats.wavg.toFixed(2)}</TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 700,
                            color:
                              stats.variance == null
                                ? "text.secondary"
                                : stats.variance > 0
                                  ? "error.main"
                                  : "success.main",
                          }}
                        >
                          {stats.variance == null
                            ? "—"
                            : `${stats.variance >= 0 ? "+" : ""}${stats.variance.toFixed(2)}`}
                        </TableCell>
                        <TableCell align="right">{stats.totalCost.toFixed(2)}</TableCell>
                        <TableCell align="right">{stats.rows.length}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant={active ? "contained" : "outlined"}
                            onClick={() => {
                              setActiveOptionKey(opt.key);
                              setCompareOpen(false);
                            }}
                          >
                            {active ? "Editing" : "Make active"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCompareOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>
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

function HeaderInfo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box sx={{ py: 0.25, pr: { sm: 0.5 }, minWidth: 0 }}>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 0.2, fontSize: "0.7rem", letterSpacing: "0.02em" }}
      >
        {label}
      </Typography>
      {children}
    </Box>
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

function KpiTile({
  label,
  value,
  tone,
  progress,
  compact,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
  progress?: number;
  compact?: boolean;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{
        px: compact ? 1.1 : 1.35,
        py: compact ? 0.85 : 1.1,
        minWidth: compact ? 108 : 0,
        flex: compact ? "1 1 120px" : undefined,
        borderColor: tone === "ok" ? "success.light" : tone === "warn" ? "warning.light" : "divider",
        bgcolor: tone === "ok" ? "rgba(46,125,50,0.04)" : tone === "warn" ? "rgba(237,108,2,0.05)" : "background.paper",
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>
        {label}
      </Typography>
      <Typography
        variant={compact ? "body2" : "subtitle2"}
        sx={{
          fontWeight: 800,
          mt: 0.2,
          color: tone === "warn" ? "error.dark" : tone === "ok" ? "success.dark" : "text.primary",
          wordBreak: "break-word",
        }}
      >
        {value}
      </Typography>
      {typeof progress === "number" ? (
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, progress))}
          sx={{
            mt: 0.75,
            height: 6,
            borderRadius: 99,
            bgcolor: "rgba(31,77,58,0.12)",
            "& .MuiLinearProgress-bar": { bgcolor: "primary.main", borderRadius: 99 },
          }}
        />
      ) : null}
    </Paper>
  );
}

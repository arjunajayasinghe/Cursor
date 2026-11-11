import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import {
  confirmBlendSheet,
  getBlendSheet,
  listBlendInventory,
  saveBlendSheet,
  type BlendInventoryLot,
} from "../api/client";

type AllocMap = Record<string, number>;

export function BlendSheetCreatePage() {
  const { blendId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editing = Boolean(blendId);

  const [productName, setProductName] = useState("Blend");
  const [salesOrderRef, setSalesOrderRef] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [targetQty, setTargetQty] = useState<number>(0);
  const [targetPrice, setTargetPrice] = useState<number | "">("");
  const [targetTeaCost, setTargetTeaCost] = useState<number | "">("");
  const [currency, setCurrency] = useState("LKR");
  const [remarks, setRemarks] = useState("");
  const [preparedBy, setPreparedBy] = useState("desk");
  const [saleFilter, setSaleFilter] = useState("");
  const [brokerFilter, setBrokerFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [estateFilter, setEstateFilter] = useState("");
  const [alloc, setAlloc] = useState<AllocMap>({});
  const [sheetId, setSheetId] = useState<string | undefined>(blendId);
  const [blendNumber, setBlendNumber] = useState<string>("(auto on save)");
  const [status, setStatus] = useState("Draft");
  const [hydrated, setHydrated] = useState(!editing);

  const existing = useQuery({
    queryKey: ["blend", blendId],
    queryFn: () => getBlendSheet(blendId!),
    enabled: Boolean(blendId),
  });

  useEffect(() => {
    if (!existing.data || hydrated) return;
    const d = existing.data;
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
    setHydrated(true);
  }, [existing.data, hydrated]);

  const inventory = useQuery({
    queryKey: ["blend-inventory", sheetId, saleFilter, brokerFilter, gradeFilter, estateFilter],
    queryFn: () =>
      listBlendInventory({
        excludeBlendSheetId: sheetId,
        saleNumber: saleFilter || undefined,
        broker: brokerFilter || undefined,
        grade: gradeFilter || undefined,
        estate: estateFilter || undefined,
      }),
    enabled: hydrated,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      saveBlendSheet({
        id: sheetId,
        productName,
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
      setSheetId(detail.id);
      setBlendNumber(detail.blendNumber);
      setStatus(detail.status);
      void queryClient.invalidateQueries({ queryKey: ["blends"] });
      void queryClient.invalidateQueries({ queryKey: ["blend-inventory"] });
      if (!blendId) navigate(`/blending/sheets/${detail.id}`, { replace: true });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const saved = await saveBlendSheet({
        id: sheetId,
        productName,
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
      setSheetId(saved.id);
      return confirmBlendSheet(saved.id);
    },
    onSuccess: (detail) => {
      setBlendNumber(detail.blendNumber);
      setStatus(detail.status);
      void queryClient.invalidateQueries({ queryKey: ["blends"] });
      void queryClient.invalidateQueries({ queryKey: ["blend-inventory"] });
      navigate(`/blending/sheets/${detail.id}`);
    },
  });

  const lotsById = useMemo(() => {
    const map = new Map<string, BlendInventoryLot>();
    for (const lot of inventory.data ?? []) map.set(lot.collectionLotId, lot);
    return map;
  }, [inventory.data]);

  const composition = useMemo(() => {
    return Object.entries(alloc)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const lot = lotsById.get(id);
        const unit = lot?.unitCostPerKg ?? 0;
        return {
          id,
          lot,
          qty,
          unit,
          cost: qty * unit,
        };
      });
  }, [alloc, lotsById]);

  const totalAllocated = composition.reduce((s, r) => s + r.qty, 0);
  const totalCost = composition.reduce((s, r) => s + r.cost, 0);
  const wavg = totalAllocated > 0 ? totalCost / totalAllocated : 0;
  const remainingTarget = (Number(targetQty) || 0) - totalAllocated;
  const sellingValue =
    targetPrice === "" || totalAllocated <= 0 ? null : Number(targetPrice) * totalAllocated;
  const spread = sellingValue == null ? null : sellingValue - totalCost;

  const liveWarnings: string[] = [];
  if ((Number(targetQty) || 0) > 0 && Math.abs(remainingTarget) > 0.001) {
    liveWarnings.push(
      `Allocated ${totalAllocated.toFixed(3)} kg differs from estimated/target ${(Number(targetQty) || 0).toFixed(3)} kg.`,
    );
  }
  for (const row of composition) {
    if (!row.lot) continue;
    if (row.qty > row.lot.availableQtyKg + 0.0005) {
      liveWarnings.push(
        `Sale ${row.lot.saleNumber}/${row.lot.year} ${row.lot.broker} lot ${row.lot.lotNumber}: exceeds available ${row.lot.availableQtyKg.toFixed(3)} kg.`,
      );
    }
    if (!row.lot.costVerified || row.unit <= 0) {
      liveWarnings.push(
        `Sale ${row.lot.saleNumber}/${row.lot.year} lot ${row.lot.lotNumber}: missing/unverified cost.`,
      );
    }
  }
  if (targetTeaCost !== "" && wavg > Number(targetTeaCost)) {
    liveWarnings.push(
      `Weighted average cost ${wavg.toFixed(4)} exceeds target tea cost ${Number(targetTeaCost).toFixed(4)}.`,
    );
  }

  const locked = status === "Confirmed" || status === "Cancelled" || status === "Rejected";

  function setLotQty(lot: BlendInventoryLot, raw: string) {
    const n = Number(raw);
    setAlloc((current) => {
      const next = { ...current };
      if (!raw || Number.isNaN(n) || n <= 0) delete next[lot.collectionLotId];
      else next[lot.collectionLotId] = n;
      return next;
    });
  }

  if (editing && existing.isPending) return <CircularProgress aria-label="Loading blend sheet" />;
  if (editing && existing.isError) {
    return <Alert severity="error">{existing.error.message}</Alert>;
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <div>
          <Typography variant="overline" color="text.secondary">
            Create / edit blend sheet
          </Typography>
          <Typography variant="h4">{blendNumber}</Typography>
          <Typography color="text.secondary">
            Status <Chip size="small" label={status} sx={{ ml: 0.5 }} /> · Temp allocate collected lots, then Confirm
            when allocated qty = estimated qty
          </Typography>
        </div>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <Button component={RouterLink} to="/blending" size="small" variant="outlined">
            Menu
          </Button>
          <Button component={RouterLink} to="/blending/sheets" size="small" variant="outlined">
            List
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>
          Blend header
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
          <TextField
            size="small"
            label="Product / Blend"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            disabled={locked}
            sx={{ minWidth: 200 }}
          />
          <TextField
            size="small"
            label="Sales Order (optional)"
            value={salesOrderRef}
            onChange={(e) => setSalesOrderRef(e.target.value)}
            disabled={locked}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            label="Customer"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            disabled={locked}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            type="number"
            label="Estimated / Target Qty (kg)"
            value={targetQty}
            onChange={(e) => setTargetQty(Number(e.target.value))}
            disabled={locked}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            type="number"
            label="Target Price / kg"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value === "" ? "" : Number(e.target.value))}
            disabled={locked}
            sx={{ minWidth: 140 }}
          />
          <TextField
            size="small"
            label="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={locked}
            sx={{ width: 100 }}
          />
          <TextField
            size="small"
            type="number"
            label="Target Tea Cost / kg"
            value={targetTeaCost}
            onChange={(e) => setTargetTeaCost(e.target.value === "" ? "" : Number(e.target.value))}
            disabled={locked}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            label="Prepared by"
            value={preparedBy}
            onChange={(e) => setPreparedBy(e.target.value)}
            disabled={locked}
            sx={{ minWidth: 140 }}
          />
          <TextField
            size="small"
            label="Remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            disabled={locked}
            sx={{ minWidth: 220, flex: 1 }}
          />
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Blend summary (live)
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} useFlexGap sx={{ flexWrap: "wrap" }}>
          <Stat label="Allocated kg" value={totalAllocated.toFixed(3)} />
          <Stat label="Remaining to target" value={remainingTarget.toFixed(3)} />
          <Stat label="WAVG tea cost" value={wavg.toFixed(4)} />
          <Stat label="Total raw tea cost" value={totalCost.toFixed(2)} />
          <Stat label="Target selling value" value={sellingValue == null ? "—" : sellingValue.toFixed(2)} />
          <Stat label="Est. gross spread" value={spread == null ? "—" : spread.toFixed(2)} />
        </Stack>
        {liveWarnings.map((w) => (
          <Alert key={w} severity="warning" sx={{ mt: 1 }}>
            {w}
          </Alert>
        ))}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ mb: 1.5, justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Typography variant="h6">Selected composition</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              disabled={locked || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Saving…" : "Save draft (temp allocate)"}
            </Button>
            <Button
              variant="contained"
              disabled={locked || confirmMutation.isPending || totalAllocated <= 0}
              onClick={() => confirmMutation.mutate()}
            >
              {confirmMutation.isPending ? "Confirming…" : "Confirm blend"}
            </Button>
          </Stack>
        </Stack>
        {saveMutation.isError ? <Alert severity="error">{saveMutation.error.message}</Alert> : null}
        {confirmMutation.isError ? <Alert severity="error">{confirmMutation.error.message}</Alert> : null}
        {composition.length === 0 ? (
          <Typography color="text.secondary">Allocate qty from inventory below.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sale</TableCell>
                <TableCell>Broker</TableCell>
                <TableCell align="right">Lot</TableCell>
                <TableCell>Estate</TableCell>
                <TableCell>Grade</TableCell>
                <TableCell align="right">Alloc kg</TableCell>
                <TableCell align="right">%</TableCell>
                <TableCell align="right">Cost/kg</TableCell>
                <TableCell align="right">Line cost</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {composition.map((row) => (
                <TableRow key={row.id}>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {row.lot ? `${row.lot.saleNumber}/${row.lot.year}` : "—"}
                  </TableCell>
                  <TableCell>{row.lot?.broker ?? "—"}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {row.lot?.lotNumber ?? "—"}
                  </TableCell>
                  <TableCell>{row.lot?.estate ?? "—"}</TableCell>
                  <TableCell>{row.lot?.grade ?? "—"}</TableCell>
                  <TableCell align="right">{row.qty.toFixed(3)}</TableCell>
                  <TableCell align="right">
                    {totalAllocated > 0 ? ((row.qty / totalAllocated) * 100).toFixed(2) : "0.00"}
                  </TableCell>
                  <TableCell align="right">{row.unit.toFixed(2)}</TableCell>
                  <TableCell align="right">{row.cost.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Add purchased tea lots (collected samples)
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mb: 1.5, flexWrap: "wrap" }}>
          <TextField size="small" label="Sale / Auction" value={saleFilter} onChange={(e) => setSaleFilter(e.target.value)} />
          <TextField size="small" label="Broker" value={brokerFilter} onChange={(e) => setBrokerFilter(e.target.value)} />
          <TextField size="small" label="Grade" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} />
          <TextField size="small" label="Estate" value={estateFilter} onChange={(e) => setEstateFilter(e.target.value)} />
        </Stack>
        {inventory.isPending ? (
          <CircularProgress size={28} />
        ) : inventory.isError ? (
          <Alert severity="error">{inventory.error.message}</Alert>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sale</TableCell>
                <TableCell>Broker</TableCell>
                <TableCell align="right">Lot</TableCell>
                <TableCell>Box</TableCell>
                <TableCell>Estate</TableCell>
                <TableCell>Grade</TableCell>
                <TableCell>WH</TableCell>
                <TableCell align="right">Purchased</TableCell>
                <TableCell align="right">Physical</TableCell>
                <TableCell align="right">Reserved</TableCell>
                <TableCell align="right">Available</TableCell>
                <TableCell align="right">Allocate</TableCell>
                <TableCell align="right">Balance</TableCell>
                <TableCell align="right">Cost/kg</TableCell>
                <TableCell>Quality</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(inventory.data ?? []).map((lot) => {
                const qty = alloc[lot.collectionLotId] ?? 0;
                const balance = lot.availableQtyKg - qty;
                return (
                  <TableRow key={lot.collectionLotId} hover>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                      {lot.saleNumber}/{lot.year}
                    </TableCell>
                    <TableCell>{lot.broker}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {lot.lotNumber}
                    </TableCell>
                    <TableCell>{lot.boxNumber || "—"}</TableCell>
                    <TableCell>{lot.estate || "—"}</TableCell>
                    <TableCell>{lot.grade || "—"}</TableCell>
                    <TableCell sx={{ fontSize: "0.75rem" }}>{lot.warehouseOrBasis || "—"}</TableCell>
                    <TableCell align="right">{Number(lot.purchasedQtyKg).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(lot.physicalStockKg).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(lot.reservedQtyKg).toFixed(2)}</TableCell>
                    <TableCell align="right">{Number(lot.availableQtyKg).toFixed(2)}</TableCell>
                    <TableCell align="right" sx={{ minWidth: 110 }}>
                      <TextField
                        size="small"
                        type="number"
                        value={qty || ""}
                        disabled={locked}
                        onChange={(e) => setLotQty(lot, e.target.value)}
                        slotProps={{ htmlInput: { min: 0, max: lot.availableQtyKg, step: "0.001" } }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ color: balance < -0.0005 ? "error.main" : "inherit" }}>
                      {balance.toFixed(2)}
                    </TableCell>
                    <TableCell align="right">{Number(lot.unitCostPerKg).toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={lot.qualityStatus} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {(inventory.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15}>
                    <Typography color="text.secondary">
                      No collected lots with available qty. Mark sample boxes as collected first.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, minWidth: 140 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Paper>
  );
}

import { Alert, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import { getSampleBox, recordSampleBoxPrint } from "../api/client";
import { formatSaleDate } from "../catalogue";

export function SampleBoxPrintPage() {
  const { boxId = "" } = useParams();
  const queryClient = useQueryClient();
  const qrRef = useRef<HTMLCanvasElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const printedOnce = useRef(false);

  const box = useQuery({
    queryKey: ["sample-box", boxId],
    queryFn: () => getSampleBox(boxId),
    enabled: Boolean(boxId),
  });

  const printAudit = useMutation({
    mutationFn: () => recordSampleBoxPrint(boxId),
    onSuccess: (detail) => {
      void queryClient.setQueryData(["sample-box", boxId], detail);
      void queryClient.invalidateQueries({ queryKey: ["collection-boxes", detail.collectionBatchId] });
      void queryClient.invalidateQueries({ queryKey: ["collection", detail.collectionBatchId] });
    },
  });

  useEffect(() => {
    if (!box.data) return;
    const payload = box.data.boxNumber;
    if (qrRef.current) {
      void QRCode.toCanvas(qrRef.current, payload, { width: 140, margin: 1 });
    }
    if (barcodeRef.current) {
      JsBarcode(barcodeRef.current, payload, {
        format: "CODE128",
        displayValue: true,
        fontSize: 14,
        height: 48,
        margin: 0,
      });
    }
  }, [box.data]);

  useEffect(() => {
    if (!box.data || printedOnce.current) return;
    printedOnce.current = true;
    printAudit.mutate();
    // Record print audit once when the sheet first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box.data?.id]);

  if (box.isPending) return <CircularProgress aria-label="Loading sample box" />;
  if (box.isError) {
    return (
      <Alert severity="error" action={<Button onClick={() => box.refetch()}>Retry</Button>}>
        {box.error.message}
      </Alert>
    );
  }
  if (!box.data) return <Alert severity="info">Sample box not found.</Alert>;

  const detail = box.data;

  return (
    <Stack spacing={2} className="sample-box-print">
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: "space-between", "@media print": { display: "none" } }}
      >
        <Button component={RouterLink} to={`/collections/${detail.collectionBatchId}`} size="small">
          Back to collection
        </Button>
        <Button variant="contained" onClick={() => window.print()}>
          Print A4
        </Button>
      </Stack>

      <Paper
        sx={{
          p: 3,
          maxWidth: 900,
          mx: "auto",
          width: "100%",
          "@media print": { boxShadow: "none", maxWidth: "100%" },
        }}
      >
        <Typography variant="overline" color="text.secondary">
          Sample collection sheet
        </Typography>
        <Typography variant="h4" sx={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
          {detail.boxNumber}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Sale {detail.saleNumber}/{detail.year} · {formatSaleDate(detail.saleDate)} · {detail.centre}
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ mb: 3, alignItems: "center" }}>
          <canvas ref={qrRef} aria-label={`QR ${detail.boxNumber}`} />
          <svg ref={barcodeRef} aria-label={`Barcode ${detail.boxNumber}`} />
        </Stack>

        <Stack spacing={0.75} sx={{ mb: 3 }}>
          <Meta label="Warehouse" value={detail.warehouseOrBasis || "—"} />
          <Meta label="Collector" value={detail.collectorName || "—"} />
          <Meta label="Lots / bags / kg" value={`${detail.lotCount} · ${detail.bagCount} · ${Number(detail.netWeightKg).toFixed(2)}`} />
          <Meta label="Status" value={detail.status} />
          {detail.remarks ? <Meta label="Remarks" value={detail.remarks} /> : null}
        </Stack>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Broker", "Lot", "Estate / seller", "Inv.No", "Grade", "Bags", "Net kg", "WH"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: h === "Lot" || h === "Bags" || h === "Net kg" ? "right" : "left",
                    borderBottom: "1px solid #ccc",
                    padding: "6px 4px",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {detail.lots.map((lot) => (
              <tr key={lot.collectionLotId}>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #eee" }}>{lot.broker}</td>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #eee", textAlign: "right", fontWeight: 700 }}>
                  {lot.lotNumber}
                </td>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #eee" }}>
                  {lot.sellerName || lot.sellingMark || "—"}
                </td>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #eee" }}>{lot.invoiceNumber || "—"}</td>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #eee" }}>{lot.grade || "—"}</td>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #eee", textAlign: "right" }}>{lot.bags}</td>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #eee", textAlign: "right" }}>
                  {Number(lot.netWeightKg).toFixed(2)}
                </td>
                <td style={{ padding: "6px 4px", borderBottom: "1px solid #eee", fontSize: 11 }}>
                  {lot.warehouseOrBasis || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
          Collection date: __________ &nbsp;&nbsp; Received by: __________ &nbsp;&nbsp; Prints: {detail.printCount}
        </Typography>
      </Paper>
    </Stack>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <Typography variant="body2">
      <strong>{label}:</strong> {value}
    </Typography>
  );
}

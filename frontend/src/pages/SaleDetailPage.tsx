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
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { getSale, type UploadBatch } from "../api/client";
import { AuctionBoard } from "../components/AuctionBoard";
import { CatalogueLotsTable } from "../components/CatalogueLotsTable";
import { brokerName, currencyFor, formatQuantity, formatSaleDate } from "../catalogue";
import { StatusChip } from "./StatusChip";

export function SaleDetailPage() {
  const { saleId = "" } = useParams();
  const navigate = useNavigate();
  const [showFullCatalogue, setShowFullCatalogue] = useState(false);
  const sale = useQuery({
    queryKey: ["sale", saleId],
    queryFn: () => getSale(saleId),
    enabled: saleId.length > 0,
  });

  const soldCount = useMemo(() => {
    const lots = sale.data?.lots ?? [];
    return lots.filter(
      (lot) =>
        (lot.soldPricePerKg != null && Number(lot.soldPricePerKg) > 0) ||
        Boolean(lot.buyerCode && String(lot.buyerCode).trim()),
    ).length;
  }, [sale.data?.lots]);

  if (sale.isPending) return <CircularProgress aria-label="Loading auction" />;
  if (sale.isError) {
    return (
      <Stack spacing={2}>
        <Button onClick={() => navigate("/auctions")} sx={{ alignSelf: "flex-start" }}>
          All auctions
        </Button>
        <Alert severity="error">{sale.error.message}</Alert>
      </Stack>
    );
  }

  const detail = sale.data;
  const currency = currencyFor(String(detail.centre));
  const showSalesResults = soldCount > 0;
  const totalBags = detail.lots.reduce((sum, lot) => sum + Number(lot.bags || 0), 0);
  const totalKg = detail.lots.reduce((sum, lot) => sum + Number(lot.netWeightKg || 0), 0);

  const catalogueUploads = detail.uploads.filter(
    (upload) => String(upload.kind) !== "PostAuctionSales",
  );
  const salesUploads = detail.uploads.filter((upload) => String(upload.kind) === "PostAuctionSales");

  return (
    <Stack spacing={3}>
      <Button onClick={() => navigate("/auctions")} sx={{ alignSelf: "flex-start" }}>
        All auctions
      </Button>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <div>
          <Typography variant="overline" color="text.secondary">
            Auction view · {detail.centre}
          </Typography>
          <Typography variant="h4">
            Sale {detail.saleNumber}/{detail.year}
          </Typography>
          <Typography color="text.secondary">{formatSaleDate(detail.saleDate)}</Typography>
        </div>
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <Chip label={detail.status} color={detail.status === "Open" ? "success" : "default"} />
          <Button variant="contained" onClick={() => navigate("/upload-sales")}>
            Upload sales
          </Button>
        </Stack>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <SummaryCard label="Lots" value={detail.lots.length.toLocaleString("en-GB")} />
        <SummaryCard label="Bags" value={totalBags.toLocaleString("en-GB")} />
        <SummaryCard label="Net kg" value={formatQuantity(totalKg, 1)} />
        <SummaryCard
          label="Sold lots"
          value={showSalesResults ? soldCount.toLocaleString("en-GB") : "—"}
        />
      </Stack>

      {!showSalesResults ? (
        <Alert
          severity="info"
          action={
            <Button color="inherit" size="small" onClick={() => navigate("/upload-sales")}>
              Upload sales
            </Button>
          }
        >
          No sold price / buyer on this sale yet. Upload the post-auction sales files to fill the auction board.
        </Alert>
      ) : null}

      <div>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Auction board
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Choose All or one broker from the dropdown, then search lot / garden / buyer. Sold and unsold are marked on
          each row.
        </Typography>
        <AuctionBoard lots={detail.lots} currency={currency} />
      </div>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
          <div>
            <Typography variant="subtitle1">Full catalogue columns</Typography>
            <Typography variant="body2" color="text.secondary">
              Factory, invoice, warehouse, source line, and per-column filters.
            </Typography>
          </div>
          <Button variant="outlined" onClick={() => setShowFullCatalogue((value) => !value)}>
            {showFullCatalogue ? "Hide full catalogue" : "Show full catalogue"}
          </Button>
        </Stack>
        {showFullCatalogue ? (
          <Stack sx={{ mt: 2 }}>
            <CatalogueLotsTable
              lots={detail.lots}
              currency={currency}
              showBroker
              showSalesResults={showSalesResults}
            />
          </Stack>
        ) : null}
      </Paper>

      <UploadList title="Sales file uploads" empty="No post-auction sales files for this sale yet." uploads={salesUploads} />
      <UploadList title="Catalogue uploads" empty="No broker catalogues uploaded for this sale yet." uploads={catalogueUploads} />
    </Stack>
  );
}

function UploadList({
  title,
  empty,
  uploads,
}: {
  title: string;
  empty: string;
  uploads: UploadBatch[];
}) {
  const navigate = useNavigate();
  return (
    <div>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {title}
      </Typography>
      {uploads.length === 0 ? (
        <Typography color="text.secondary">{empty}</Typography>
      ) : (
        <Paper sx={{ overflow: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Broker</TableCell>
                <TableCell>File</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Lots</TableCell>
                <TableCell>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uploads.map((upload) => (
                <TableRow key={upload.id} hover>
                  <TableCell>
                    <Button onClick={() => navigate(`/uploads/${upload.id}`)}>
                      {String(upload.broker)} · {brokerName(String(upload.broker))}
                    </Button>
                  </TableCell>
                  <TableCell>{upload.originalFileName}</TableCell>
                  <TableCell>
                    <StatusChip status={String(upload.status)} />
                  </TableCell>
                  <TableCell align="right">{upload.lotCount}</TableCell>
                  <TableCell sx={{ maxWidth: 280, whiteSpace: "normal" }}>{upload.error ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Paper sx={{ p: 2, flex: 1 }}>
      <Typography variant="overline" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" sx={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
        {value}
      </Typography>
    </Paper>
  );
}

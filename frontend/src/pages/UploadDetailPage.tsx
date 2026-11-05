import {
  Alert,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink, useParams } from "react-router-dom";
import { getUpload } from "../api/client";
import { CatalogueLotsTable } from "../components/CatalogueLotsTable";
import { brokerName, currencyFor, formatQuantity, formatSaleDate } from "../catalogue";
import { StatusChip } from "./StatusChip";

export function UploadDetailPage() {
  const { uploadId = "" } = useParams();
  const upload = useQuery({
    queryKey: ["upload", uploadId],
    queryFn: () => getUpload(uploadId),
    enabled: uploadId.length > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "Pending" || status === "Processing") return 1000;
      return false;
    },
  });

  if (upload.isPending) return <CircularProgress aria-label="Loading catalogue upload" />;
  if (upload.isError) {
    return (
      <Stack spacing={2}>
        <Button component={RouterLink} to="/catalogues" sx={{ alignSelf: "flex-start" }}>
          All catalogues
        </Button>
        <Alert severity="error">{upload.error.message}</Alert>
      </Stack>
    );
  }

  const detail = upload.data;
  const currency = currencyFor(String(detail.centre));
  const lots = detail.lots ?? [];
  const totalBags = lots.reduce((sum, lot) => sum + Number(lot.bags || 0), 0);
  const totalKg = lots.reduce((sum, lot) => sum + Number(lot.netWeightKg || 0), 0);
  const isSales = String(detail.kind) === "PostAuctionSales";
  const failed = detail.status === "Failed";

  return (
    <Stack spacing={3}>
      <Button component={RouterLink} to="/catalogues" sx={{ alignSelf: "flex-start" }}>
        All catalogues
      </Button>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <div>
          <Typography variant="overline" color="text.secondary">
            {isSales ? "Post-auction sales" : "Pre-auction catalogue"} · {detail.centre}
          </Typography>
          <Typography variant="h4">
            {String(detail.broker)} · {brokerName(String(detail.broker))}
          </Typography>
          <Typography color="text.secondary">
            Sale {detail.saleNumber}/{detail.year} · {formatSaleDate(detail.saleDate)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {detail.originalFileName}
          </Typography>
        </div>
        <Stack spacing={1} sx={{ alignItems: { md: "flex-end" } }}>
          <StatusChip status={String(detail.status)} />
          {detail.saleId ? (
            <Button component={RouterLink} to={`/auctions/${detail.saleId}?view=catalogue`} variant={failed ? "contained" : "text"}>
              Pre-auction on sale
            </Button>
          ) : null}
        </Stack>
      </Stack>

      {failed ? (
        <Alert
          severity="error"
          action={
            <Stack direction="row" spacing={1}>
              <Button color="inherit" size="small" component={RouterLink} to="/catalogues">
                Back to catalogues
              </Button>
              {detail.saleId ? (
                <Button color="inherit" size="small" component={RouterLink} to={`/auctions/${detail.saleId}?view=catalogue`}>
                  Open pre-auction catalogue
                </Button>
              ) : null}
            </Stack>
          }
        >
          This upload failed, so it has no lot lines. {detail.error ? detail.error : null} Use a completed upload for
          this broker, or open the auction board if other brokers already loaded.
        </Alert>
      ) : null}
      {detail.status === "Pending" || detail.status === "Processing" ? (
        <Alert severity="info">
          {isSales ? "Sales file" : "Catalogue"} is still importing. Lot lines will appear when processing finishes.
        </Alert>
      ) : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <SummaryCard label="Lots" value={lots.length.toLocaleString("en-GB")} />
        <SummaryCard label="Bags" value={totalBags.toLocaleString("en-GB")} />
        <SummaryCard label="Net kg" value={formatQuantity(totalKg, 1)} />
      </Stack>

      <div>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          {isSales ? "Sales results" : "Catalogue lots"}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {failed
            ? "No lots were stored from this failed file."
            : isSales
              ? "Sold price and buyer applied onto matching catalogue lots."
              : "Pre-auction offer book for this broker. Sold price and buyer arrive later with post-auction sales files."}
        </Typography>
        <CatalogueLotsTable
          lots={lots}
          currency={currency}
          showSalesResults={
            isSales ||
            lots.some((lot) => lot.soldPricePerKg != null || (lot.buyerCode && String(lot.buyerCode).trim()))
          }
          emptyMessage={
            failed
              ? "This upload failed — there are no lot details here."
              : detail.status === "Completed"
                ? "No lots were linked from this file."
                : "Lots are not available yet."
          }
        />
      </div>

      {String(detail.kind) !== "PostAuctionSales" ? (
        <Paper sx={{ p: 3, bgcolor: "rgba(31, 77, 58, 0.04)" }}>
          <Typography variant="subtitle1" sx={{ fontFamily: '"Source Serif 4", Georgia, serif' }}>
            After the auction
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            When the sale is over, upload each broker’s sales result file to add sold price and buyer.
          </Typography>
          <Button component={RouterLink} to="/upload-sales" variant="contained">
            Upload sales
          </Button>
        </Paper>
      ) : null}
    </Stack>
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

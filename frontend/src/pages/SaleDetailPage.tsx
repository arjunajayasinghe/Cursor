import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getSale, type UploadBatch } from "../api/client";
import { AuctionBoard } from "../components/AuctionBoard";
import { CatalogueLotsTable } from "../components/CatalogueLotsTable";
import { brokerName, currencyFor, formatQuantity, formatSaleDate } from "../catalogue";
import { StatusChip } from "./StatusChip";

type BoardTab = "auction" | "catalogue";

export function SaleDetailPage() {
  const { saleId = "" } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: BoardTab = searchParams.get("view") === "catalogue" ? "catalogue" : "auction";
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

  function setTab(next: BoardTab) {
    const params = new URLSearchParams(searchParams);
    if (next === "catalogue") params.set("view", "catalogue");
    else params.delete("view");
    setSearchParams(params, { replace: true });
  }

  return (
    <Stack spacing={3}>
      <Button onClick={() => navigate("/auctions")} sx={{ alignSelf: "flex-start" }}>
        All auctions
      </Button>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between" }}>
        <div>
          <Typography variant="overline" color="text.secondary">
            Sale desk · {detail.centre}
          </Typography>
          <Typography variant="h4">
            Sale {detail.saleNumber}/{detail.year}
          </Typography>
          <Typography color="text.secondary">{formatSaleDate(detail.saleDate)}</Typography>
        </div>
        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <Chip label={detail.status} color={detail.status === "Open" ? "success" : "default"} />
          <Button variant="outlined" onClick={() => navigate("/catalogues")}>
            Catalogue uploads
          </Button>
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

      <Paper>
        <Tabs
          value={tab}
          onChange={(_, value: BoardTab) => setTab(value)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab value="auction" label="Auction results (sales)" />
          <Tab value="catalogue" label="Pre-auction catalogue" />
        </Tabs>

        <Stack sx={{ p: 2 }} spacing={2}>
          {tab === "auction" ? (
            <>
              {!showSalesResults ? (
                <Alert
                  severity="info"
                  action={
                    <Button color="inherit" size="small" onClick={() => navigate("/upload-sales")}>
                      Upload sales
                    </Button>
                  }
                >
                  No sold price / buyer yet. Switch to Pre-auction catalogue, or upload sales files.
                </Alert>
              ) : null}
              <Typography color="text.secondary">
                Sold price and buyer from post-auction sales files. Use the broker dropdown and search.
              </Typography>
              <AuctionBoard lots={detail.lots} currency={currency} />
            </>
          ) : (
            <>
              <Typography color="text.secondary">
                Pre-auction offer book — factory, invoice, grade, bags, warehouse, source line. Search under each
                column header. To see upload errors, open Catalogue uploads.
              </Typography>
              <Button
                variant="outlined"
                sx={{ alignSelf: "flex-start" }}
                onClick={() => navigate("/catalogues")}
              >
                Open catalogue uploads / errors
              </Button>
              <CatalogueLotsTable
                lots={detail.lots}
                currency={currency}
                showBroker
                showSalesResults={false}
                emptyMessage="No catalogue lots on this sale yet."
              />
            </>
          )}
        </Stack>
      </Paper>

      <UploadList
        title="Catalogue uploads"
        empty="No broker catalogues uploaded for this sale yet."
        uploads={catalogueUploads}
        openLabel="View catalogue"
      />
      <UploadList
        title="Sales file uploads"
        empty="No post-auction sales files for this sale yet."
        uploads={salesUploads}
        openLabel="View sales"
      />
    </Stack>
  );
}

function UploadList({
  title,
  empty,
  uploads,
  openLabel,
}: {
  title: string;
  empty: string;
  uploads: UploadBatch[];
  openLabel: string;
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
                <TableCell>Open</TableCell>
                <TableCell>Broker</TableCell>
                <TableCell>File</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Lots</TableCell>
                <TableCell>Error / reason</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uploads.map((upload) => (
                <TableRow key={upload.id} hover>
                  <TableCell>
                    <Button size="small" variant="outlined" onClick={() => navigate(`/catalogues/${upload.id}`)}>
                      {upload.status === "Failed" ? "View error" : openLabel}
                    </Button>
                  </TableCell>
                  <TableCell>
                    {String(upload.broker)} · {brokerName(String(upload.broker))}
                  </TableCell>
                  <TableCell>{upload.originalFileName}</TableCell>
                  <TableCell>
                    <StatusChip status={String(upload.status)} />
                  </TableCell>
                  <TableCell align="right">{upload.lotCount}</TableCell>
                  <TableCell sx={{ maxWidth: 320, whiteSpace: "normal" }}>{upload.error ?? ""}</TableCell>
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

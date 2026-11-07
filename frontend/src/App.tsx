import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState, useSyncExternalStore } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getApiKey, setApiKey, subscribeApiKey } from "./api/session";
import { AppLayout } from "./layout/AppLayout";
import { AuctionDataExplorerPage } from "./pages/AuctionDataExplorerPage";
import { SaleDetailPage } from "./pages/SaleDetailPage";
import { SalesPage } from "./pages/SalesPage";
import { InvoiceUploadPage } from "./pages/InvoiceUploadPage";
import { CollectionDetailPage } from "./pages/CollectionDetailPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { PurchaseWorkbenchPage } from "./pages/PurchaseWorkbenchPage";
import { SalesUploadPage } from "./pages/SalesUploadPage";
import { UploadDetailPage } from "./pages/UploadDetailPage";
import { UploadPage } from "./pages/UploadPage";
import { UploadsPage } from "./pages/UploadsPage";

export function App() {
  const apiKey = useSyncExternalStore(subscribeApiKey, getApiKey, getApiKey);
  if (!apiKey) return <KeyGate />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/explorer" replace />} />
        <Route path="explorer" element={<AuctionDataExplorerPage />} />
        <Route path="auctions" element={<SalesPage />} />
        <Route path="auctions/:saleId" element={<SaleDetailPage />} />
        {/* Keep old sale URLs working */}
        <Route path="sales/:saleId" element={<SaleDetailPage />} />
        {/* Upload history / failure reasons */}
        <Route path="catalogues" element={<UploadsPage />} />
        <Route path="uploads" element={<Navigate to="/catalogues" replace />} />
        <Route path="uploads/:uploadId" element={<UploadDetailPage />} />
        <Route path="catalogues/:uploadId" element={<UploadDetailPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="upload-sales" element={<SalesUploadPage />} />
        <Route path="upload-invoices" element={<InvoiceUploadPage />} />
        <Route path="purchases" element={<PurchaseWorkbenchPage />} />
        <Route path="collections" element={<CollectionsPage />} />
        <Route path="collections/:batchId" element={<CollectionDetailPage />} />
        <Route path="*" element={<Navigate to="/explorer" replace />} />
      </Route>
    </Routes>
  );
}

function KeyGate() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", px: 2 }}>
      <Paper sx={{ p: 4, width: "100%", maxWidth: 420 }}>
        <Typography variant="overline" color="text.secondary">
          Broker desk
        </Typography>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Tea auction
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter the API key the desk gave you. It stays in this browser tab.
        </Typography>
        <Stack
          component="form"
          spacing={2}
          onSubmit={(event) => {
            event.preventDefault();
            if (!value.trim()) {
              setError("Enter the API key.");
              return;
            }
            setApiKey(value);
          }}
        >
          {error ? <Alert severity="warning">{error}</Alert> : null}
          <TextField
            label="API key"
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
          />
          <Button type="submit" variant="contained">
            Continue
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

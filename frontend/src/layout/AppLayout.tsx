import SpaIcon from "@mui/icons-material/Spa";
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from "@mui/material";
import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";

const navItems = [
  {
    to: "/explorer",
    label: "Auction Data Explorer",
    match: (path: string) => path.startsWith("/explorer"),
  },
  {
    to: "/auctions",
    label: "Auctions",
    match: (path: string) =>
      path === "/auctions" || path.startsWith("/auctions/") || path.startsWith("/sales/"),
  },
  {
    to: "/catalogues",
    label: "Catalogues",
    match: (path: string) => path.startsWith("/catalogues") || path.startsWith("/uploads"),
  },
  {
    to: "/upload",
    label: "Upload catalogues",
    match: (path: string) => path === "/upload",
  },
  {
    to: "/upload-sales",
    label: "Upload sales",
    match: (path: string) => path === "/upload-sales",
  },
  {
    to: "/upload-invoices",
    label: "Upload invoices",
    match: (path: string) => path === "/upload-invoices",
  },
  {
    to: "/purchases",
    label: "Broker invoices",
    match: (path: string) => path.startsWith("/purchases"),
  },
  {
    to: "/collections",
    label: "Collection",
    match: (path: string) => path.startsWith("/collections"),
  },
  {
    to: "/blending",
    label: "Blending",
    match: (path: string) => path.startsWith("/blending"),
  },
] as const;

export function AppLayout() {
  const location = useLocation();

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="sticky" elevation={0} color="primary">
        <Toolbar sx={{ gap: { xs: 0.5, md: 1 }, flexWrap: "wrap", rowGap: 1, py: 1 }}>
          <SpaIcon fontSize="small" />
          <Box sx={{ mr: { xs: 1, md: 2 }, minWidth: "fit-content" }}>
            <Typography
              variant="overline"
              sx={{ display: "block", lineHeight: 1.1, letterSpacing: "0.16em", opacity: 0.8 }}
            >
              Broker desk
            </Typography>
            <Typography
              variant="h6"
              component={RouterLink}
              to="/explorer"
              sx={{ color: "inherit", textDecoration: "none", whiteSpace: "nowrap" }}
            >
              Tea auction
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ ml: "auto", flexWrap: "wrap" }}>
            {navItems.map((item) => {
              const active = item.match(location.pathname);
              return (
                <Button
                  key={item.to}
                  color="inherit"
                  component={RouterLink}
                  to={item.to}
                  size="small"
                  sx={{
                    fontWeight: active ? 700 : 500,
                    borderBottom: active ? "2px solid currentColor" : "2px solid transparent",
                    borderRadius: 0,
                    px: 1.25,
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>
        </Toolbar>
      </AppBar>
      <Container
        maxWidth={location.pathname.startsWith("/blending") ? false : "lg"}
        sx={{ py: 4, px: location.pathname.startsWith("/blending") ? { xs: 2, md: 3 } : undefined }}
      >
        <Outlet />
      </Container>
      <Stack component="footer" sx={{ px: 3, pb: 3, color: "text.secondary" }}>
        <Typography variant="caption">
          Auction Data Explorer — pre-auction catalogues and after-sales results in one place.
        </Typography>
      </Stack>
    </Box>
  );
}

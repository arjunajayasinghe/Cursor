import SpaIcon from "@mui/icons-material/Spa";
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from "@mui/material";
import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";

const navItems = [
  { to: "/auctions", label: "Auctions", match: (path: string) => path === "/auctions" || path.startsWith("/auctions/") || path.startsWith("/sales/") },
  { to: "/uploads", label: "Uploads", match: (path: string) => path.startsWith("/uploads") },
  { to: "/upload", label: "Upload catalogues", match: (path: string) => path === "/upload" },
  { to: "/upload-sales", label: "Upload sales", match: (path: string) => path === "/upload-sales" },
] as const;

export function AppLayout() {
  const location = useLocation();

  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="sticky" elevation={0} color="primary">
        <Toolbar sx={{ gap: 1, flexWrap: "wrap" }}>
          <SpaIcon fontSize="small" />
          <Box sx={{ flexGrow: 1, minWidth: 160 }}>
            <Typography variant="overline" sx={{ display: "block", lineHeight: 1.1, letterSpacing: "0.16em", opacity: 0.8 }}>
              Broker desk
            </Typography>
            <Typography
              variant="h6"
              component={RouterLink}
              to="/auctions"
              sx={{ color: "inherit", textDecoration: "none" }}
            >
              Tea auction
            </Typography>
          </Box>
          {navItems.map((item) => {
            const active = item.match(location.pathname);
            return (
              <Button
                key={item.to}
                color="inherit"
                component={RouterLink}
                to={item.to}
                sx={{
                  fontWeight: active ? 700 : 500,
                  borderBottom: active ? "2px solid currentColor" : "2px solid transparent",
                  borderRadius: 0,
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
      <Stack component="footer" sx={{ px: 3, pb: 3, color: "text.secondary" }}>
        <Typography variant="caption">Colombo, Mombasa, Kochi, Jakarta, and Kolkata auctions.</Typography>
      </Stack>
    </Box>
  );
}

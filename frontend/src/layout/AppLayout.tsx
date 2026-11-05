import SpaIcon from "@mui/icons-material/Spa";
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from "@mui/material";
import { Link as RouterLink, Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar position="sticky" elevation={0} color="primary">
        <Toolbar sx={{ gap: 1 }}>
          <SpaIcon fontSize="small" />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="overline" sx={{ display: "block", lineHeight: 1.1, letterSpacing: "0.16em", opacity: 0.8 }}>
              Broker desk
            </Typography>
            <Typography variant="h6" component={RouterLink} to="/" sx={{ color: "inherit", textDecoration: "none" }}>
              Tea auction catalogue
            </Typography>
          </Box>
          <Button color="inherit" component={RouterLink} to="/">
            Sales
          </Button>
          <Button color="inherit" component={RouterLink} to="/uploads">
            Uploads
          </Button>
          <Button color="inherit" component={RouterLink} to="/upload">
            Upload
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
      <Stack component="footer" sx={{ px: 3, pb: 3, color: "text.secondary" }}>
        <Typography variant="caption">Colombo, Mombasa, Kochi, Jakarta, and Kolkata catalogues.</Typography>
      </Stack>
    </Box>
  );
}

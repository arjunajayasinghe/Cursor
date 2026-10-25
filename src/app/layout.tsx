import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aetria Process Mapping",
  description: "Multi-tenant APQC-style process repository",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteMetadata } from "@/data/landing";
import "./globals.css";

export const metadata: Metadata = {
  title: siteMetadata.title,
  description: siteMetadata.description
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

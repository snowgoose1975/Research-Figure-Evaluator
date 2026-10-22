import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Figure Relay | Research figure evaluation",
  description: "Trace what a reader understands, remembers, and can reconstruct from a scientific figure.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

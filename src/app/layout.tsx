import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Promosikan.com — Temukan yang Butuh. Tawarkan yang Tepat.",
  description: "Platform customer discovery dan smart promotion untuk bisnis Indonesia.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" className={cn("font-sans", geist.variable)}><body>{children}</body></html>;
}

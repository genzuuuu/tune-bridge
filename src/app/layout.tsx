import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Manrope, Noto_Sans_SC, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["600", "700", "800"],
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "500", "600", "700"],
});

const notoSansSc = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-noto",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "歌单渡口 · QQ 音乐 → Apple Music",
  description:
    "把 QQ 音乐歌单转换成 Apple Music 可导入的 CSV / TXT / M3U，并附带导入步骤。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${syne.variable} ${manrope.variable} ${notoSansSc.variable}`}
        style={
          {
            "--font-display":
              "var(--font-syne), var(--font-noto), sans-serif",
            "--font-body":
              "var(--font-manrope), var(--font-noto), sans-serif",
          } as CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}

import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개발 검토서 (2026 Q2) - 기능 명세 및 일정 산정",
  description: "사내 개발 검토 문서",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

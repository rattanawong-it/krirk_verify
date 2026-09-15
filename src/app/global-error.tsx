"use client";

import Link from "next/link";

// F-UX-09 — ข้อผิดพลาดระดับ root layout: ไม่มี provider ของ next-intl ให้ใช้ จึงแสดงข้อความสองภาษาแบบคงที่
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="th">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f6f8f4",
          color: "#16210f",
          padding: 16,
        }}
      >
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>ระบบขัดข้องชั่วคราว</h1>
          <p lang="en" style={{ margin: "0 0 16px", color: "#5b6655" }}>
            The service is temporarily unavailable.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#5b6655" }}>
              {error.digest}
            </p>
          )}
          <Link
            href="/"
            style={{
              display: "inline-block",
              marginTop: 8,
              padding: "12px 20px",
              borderRadius: 8,
              background: "#1c6b21",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            กลับหน้าแรก · Home
          </Link>
        </main>
      </body>
    </html>
  );
}

import { notFound } from "next/navigation";

// ส่ง path ที่ไม่มีอยู่ไปยัง [locale]/not-found.tsx เพื่อให้ได้หน้า 404 ที่แปลภาษาแล้ว
export default function CatchAll() {
  notFound();
}

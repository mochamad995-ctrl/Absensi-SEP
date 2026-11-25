export const VALID_STATUSES = ["Belum", "Hadir", "Izin", "Sakit", "Alfa"] as const;
export type AttendanceStatus = (typeof VALID_STATUSES)[number];

export function normalisasiNamaEkstra(str: unknown): string {
  if (!str) return "";
  let s = String(str).replace(/\u00A0/g, " ").trim();
  s = s.replace(/\s*\(\s*(Putra|Putri)\s*\)\s*$/i, "");
  s = s.replace(/\s+(Putra|Putri)\s*$/i, "");
  return s.trim();
}

export function normalisasiGender(str: unknown): string {
  if (!str) return "";
  const s = String(str).replace(/\u00A0/g, " ").trim().toLowerCase();
  if (s === "l" || s === "laki-laki" || s === "putra" || s === "pria") return "l";
  if (s === "p" || s === "perempuan" || s === "putri" || s === "wanita") return "p";
  return s;
}

export function inferGenderFromKelas(kelas: unknown): string {
  if (!kelas) return "";
  const k = String(kelas).replace(/\u00A0/g, " ").toUpperCase().trim();
  if (/^X1[0-5]/.test(k)) return "p";
  if (
    k.includes("A2") || k.includes("A3") || k.includes("B2") ||
    k.includes("C3") || k.includes("C4") || k.includes("ICP 1") ||
    k.includes("BBC 1") || k.includes("IUPP 1")
  ) return "p";
  if (/^X[1-9]($|\s)/.test(k)) return "l";
  if (
    k.includes("A1") || k.includes("B1") || k.includes("C1") ||
    k.includes("C2") || k.includes("E1") || k.includes("ICP 2") ||
    k.includes("BBC 2") || k.includes("CTP") || k.includes("IUPP 2") ||
    k.includes("IUPP 3")
  ) return "l";
  return "";
}

export function getTodayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getNowTimestampJakarta(): string {
  const now = new Date();
  const datePart = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  return `${datePart} ${timePart}`;
}

export function konversiNilaiRapot(nilai: unknown): { predikat: string; deskripsi: string } {
  if (nilai === "" || nilai === null || nilai === undefined) {
    return { predikat: "-", deskripsi: "-" };
  }
  const n = parseFloat(String(nilai));
  if (isNaN(n)) return { predikat: "-", deskripsi: "-" };

  let predikat = "C";
  if (n >= 91.6) predikat = "A";
  else if (n >= 83.4) predikat = "A-";
  else if (n >= 75.1) predikat = "B+";
  else if (n >= 66.6) predikat = "B";
  else if (n >= 58.4) predikat = "B-";

  let deskripsi = "Perlu pendampingan dalam meningkatkan kompetensi yang diajarkan";
  if (n > 87.0) {
    deskripsi = "Mengikuti kompetensi dan performasi yang diajarkan dengan sangat baik";
  } else if (n >= 74.0) {
    deskripsi = "Mengikuti kompetensi dan performasi yang diajarkan dengan baik";
  } else if (n >= 60.0) {
    deskripsi = "Mengikuti kompetensi dan performasi yang diajarkan dengan cukup";
  }

  return { predikat, deskripsi };
}

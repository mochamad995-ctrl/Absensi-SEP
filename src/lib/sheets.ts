import { google } from "googleapis";
import {
  normalisasiNamaEkstra,
  normalisasiGender,
  inferGenderFromKelas,
  getTodayJakarta,
} from "./utils";

const SPREADSHEET_ID =
  process.env.GOOGLE_SPREADSHEET_ID ||
  "1p7x8l12EZs0yCJm2amkAp_agXbyg15YgXsSsS2rmZTg";

export function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "Kredensial Google Sheets API belum diatur di Environment Variables (.env.local / Vercel)."
    );
  }

  const privateKey = rawKey.replace(/\\n/g, "\n");
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

export async function getSheetValues(range: string): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return (res.data.values as string[][]) || [];
}

export async function updateSheetValues(range: string, values: unknown[][]) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export async function appendSheetValues(range: string, values: unknown[][]) {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

export interface EkstraInfo {
  nama: string;
  pengajar: string;
  gender: string;
  displayName: string;
}

export async function getDaftarEkstra(): Promise<EkstraInfo[]> {
  const rows = await getSheetValues("Info_Ekstra!A2:C100");
  const list: EkstraInfo[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const nama = row[0] ? String(row[0]).trim() : "";
    const pengajar = row[1] ? String(row[1]).trim() : "-";
    const gender = row[2] ? String(row[2]).trim() : "";
    if (!nama) continue;

    const displayName = gender ? `${nama} (${gender})` : nama;
    if (!seen.has(displayName)) {
      seen.add(displayName);
      list.push({ nama, pengajar, gender, displayName });
    }
  }
  return list;
}

export interface StudentRecord {
  rowId: number;
  nama: string;
  kelas: string;
  gender: string;
  genderCode: string;
  ekstraRaw: string;
  nilai: string;
  kamar: string;
}

export async function getSiswaByEkstraDanGender(
  namaEkstraSelected: string
): Promise<StudentRecord[]> {
  if (!namaEkstraSelected) return [];

  const cleanSelected = String(namaEkstraSelected).replace(/\u00A0/g, " ").trim();
  const match = cleanSelected.match(/^(.*?)(?:\s*\(\s*(Putra|Putri)\s*\))?$/i);
  const namaEkstraOnly =
    match && match[1]
      ? normalisasiNamaEkstra(match[1]).toLowerCase()
      : normalisasiNamaEkstra(cleanSelected).toLowerCase();
  const genderTarget = match && match[2] ? normalisasiGender(match[2]) : "";

  const rows = await getSheetValues("Data_Siswa!A2:G900");
  const result: StudentRecord[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sNama = String(row[0] || "").replace(/\u00A0/g, " ").trim();
    const rawEkstra = String(row[1] || "").replace(/\u00A0/g, " ").trim();
    const sKelas = row[2] !== undefined ? String(row[2]).replace(/\u00A0/g, " ").trim() : "";
    const sGenderRaw = row[3] !== undefined ? String(row[3]).replace(/\u00A0/g, " ").trim() : "";

    if (!sNama || !rawEkstra || sNama.toLowerCase() === "nama") continue;

    const sEkstraPure = normalisasiNamaEkstra(rawEkstra).toLowerCase();
    if (sEkstraPure !== namaEkstraOnly) continue;

    let sGenderCode = normalisasiGender(sGenderRaw);
    if (!sGenderCode) {
      const mG = rawEkstra.match(/\((Putra|Putri)\)/i);
      if (mG) sGenderCode = normalisasiGender(mG[1]);
    }
    if (!sGenderCode) {
      sGenderCode = inferGenderFromKelas(sKelas);
    }

    if (genderTarget && sGenderCode && sGenderCode !== genderTarget) {
      continue;
    }

    const genderDisplay =
      sGenderCode === "l" ? "Putra" : sGenderCode === "p" ? "Putri" : sGenderRaw || "-";

    result.push({
      rowId: i + 2,
      nama: sNama,
      kelas: sKelas,
      gender: genderDisplay,
      genderCode: sGenderCode,
      ekstraRaw: rawEkstra,
      nilai: row[5] !== undefined && row[5] !== null ? String(row[5]).trim() : "",
      kamar: row[6] ? String(row[6]).trim() : "-",
    });
  }

  result.sort((a, b) => a.nama.localeCompare(b.nama, "id", { sensitivity: "base" }));
  return result;
}

export async function getStatusHariIniMap(
  namaEkstraOnlyLower: string,
  dateStr?: string
): Promise<Record<string, string>> {
  const today = dateStr || getTodayJakarta();
  const rows = await getSheetValues("Log_Absensi!A1:AZ1000");
  if (rows.length < 2) return {};

  const headers = rows[0];
  let dateCol = -1;
  for (let c = 7; c < headers.length; c++) {
    if (String(headers[c] || "").trim() === today) {
      dateCol = c;
      break;
    }
  }
  if (dateCol === -1) return {};

  const map: Record<string, string> = {};
  for (let i = 1; i < rows.length; i++) {
    const e = normalisasiNamaEkstra(rows[i][4]).toLowerCase();
    if (namaEkstraOnlyLower && e !== namaEkstraOnlyLower) continue;
    const n = String(rows[i][2] || "").trim().toLowerCase();
    const status = String(rows[i][dateCol] || "").trim();
    if (n && status && status.toLowerCase() !== "belum") {
      map[n] = status;
    }
  }
  return map;
}

export { SPREADSHEET_ID };

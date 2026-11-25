import { NextRequest, NextResponse } from "next/server";
import {
  getSheetValues,
  updateSheetValues,
  appendSheetValues,
} from "@/lib/sheets";
import {
  getTodayJakarta,
  getNowTimestampJakarta,
  normalisasiNamaEkstra,
} from "@/lib/utils";

interface AbsensiItem {
  nama: string;
  kelas: string;
  ekstra: string;
  status: string;
}

function colIndexToLetter(colIndex0Based: number): string {
  let temp = colIndex0Based + 1;
  let letter = "";
  while (temp > 0) {
    const rem = (temp - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: AbsensiItem[] = body?.items || [];
    if (!items.length) {
      return NextResponse.json(
        { success: false, message: "Tidak ada data absensi yang dikirim." },
        { status: 400 }
      );
    }

    const today = getTodayJakarta();
    const nowTs = getNowTimestampJakarta();

    // 1. Baca Log_Absensi
    const rows = await getSheetValues("Log_Absensi!A1:AZ1000");
    const headers = rows[0] || [
      "TIMESTAMP",
      "TANGGAL",
      "NAMA",
      "KELAS",
      "EKSTRA",
      "STATUS",
      "KETERANGAN",
    ];

    let dateColIdx = -1;
    for (let c = 7; c < headers.length; c++) {
      if (String(headers[c] || "").trim() === today) {
        dateColIdx = c;
        break;
      }
    }

    // Jika kolom tanggal hari ini belum ada, tambahkan di header
    if (dateColIdx === -1) {
      dateColIdx = Math.max(7, headers.length);
      const colLetter = colIndexToLetter(dateColIdx);
      await updateSheetValues(`Log_Absensi!${colLetter}1`, [[today]]);
    }

    const dateColLetter = colIndexToLetter(dateColIdx);

    // Map baris yang sudah ada berdasarkan nama_lowercase + ekstra_lowercase
    const existingMap = new Map<string, number>();
    for (let r = 1; r < rows.length; r++) {
      const rNama = String(rows[r][2] || "").trim().toLowerCase();
      const rEkstra = normalisasiNamaEkstra(rows[r][4]).toLowerCase();
      if (rNama) {
        existingMap.set(`${rNama}_${rEkstra}`, r + 1);
      }
    }

    const rowsToAppend: unknown[][] = [];

    for (const item of items) {
      const nama = String(item.nama || "").trim();
      const kelas = String(item.kelas || "").trim();
      const ekstra = String(item.ekstra || "").trim();
      const ekstraPure = normalisasiNamaEkstra(ekstra).toLowerCase();
      const status = String(item.status || "Belum").trim();
      if (!nama) continue;

      const key = `${nama.toLowerCase()}_${ekstraPure}`;
      const existingRow = existingMap.get(key);

      if (existingRow) {
        await updateSheetValues(
          `Log_Absensi!${dateColLetter}${existingRow}`,
          [[status]]
        );
      } else {
        const newRow = new Array(dateColIdx + 1).fill("");
        newRow[0] = nowTs;
        newRow[1] = today;
        newRow[2] = nama;
        newRow[3] = kelas;
        newRow[4] = ekstra;
        newRow[5] = status;
        newRow[6] = "Web App";
        newRow[dateColIdx] = status;
        rowsToAppend.push(newRow);
      }
    }

    if (rowsToAppend.length > 0) {
      await appendSheetValues("Log_Absensi!A1", rowsToAppend);
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menyimpan ${items.length} status absensi.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

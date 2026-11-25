import { NextRequest, NextResponse } from "next/server";
import {
  getSheetValues,
  getSiswaByEkstraDanGender,
  updateSheetValues,
  appendSheetValues,
} from "@/lib/sheets";
import {
  normalisasiNamaEkstra,
  konversiNilaiRapot,
  getNowTimestampJakarta,
} from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const ekstra = req.nextUrl.searchParams.get("ekstra") || "";
    const cleanSelected = ekstra.replace(/\u00A0/g, " ").trim();
    if (!cleanSelected) {
      return NextResponse.json(
        { success: false, message: "Pilih ekstrakulikuler terlebih dahulu.", students: [] },
        { status: 400 }
      );
    }

    const match = cleanSelected.match(/^(.*?)(?:\s*\(\s*(Putra|Putri)\s*\))?$/i);
    const namaEkstraOnly =
      match && match[1]
        ? normalisasiNamaEkstra(match[1]).toLowerCase()
        : normalisasiNamaEkstra(cleanSelected).toLowerCase();

    const [rapotRows, baseStudents] = await Promise.all([
      getSheetValues("Nilai_Rapot!A2:H1000").catch(() => [] as string[][]),
      getSiswaByEkstraDanGender(cleanSelected),
    ]);

    const mapRapot = new Map<string, { nilai: string }>();
    for (const r of rapotRows) {
      const rNama = String(r[1] || "").trim();
      const rEkstra = normalisasiNamaEkstra(r[4]).toLowerCase();
      if (!rNama) continue;
      mapRapot.set(`${rNama.toLowerCase()}_${rEkstra}`, {
        nilai: r[5] !== undefined && r[5] !== null ? String(r[5]) : "",
      });
    }

    const students = baseStudents.map((s) => {
      const key = `${s.nama.toLowerCase()}_${namaEkstraOnly}`;
      const saved = mapRapot.get(key);
      const curNilai = saved && saved.nilai !== "" ? saved.nilai : s.nilai || "";
      const konv = konversiNilaiRapot(curNilai);

      return {
        rowId: s.rowId,
        nama: s.nama,
        kelas: s.kelas,
        gender: s.gender,
        ekstra: cleanSelected,
        nilai: curNilai,
        predikat: konv.predikat,
        deskripsi: konv.deskripsi,
      };
    });

    return NextResponse.json({
      success: true,
      ekstra: cleanSelected,
      count: students.length,
      students,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { success: false, message: `Error backend: ${message}`, students: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = body?.items || [];
    if (!items.length) {
      return NextResponse.json(
        { success: false, message: "Tidak ada data nilai yang dikirim." },
        { status: 400 }
      );
    }

    const nowTs = getNowTimestampJakarta();
    const existingRows = await getSheetValues("Nilai_Rapot!B2:E1000").catch(
      () => [] as string[][]
    );
    const existingMap = new Map<string, number>();

    for (let r = 0; r < existingRows.length; r++) {
      const exNama = String(existingRows[r][0] || "").trim().toLowerCase();
      const exSep = normalisasiNamaEkstra(existingRows[r][3]).toLowerCase();
      if (exNama) {
        existingMap.set(`${exNama}_${exSep}`, r + 2);
      }
    }

    const rowsToAppend: unknown[][] = [];
    let updatedCount = 0;

    for (const it of items) {
      const nama = String(it.nama || "").trim();
      const kelas = String(it.kelas || "").trim();
      const jk = String(it.gender || "").trim();
      const ekstra = String(it.ekstra || "").trim();
      const ekstraOnly = normalisasiNamaEkstra(ekstra).toLowerCase();
      const nilai =
        it.nilai !== undefined && it.nilai !== null ? String(it.nilai).trim() : "";

      if (!nama) continue;

      const konv = konversiNilaiRapot(nilai);
      const numericNilai = nilai !== "" ? parseFloat(nilai) || nilai : "";
      const key = `${nama.toLowerCase()}_${ekstraOnly}`;
      const existingRow = existingMap.get(key);

      if (existingRow) {
        await updateSheetValues(`Nilai_Rapot!A${existingRow}`, [[nowTs]]);
        await updateSheetValues(`Nilai_Rapot!F${existingRow}:H${existingRow}`, [
          [numericNilai, konv.predikat, konv.deskripsi],
        ]);
        updatedCount++;
      } else {
        rowsToAppend.push([
          nowTs,
          nama,
          kelas,
          jk,
          ekstra,
          numericNilai,
          konv.predikat,
          konv.deskripsi,
        ]);
      }
    }

    if (rowsToAppend.length > 0) {
      await appendSheetValues("Nilai_Rapot!A1", rowsToAppend);
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menyimpan ${updatedCount + rowsToAppend.length} nilai siswa ke sheet Nilai_Rapot.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

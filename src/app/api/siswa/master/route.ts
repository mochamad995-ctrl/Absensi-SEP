import { NextRequest, NextResponse } from "next/server";
import { getSheetValues, updateSheetValues } from "@/lib/sheets";
import { normalisasiGender, inferGenderFromKelas } from "@/lib/utils";

export async function GET() {
  try {
    const rows = await getSheetValues("Data_Siswa!A2:D900");
    const list = [];

    for (let i = 0; i < rows.length; i++) {
      const nama = String(rows[i][0] || "").replace(/\u00A0/g, " ").trim();
      const ekstra = String(rows[i][1] || "").replace(/\u00A0/g, " ").trim();
      const kelas = String(rows[i][2] || "").replace(/\u00A0/g, " ").trim();
      const rawJk = String(rows[i][3] || "").replace(/\u00A0/g, " ").trim();

      if (!nama || nama.toLowerCase() === "nama") continue;

      let g = normalisasiGender(rawJk);
      if (!g) {
        const mG = ekstra.match(/\((Putra|Putri)\)/i);
        if (mG) g = normalisasiGender(mG[1]);
      }
      if (!g) g = inferGenderFromKelas(kelas);
      const jkDisplay = g === "l" ? "Putra" : g === "p" ? "Putri" : rawJk || "-";

      list.push({
        rowId: i + 2,
        nama,
        ekstraLama: ekstra || "Belum Ada",
        kelas,
        jk: jkDisplay,
      });
    }

    list.sort((a, b) => a.nama.localeCompare(b.nama, "id", { sensitivity: "base" }));
    return NextResponse.json(
      { success: true, students: list },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message, students: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { rowId, namaExpected, ekstraBaru } = await req.json();
    const rId = parseInt(String(rowId), 10);

    if (isNaN(rId) || rId < 2) {
      return NextResponse.json(
        { success: false, message: "Baris data siswa tidak valid!" },
        { status: 400 }
      );
    }

    const currentRows = await getSheetValues(`Data_Siswa!A${rId}:C${rId}`);
    const namaAktual = String(currentRows[0]?.[0] || "").trim();

    if (
      namaExpected &&
      namaAktual.toLowerCase() !== String(namaExpected).trim().toLowerCase()
    ) {
      return NextResponse.json(
        { success: false, message: "Data telah bergeser. Silakan ulangi pencarian." },
        { status: 409 }
      );
    }

    await updateSheetValues(`Data_Siswa!B${rId}`, [[ekstraBaru]]);

    return NextResponse.json({
      success: true,
      message: `${namaAktual} berhasil dipindahkan ke ${ekstraBaru}.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

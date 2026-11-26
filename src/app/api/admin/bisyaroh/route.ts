import { NextRequest, NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets";

const BISYAROH_SPREADSHEET_ID =
  process.env.GOOGLE_BISYAROH_SPREADSHEET_ID ||
  "1ReOMo2pIFPDPvDrfgCsPAN-XW5_IPkDW3oIKuV6OrMU";

export async function GET(req: NextRequest) {
  try {
    const sheets = getSheetsClient();
    const targetSheet = req.nextUrl.searchParams.get("sheet");

    const meta = await sheets.spreadsheets.get({
      spreadsheetId: BISYAROH_SPREADSHEET_ID,
      fields: "sheets.properties.title",
    });

    const allTitles = (meta.data.sheets || [])
      .map((s) => s.properties?.title || "")
      .filter(Boolean);

    const periods = allTitles
      .filter((name) => {
        const up = name.toUpperCase();
        return (
          up.startsWith("ABSENSI") ||
          up.startsWith("ARSIP") ||
          up.startsWith("REKAP")
        );
      })
      .map((name) => ({
        name,
        isActive: name.toUpperCase() === "ABSENSI",
      }));

    const activeSheet =
      (targetSheet && allTitles.includes(targetSheet) ? targetSheet : null) ||
      periods.find((p) => p.isActive)?.name ||
      periods[0]?.name ||
      allTitles[0];

    if (!activeSheet) {
      return NextResponse.json({
        success: true,
        periods: [],
        currentSheet: "",
        dates: ["", "", "", "", ""],
        list: [],
      });
    }

    const bisyarohSheets = allTitles.filter((name) =>
      name.toUpperCase().startsWith("BISYAROH")
    );
    const activeBisyarohSheet = bisyarohSheets[0] || "";

    const [datesRes, dataRes, eksternalRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: BISYAROH_SPREADSHEET_ID,
        range: `'${activeSheet}'!E3:I3`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: BISYAROH_SPREADSHEET_ID,
        range: `'${activeSheet}'!B4:I200`,
      }),
      activeBisyarohSheet
        ? sheets.spreadsheets.values
            .get({
              spreadsheetId: BISYAROH_SPREADSHEET_ID,
              range: `'${activeBisyarohSheet}'!A2:J150`,
            })
            .catch(() => ({ data: { values: [] } }))
        : Promise.resolve({ data: { values: [] } }),
    ]);

    const rawDates = datesRes.data.values?.[0] || [];
    const dates = [0, 1, 2, 3, 4].map((i) =>
      rawDates[i] ? String(rawDates[i]).trim() : ""
    );

    const rows = dataRes.data.values || [];
    const list = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const ekstra = r[0] ? String(r[0]).trim() : "";
      const pengajar = r[1] ? String(r[1]).trim() : "";
      const kategori = r[2] ? String(r[2]).trim() : "";
      if (!pengajar) continue;

      const p1 = r[3] ? String(r[3]).trim() : "";
      const p2 = r[4] ? String(r[4]).trim() : "";
      const p3 = r[5] ? String(r[5]).trim() : "";
      const p4 = r[6] ? String(r[6]).trim() : "";
      const p5 = r[7] ? String(r[7]).trim() : "";

      let totalHadir = 0;
      for (const st of [p1, p2, p3, p4, p5]) {
        if (st.toLowerCase() === "hadir") totalHadir++;
      }

      list.push({
        rowIndex: i + 4,
        ekstra: ekstra || "-",
        pengajar,
        kategori: kategori || "-",
        p1: p1 || "-",
        p2: p2 || "-",
        p3: p3 || "-",
        p4: p4 || "-",
        p5: p5 || "-",
        totalHadir,
      });
    }

    // Parse Guru Eksternal from BISYAROH sheet
    const eksternalRows = (eksternalRes.data.values as string[][]) || [];
    const eksternalList = [];
    let lastNo = "";
    let lastKegiatan = "";

    for (const r of eksternalRows) {
      const no = r[0] ? String(r[0]).trim() : lastNo;
      const kegiatan = r[1] ? String(r[1]).trim() : lastKegiatan;
      if (r[0]) lastNo = no;
      if (r[1]) lastKegiatan = kegiatan;

      const gender = r[2] ? String(r[2]).trim() : "";
      const pembimbing = r[3] ? String(r[3]).trim() : "";
      if (!pembimbing && !gender) continue;

      eksternalList.push({
        no: no || "-",
        kegiatan: kegiatan || "-",
        gender: gender || "-",
        pembimbing: pembimbing || "-",
        frekuensi: r[4] ? String(r[4]).trim() : "0",
        nominal: r[5] ? String(r[5]).trim() : "0",
        subTotal: r[6] ? String(r[6]).trim() : "0",
        total: r[7] ? String(r[7]).trim() : "0",
      });
    }

    return NextResponse.json(
      {
        success: true,
        periods,
        currentSheet: activeSheet,
        dates,
        list,
        bisyarohSheetName: activeBisyarohSheet,
        eksternalList,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sheets = getSheetsClient();
    const sheetName = body.sheetName;
    if (!sheetName) {
      return NextResponse.json(
        { success: false, message: "Nama sheet belum dipilih." },
        { status: 400 }
      );
    }

    if (body.action === "save_dates") {
      const dates: string[] = body.dates || ["", "", "", "", ""];
      await sheets.spreadsheets.values.update({
        spreadsheetId: BISYAROH_SPREADSHEET_ID,
        range: `'${sheetName}'!E3:I3`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [dates.slice(0, 5)] },
      });
      return NextResponse.json({
        success: true,
        message: "Tanggal pertemuan P1-P5 berhasil disimpan!",
      });
    }

    if (body.action === "save_presensi") {
      const colLetter = body.colLetter as string; // E, F, G, H, or I
      const items: { rowIndex: number; status: string }[] = body.items || [];
      if (!colLetter || !["E", "F", "G", "H", "I"].includes(colLetter)) {
        return NextResponse.json(
          { success: false, message: "Kolom pertemuan tidak valid." },
          { status: 400 }
        );
      }

      const data = items.map((it) => ({
        range: `'${sheetName}'!${colLetter}${it.rowIndex}`,
        values: [[it.status === "-" ? "" : it.status]],
      }));

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: BISYAROH_SPREADSHEET_ID,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Presensi guru (${colLetter}) berhasil disimpan ke Spreadsheet!`,
      });
    }

    return NextResponse.json(
      { success: false, message: "Aksi tidak dikenal." },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

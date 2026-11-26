import { NextResponse } from "next/server";
import { getSheetsClient, getSheetValues, SPREADSHEET_ID } from "@/lib/sheets";

export async function GET() {
  try {
    const sheets = getSheetsClient();
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: "sheets.properties.title",
    });

    const titles = (meta.data.sheets || [])
      .map((s) => s.properties?.title || "")
      .filter(Boolean);

    // Cari sheet denah Putra & Putri (sesuai nama di spreadsheet)
    const putraTitle =
      titles.find((t) => t.toUpperCase().includes("SMP")) ||
      titles.find((t) => t.toUpperCase().includes("PUTRA")) ||
      "DENAH EKSTRA SEP GEDUNG SMP PUT";

    const putriTitle =
      titles.find((t) => t.toUpperCase().includes("GEDUNG A")) ||
      titles.find((t) => t.toUpperCase().includes("PUTRI")) ||
      "DENAH EKSTRA SEP GEDUNG A SMA";

    const [putraRows, putriRows] = await Promise.all([
      getSheetValues(`'${putraTitle}'!A1:Z60`).catch(() => [] as string[][]),
      getSheetValues(`'${putriTitle}'!A1:Z60`).catch(() => [] as string[][]),
    ]);

    return NextResponse.json({
      success: true,
      putra: { title: putraTitle, rows: putraRows },
      putri: { title: putriTitle, rows: putriRows },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

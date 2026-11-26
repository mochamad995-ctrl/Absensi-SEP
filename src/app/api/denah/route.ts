import { NextResponse } from "next/server";
import { getSheetsClient, SPREADSHEET_ID } from "@/lib/sheets";

interface ColorRGB {
  red?: number | null;
  green?: number | null;
  blue?: number | null;
}

function rgbToHex(c?: ColorRGB | null): string | null {
  if (!c) return null;
  const r = Math.round((c.red ?? 0) * 255);
  const g = Math.round((c.green ?? 0) * 255);
  const b = Math.round((c.blue ?? 0) * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

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

    const putraTitle =
      titles.find((t) => t.toUpperCase().includes("SMP")) ||
      titles.find((t) => t.toUpperCase().includes("PUTRA")) ||
      "DENAH EKSTRA SEP GEDUNG SMP PUT";

    const putriTitle =
      titles.find((t) => t.toUpperCase().includes("GEDUNG A")) ||
      titles.find((t) => t.toUpperCase().includes("PUTRI")) ||
      "DENAH EKSTRA SEP GEDUNG A SMA";

    const gridRes = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      ranges: [`'${putraTitle}'!A1:P35`, `'${putriTitle}'!A1:P35`],
      includeGridData: true,
      fields:
        "sheets(properties.title,merges,data.rowData.values(formattedValue,effectiveFormat(backgroundColor,textFormat(foregroundColor,bold))))",
    });

    const parseSheetGrid = (sheetObj: NonNullable<typeof gridRes.data.sheets>[number] | undefined, fallbackTitle: string) => {
      if (!sheetObj) return { title: fallbackTitle, rows: [], merges: [] };
      const rowData = sheetObj.data?.[0]?.rowData || [];
      const rows = rowData.map((r) =>
        (r.values || []).map((cell) => ({
          val: cell.formattedValue || "",
          bg: rgbToHex(cell.effectiveFormat?.backgroundColor),
          fg: rgbToHex(cell.effectiveFormat?.textFormat?.foregroundColor),
          bold: Boolean(cell.effectiveFormat?.textFormat?.bold),
        }))
      );

      const merges = (sheetObj.merges || []).map((m) => ({
        startRow: m.startRowIndex ?? 0,
        endRow: m.endRowIndex ?? 0,
        startCol: m.startColumnIndex ?? 0,
        endCol: m.endColumnIndex ?? 0,
      }));

      return {
        title: sheetObj.properties?.title || fallbackTitle,
        rows,
        merges,
      };
    };

    const allSheets = gridRes.data.sheets || [];
    const putraSheet = allSheets.find((s) => s.properties?.title === putraTitle);
    const putriSheet = allSheets.find((s) => s.properties?.title === putriTitle);

    return NextResponse.json(
      {
        success: true,
        putra: parseSheetGrid(putraSheet, putraTitle),
        putri: parseSheetGrid(putriSheet, putriTitle),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

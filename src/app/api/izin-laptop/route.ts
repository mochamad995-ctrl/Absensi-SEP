import { NextRequest, NextResponse } from "next/server";
import { appendSheetValues } from "@/lib/sheets";
import { getNowTimestampJakarta, getTodayJakarta } from "@/lib/utils";

interface LaptopItem {
  nama: string;
  kelas: string;
  ekstra: string;
  keperluan: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items: LaptopItem[] = body?.items || [];
    if (!items.length) {
      return NextResponse.json(
        { success: false, message: "Pilih minimal 1 siswa untuk izin laptop." },
        { status: 400 }
      );
    }

    const nowTs = getNowTimestampJakarta();
    const today = getTodayJakarta();

    const rows = items.map((it) => [
      nowTs,
      today,
      it.nama,
      it.kelas,
      it.ekstra,
      it.keperluan || "Kegiatan Ekstrakurikuler SEP",
    ]);

    await appendSheetValues("Izin_Laptop!A1", rows);

    return NextResponse.json({
      success: true,
      message: `Berhasil merekap ${items.length} siswa untuk Izin Laptop.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

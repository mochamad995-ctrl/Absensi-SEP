import { NextRequest, NextResponse } from "next/server";
import {
  getDaftarEkstra,
  getSiswaByEkstraDanGender,
  getStatusHariIniMap,
} from "@/lib/sheets";
import { normalisasiNamaEkstra } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const ekstra = req.nextUrl.searchParams.get("ekstra");

    // Jika tidak ada query ?ekstra=..., kembalikan daftar seluruh ekstra dari Info_Ekstra (Edge Cache 10 menit)
    if (!ekstra) {
      const list = await getDaftarEkstra();
      return NextResponse.json(
        { success: true, ekstraList: list },
        {
          headers: {
            "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
          },
        }
      );
    }

    const cleanSelected = ekstra.replace(/\u00A0/g, " ").trim();
    const match = cleanSelected.match(/^(.*?)(?:\s*\(\s*(Putra|Putri)\s*\))?$/i);
    const namaEkstraOnly =
      match && match[1]
        ? normalisasiNamaEkstra(match[1]).toLowerCase()
        : normalisasiNamaEkstra(cleanSelected).toLowerCase();

    const [ekstraList, baseStudents, statusMap] = await Promise.all([
      getDaftarEkstra(),
      getSiswaByEkstraDanGender(cleanSelected),
      getStatusHariIniMap(namaEkstraOnly),
    ]);

    const info = ekstraList.find(
      (item) => item.displayName.toLowerCase() === cleanSelected.toLowerCase()
    );

    const students = baseStudents.map((s) => ({
      ...s,
      status: statusMap[s.nama.toLowerCase()] || "Belum",
    }));

    return NextResponse.json({
      success: true,
      pengajar: info?.pengajar || "-",
      students,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getSheetValues } from "@/lib/sheets";
import {
  normalisasiNamaEkstra,
  normalisasiGender,
  inferGenderFromKelas,
  getTodayJakarta,
} from "@/lib/utils";

const ADMIN_PIN = process.env.ADMIN_PIN || "091295";

export async function POST(req: NextRequest) {
  try {
    const { pin } = await req.json();
    if (String(pin || "").trim() === ADMIN_PIN) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json(
      { success: false, message: "PIN Admin salah!" },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Request tidak valid" },
      { status: 400 }
    );
  }
}

export async function GET() {
  try {
    const today = getTodayJakarta();

    const [infoRows, siswaRows, logRows, rapotRows, laptopRows] =
      await Promise.all([
        getSheetValues("Info_Ekstra!A2:C100").catch(() => [] as string[][]),
        getSheetValues("Data_Siswa!A2:F900").catch(() => [] as string[][]),
        getSheetValues("Log_Absensi!A1:AZ1000").catch(() => [] as string[][]),
        getSheetValues("Nilai_Rapot!A2:H1000").catch(() => [] as string[][]),
        getSheetValues("Izin_Laptop!A2:F1000").catch(() => [] as string[][]),
      ]);

    // 1. Parse Info_Ekstra
    const ekstraList: {
      nama: string;
      pengajar: string;
      gender: string;
      displayName: string;
      namaLower: string;
      genderCode: string;
    }[] = [];
    const seenEkstra = new Set<string>();

    for (const r of infoRows) {
      const nama = r[0] ? String(r[0]).trim() : "";
      const pengajar = r[1] ? String(r[1]).trim() : "-";
      const gender = r[2] ? String(r[2]).trim() : "";
      if (!nama) continue;
      const displayName = gender ? `${nama} (${gender})` : nama;
      if (seenEkstra.has(displayName)) continue;
      seenEkstra.add(displayName);
      ekstraList.push({
        nama,
        pengajar,
        gender,
        displayName,
        namaLower: normalisasiNamaEkstra(nama).toLowerCase(),
        genderCode: normalisasiGender(gender),
      });
    }

    // 2. Parse Log_Absensi for today
    const todayStatusMap = new Map<string, string>();
    if (logRows.length >= 2) {
      const headers = logRows[0];
      let dateCol = -1;
      for (let c = 7; c < headers.length; c++) {
        if (String(headers[c] || "").trim() === today) {
          dateCol = c;
          break;
        }
      }
      if (dateCol !== -1) {
        for (let i = 1; i < logRows.length; i++) {
          const e = normalisasiNamaEkstra(logRows[i][4]).toLowerCase();
          const n = String(logRows[i][2] || "").trim().toLowerCase();
          const st = String(logRows[i][dateCol] || "").trim();
          if (n && e && st && st.toLowerCase() !== "belum") {
            todayStatusMap.set(`${n}_${e}`, st);
          }
        }
      }
    }

    // 3. Parse Nilai_Rapot
    const rapotMap = new Map<
      string,
      { nilai: string; predikat: string; deskripsi: string }
    >();
    for (const r of rapotRows) {
      const rNama = String(r[1] || "").trim().toLowerCase();
      const rEkstra = normalisasiNamaEkstra(r[4]).toLowerCase();
      if (!rNama) continue;
      rapotMap.set(`${rNama}_${rEkstra}`, {
        nilai: r[5] !== undefined && r[5] !== null ? String(r[5]) : "",
        predikat: r[6] ? String(r[6]) : "-",
        deskripsi: r[7] ? String(r[7]) : "-",
      });
    }

    // 4. Parse Data_Siswa & aggregate per ekstra
    const parsedStudents: {
      nama: string;
      kelas: string;
      gender: string;
      genderCode: string;
      ekstraPure: string;
      nilaiFallback: string;
    }[] = [];

    for (const row of siswaRows) {
      const nama = String(row[0] || "").replace(/\u00A0/g, " ").trim();
      const rawEkstra = String(row[1] || "").replace(/\u00A0/g, " ").trim();
      const kelas = row[2] !== undefined ? String(row[2]).trim() : "";
      const rawJk = row[3] !== undefined ? String(row[3]).trim() : "";
      if (!nama || !rawEkstra || nama.toLowerCase() === "nama") continue;

      let gCode = normalisasiGender(rawJk);
      if (!gCode) {
        const mG = rawEkstra.match(/\((Putra|Putri)\)/i);
        if (mG) gCode = normalisasiGender(mG[1]);
      }
      if (!gCode) gCode = inferGenderFromKelas(kelas);

      parsedStudents.push({
        nama,
        kelas,
        gender: gCode === "l" ? "Putra" : gCode === "p" ? "Putri" : rawJk || "-",
        genderCode: gCode,
        ekstraPure: normalisasiNamaEkstra(rawEkstra).toLowerCase(),
        nilaiFallback: row[5] ? String(row[5]).trim() : "",
      });
    }

    const monitoringAbsensi = [];
    const monitoringRapot = [];
    const allRapot: {
      nama: string;
      kelas: string;
      gender: string;
      ekstra: string;
      nilai: string;
      predikat: string;
      deskripsi: string;
    }[] = [];

    for (const ex of ekstraList) {
      const group = parsedStudents.filter(
        (s) =>
          s.ekstraPure === ex.namaLower &&
          (!ex.genderCode || !s.genderCode || s.genderCode === ex.genderCode)
      );

      let hadir = 0,
        izin = 0,
        sakit = 0,
        alfa = 0,
        belum = 0;
      let sudahDinilai = 0,
        sumNilai = 0;

      for (const s of group) {
        const st =
          todayStatusMap.get(`${s.nama.toLowerCase()}_${ex.namaLower}`) ||
          "Belum";
        const stLow = st.toLowerCase();
        if (stLow === "hadir") hadir++;
        else if (stLow === "izin") izin++;
        else if (stLow === "sakit") sakit++;
        else if (stLow === "alfa") alfa++;
        else belum++;

        const rp = rapotMap.get(`${s.nama.toLowerCase()}_${ex.namaLower}`);
        const nilaiStr = rp && rp.nilai !== "" ? rp.nilai : s.nilaiFallback;
        const n = parseFloat(nilaiStr);
        if (!isNaN(n) && nilaiStr !== "") {
          sudahDinilai++;
          sumNilai += n;
        }

        allRapot.push({
          nama: s.nama,
          kelas: s.kelas,
          gender: s.gender,
          ekstra: ex.displayName,
          nilai: nilaiStr || "",
          predikat: rp?.predikat || "-",
          deskripsi: rp?.deskripsi || "-",
        });
      }

      monitoringAbsensi.push({
        displayName: ex.displayName,
        pengajar: ex.pengajar,
        totalSiswa: group.length,
        hadir,
        izin,
        sakit,
        alfa,
        belum,
        sudahAbsen: hadir + izin + sakit + alfa > 0,
      });

      monitoringRapot.push({
        displayName: ex.displayName,
        pengajar: ex.pengajar,
        totalSiswa: group.length,
        sudahDinilai,
        belumDinilai: group.length - sudahDinilai,
        rataRata:
          sudahDinilai > 0 ? (sumNilai / sudahDinilai).toFixed(1) : "0",
      });
    }

    // 5. Parse Izin_Laptop (newest first)
    const izinLaptop = laptopRows
      .filter((r) => r[2])
      .map((r) => ({
        timestamp: r[0] || "",
        tanggal: r[1] || "",
        nama: r[2] || "",
        kelas: r[3] || "",
        ekstra: r[4] || "",
        keperluan: r[5] || "",
      }))
      .reverse();

    return NextResponse.json(
      {
        success: true,
        today,
        monitoringAbsensi,
        monitoringRapot,
        allRapot,
        izinLaptop,
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

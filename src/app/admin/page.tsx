"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Lock,
  LogOut,
  RefreshCw,
  ClipboardCheck,
  Award,
  Laptop,
  FileDown,
  MessageCircle,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AbsensiRow {
  displayName: string;
  pengajar: string;
  totalSiswa: number;
  hadir: number;
  izin: number;
  sakit: number;
  alfa: number;
  belum: number;
  sudahAbsen: boolean;
}

interface RapotRow {
  displayName: string;
  pengajar: string;
  totalSiswa: number;
  sudahDinilai: number;
  belumDinilai: number;
  rataRata: string;
}

interface AllRapotItem {
  nama: string;
  kelas: string;
  gender: string;
  ekstra: string;
  nilai: string;
  predikat: string;
  deskripsi: string;
}

interface LaptopItem {
  timestamp: string;
  tanggal: string;
  nama: string;
  kelas: string;
  ekstra: string;
  keperluan: string;
}

const ADMIN_SESSION_KEY = "presensi_sep_admin_auth_v1";

export default function AdminPage() {
  const [isAuth, setIsAuth] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [activeTab, setActiveTab] = useState<"absensi" | "rapot" | "laptop">(
    "absensi"
  );
  const [loading, setLoading] = useState(false);
  const [today, setToday] = useState("");
  const [monitoringAbsensi, setMonitoringAbsensi] = useState<AbsensiRow[]>([]);
  const [monitoringRapot, setMonitoringRapot] = useState<RapotRow[]>([]);
  const [allRapot, setAllRapot] = useState<AllRapotItem[]>([]);
  const [izinLaptop, setIzinLaptop] = useState<LaptopItem[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterTanggalLaptop, setFilterTanggalLaptop] = useState("");

  useEffect(() => {
    try {
      if (localStorage.getItem(ADMIN_SESSION_KEY) === "1") {
        setIsAuth(true);
      }
    } catch {
      // ignore
    } finally {
      setAuthChecked(true);
    }
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin");
      const data = await res.json();
      if (data.success) {
        setToday(data.today || "");
        setMonitoringAbsensi(data.monitoringAbsensi || []);
        setMonitoringRapot(data.monitoringRapot || []);
        setAllRapot(data.allRapot || []);
        setIzinLaptop(data.izinLaptop || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuth) {
      loadAdminData();
    }
  }, [isAuth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError("");
    setVerifying(true);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinInput }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem(ADMIN_SESSION_KEY, "1");
        setIsAuth(true);
      } else {
        setPinError(data.message || "PIN salah!");
      }
    } catch {
      setPinError("Gagal terhubung ke server.");
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    setIsAuth(false);
    setPinInput("");
  };

  const handleExportAllRapotExcel = () => {
    if (allRapot.length === 0) return;
    const headers = [
      "No",
      "Ekstrakurikuler",
      "Nama Siswa",
      "Kelas",
      "Gender",
      "Nilai",
      "Predikat",
      "Deskripsi",
    ];
    const rows = allRapot.map((s, idx) => [
      idx + 1,
      `"${s.ekstra.replace(/"/g, '""')}"`,
      `"${s.nama.replace(/"/g, '""')}"`,
      `"${s.kelas.replace(/"/g, '""')}"`,
      `"${s.gender.replace(/"/g, '""')}"`,
      `"${s.nilai.replace(/"/g, '""')}"`,
      `"${s.predikat.replace(/"/g, '""')}"`,
      `"${s.deskripsi.replace(/"/g, '""')}"`,
    ]);
    const csv = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rekap_Rapot_Semua_Ekstra_${today || "SEP"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLaptop = useMemo(() => {
    return izinLaptop.filter((it) => {
      const matchTgl = !filterTanggalLaptop || it.tanggal === filterTanggalLaptop;
      const q = searchQuery.trim().toLowerCase();
      const matchQ =
        !q ||
        it.nama.toLowerCase().includes(q) ||
        it.ekstra.toLowerCase().includes(q) ||
        it.kelas.toLowerCase().includes(q);
      return matchTgl && matchQ;
    });
  }, [izinLaptop, filterTanggalLaptop, searchQuery]);

  const handleExportLaptopPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("REKAP GABUNGAN IZIN LAPTOP SANTRI (SEP)", 14, 16);
    doc.setFontSize(10);
    doc.text(`Tanggal Filter: ${filterTanggalLaptop || "Semua Tanggal"}`, 14, 23);

    autoTable(doc, {
      startY: 30,
      head: [["No", "Tanggal", "Nama Siswa", "Kelas", "Ekstra", "Keperluan"]],
      body: filteredLaptop.map((it, idx) => [
        idx + 1,
        it.tanggal,
        it.nama,
        it.kelas,
        it.ekstra,
        it.keperluan,
      ]),
    });
    doc.save(`Rekap_Izin_Laptop_Gabungan_${filterTanggalLaptop || "All"}.pdf`);
  };

  const filteredAbsensi = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return monitoringAbsensi;
    return monitoringAbsensi.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q) ||
        r.pengajar.toLowerCase().includes(q)
    );
  }, [monitoringAbsensi, searchQuery]);

  const filteredRapot = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return monitoringRapot;
    return monitoringRapot.filter(
      (r) =>
        r.displayName.toLowerCase().includes(q) ||
        r.pengajar.toLowerCase().includes(q)
    );
  }, [monitoringRapot, searchQuery]);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9ff]">
        <Loader2 className="h-8 w-8 animate-spin text-[#006c4a]" />
      </div>
    );
  }

  if (!isAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9ff] px-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#c6c6cd]/60 bg-white p-7 shadow-xl">
          <div className="mb-5 text-center">
            <img
              src="/sep-icon.jpg"
              alt="Logo SEP"
              className="mx-auto mb-3 h-16 w-16 rounded-2xl object-cover shadow-md"
            />
            <h1 className="font-display text-xl font-extrabold text-[#0b1c30]">
              ADMIN PANEL SEP
            </h1>
            <p className="mt-1 text-xs text-[#45464d]">
              Masukkan PIN Admin untuk mengakses monitoring
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-[#45464d]" />
              <input
                type="password"
                inputMode="numeric"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Masukkan PIN Admin..."
                autoFocus
                className="w-full rounded-xl border border-[#c6c6cd] bg-[#f8f9ff] py-3 pl-10 pr-4 text-center text-base font-bold tracking-widest text-[#0b1c30] focus:border-[#006c4a] focus:bg-white focus:outline-none"
              />
            </div>

            {pinError && (
              <p className="text-center text-xs font-semibold text-[#ba1a1a]">
                {pinError}
              </p>
            )}

            <button
              type="submit"
              disabled={verifying || !pinInput}
              className="w-full rounded-xl bg-[#131b2e] py-3 text-sm font-bold text-white transition hover:bg-[#213145] disabled:opacity-50"
            >
              {verifying ? "Memeriksa..." : "Masuk Admin Panel"}
            </button>

            <Link
              href="/"
              className="flex items-center justify-center gap-1.5 pt-2 text-xs font-semibold text-[#45464d] hover:text-[#0b1c30]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali ke Halaman Guru
            </Link>
          </form>
        </div>
      </div>
    );
  }

  const totalSudahAbsen = monitoringAbsensi.filter((e) => e.sudahAbsen).length;
  const totalBelumAbsen = monitoringAbsensi.length - totalSudahAbsen;

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      <header className="sticky top-0 z-40 border-b border-[#e5eeff] bg-white/95 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 md:px-8">
          <div className="flex items-center gap-3">
            <img
              src="/sep-icon.jpg"
              alt="Logo SEP"
              className="h-10 w-10 rounded-xl object-cover shadow-sm"
            />
            <div>
              <span className="font-display text-base font-extrabold text-[#0b1c30]">
                ADMIN PANEL SEP
              </span>
              <p className="text-xs text-[#45464d]">
                Monitoring 37 Ekstrakurikuler • Tanggal: {today || "-"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAdminData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-[#c6c6cd] bg-[#eff4ff] px-3 py-2 text-xs font-bold text-[#0b1c30] hover:bg-[#dce9ff]"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg bg-[#ba1a1a] px-3 py-2 text-xs font-bold text-white hover:bg-[#93000a]"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <nav className="flex items-center gap-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab("absensi")}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 text-sm font-semibold ${
                activeTab === "absensi"
                  ? "border-[#006c4a] text-[#006c4a]"
                  : "border-transparent text-[#45464d]"
              }`}
            >
              <ClipboardCheck className="h-4 w-4" />
              Monitoring Absensi
            </button>
            <button
              onClick={() => setActiveTab("rapot")}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 text-sm font-semibold ${
                activeTab === "rapot"
                  ? "border-[#006c4a] text-[#006c4a]"
                  : "border-transparent text-[#45464d]"
              }`}
            >
              <Award className="h-4 w-4" />
              Rekap Penilaian Rapot
            </button>
            <button
              onClick={() => setActiveTab("laptop")}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 text-sm font-semibold ${
                activeTab === "laptop"
                  ? "border-[#006c4a] text-[#006c4a]"
                  : "border-transparent text-[#45464d]"
              }`}
            >
              <Laptop className="h-4 w-4" />
              Rekap Izin Laptop ({izinLaptop.length})
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 pb-20 md:px-8 space-y-5">
        {/* Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5eeff] bg-white p-4 shadow-sm">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#45464d]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ekstra, pembina, atau nama siswa..."
              className="w-full rounded-xl border border-[#c6c6cd] bg-[#f8f9ff] py-2.5 pl-10 pr-4 text-sm text-[#0b1c30] focus:border-[#006c4a] focus:bg-white focus:outline-none"
            />
          </div>

          {activeTab === "rapot" && (
            <button
              onClick={handleExportAllRapotExcel}
              className="flex items-center gap-1.5 rounded-xl bg-[#006c4a] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#005137]"
            >
              <FileDown className="h-4 w-4" />
              Download Excel Gabungan
            </button>
          )}

          {activeTab === "laptop" && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={filterTanggalLaptop}
                onChange={(e) => setFilterTanggalLaptop(e.target.value)}
                className="rounded-xl border border-[#c6c6cd] bg-[#f8f9ff] px-3 py-2 text-xs font-semibold text-[#0b1c30]"
              />
              <button
                onClick={handleExportLaptopPDF}
                className="flex items-center gap-1.5 rounded-xl bg-[#131b2e] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#213145]"
              >
                <FileDown className="h-4 w-4" />
                PDF Gabungan
              </button>
            </div>
          )}
        </div>

        {/* TAB 1: MONITORING ABSENSI */}
        {activeTab === "absensi" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[#131b2e] p-4 text-white">
                <div className="text-xs text-[#bec6e0]">Total Ekstra</div>
                <div className="mt-1 text-2xl font-extrabold">
                  {monitoringAbsensi.length}
                </div>
              </div>
              <div className="rounded-xl border border-[#82f5c1] bg-white p-4">
                <div className="text-xs text-[#45464d]">Sudah Absen Hari Ini</div>
                <div className="mt-1 text-2xl font-extrabold text-[#006c4a]">
                  {totalSudahAbsen}
                </div>
              </div>
              <div className="rounded-xl border border-[#ffdad6] bg-white p-4">
                <div className="text-xs text-[#45464d]">Belum Absen Hari Ini</div>
                <div className="mt-1 text-2xl font-extrabold text-[#ba1a1a]">
                  {totalBelumAbsen}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#e5eeff] bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#e5eeff] bg-[#eff4ff] text-xs font-bold uppercase text-[#45464d]">
                  <tr>
                    <th className="px-4 py-3">Ekstrakurikuler</th>
                    <th className="px-4 py-3">Pembina</th>
                    <th className="px-3 py-3 text-center">Total</th>
                    <th className="px-3 py-3 text-center">H/I/S/A</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff]">
                  {filteredAbsensi.map((row) => {
                    const waText = encodeURIComponent(
                      `Assalamu'alaikum ${row.pengajar}, mohon berkenan mengisi presensi SEP untuk *${row.displayName}* hari ini (${today}). Terima kasih.`
                    );
                    return (
                      <tr key={row.displayName} className="hover:bg-[#f8f9ff]">
                        <td className="px-4 py-3 font-bold text-[#0b1c30]">
                          {row.displayName}
                        </td>
                        <td className="px-4 py-3 text-xs text-[#45464d]">
                          {row.pengajar}
                        </td>
                        <td className="px-3 py-3 text-center font-bold">
                          {row.totalSiswa}
                        </td>
                        <td className="px-3 py-3 text-center text-xs whitespace-nowrap">
                          <span className="text-[#006c4a] font-bold">{row.hadir}</span>/
                          <span className="text-amber-700 font-bold">{row.izin}</span>/
                          <span className="text-[#004c6e] font-bold">{row.sakit}</span>/
                          <span className="text-[#ba1a1a] font-bold">{row.alfa}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.sudahAbsen ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#82f5c1] px-2.5 py-0.5 text-[11px] font-bold text-[#005137]">
                              <CheckCircle2 className="h-3 w-3" /> Sudah
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#ffdad6] px-2.5 py-0.5 text-[11px] font-bold text-[#93000a]">
                              <AlertCircle className="h-3 w-3" /> Belum
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!row.sudahAbsen && (
                            <a
                              href={`https://wa.me/?text=${waText}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg bg-[#006c4a] px-2.5 py-1.5 text-xs font-bold text-white hover:bg-[#005137]"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Ingatkan WA
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: REKAP RAPOT */}
        {activeTab === "rapot" && (
          <div className="overflow-x-auto rounded-xl border border-[#e5eeff] bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#e5eeff] bg-[#eff4ff] text-xs font-bold uppercase text-[#45464d]">
                <tr>
                  <th className="px-4 py-3">Ekstrakurikuler</th>
                  <th className="px-4 py-3">Pembina</th>
                  <th className="px-3 py-3 text-center">Total Siswa</th>
                  <th className="px-3 py-3 text-center">Sudah Dinilai</th>
                  <th className="px-3 py-3 text-center">Belum</th>
                  <th className="px-3 py-3 text-center">Rata-rata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eff4ff]">
                {filteredRapot.map((row) => (
                  <tr key={row.displayName} className="hover:bg-[#f8f9ff]">
                    <td className="px-4 py-3 font-bold text-[#0b1c30]">
                      {row.displayName}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#45464d]">
                      {row.pengajar}
                    </td>
                    <td className="px-3 py-3 text-center font-bold">
                      {row.totalSiswa}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-[#006c4a]">
                      {row.sudahDinilai}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-[#ba1a1a]">
                      {row.belumDinilai}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-[#131b2e]">
                      {row.rataRata}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: REKAP IZIN LAPTOP */}
        {activeTab === "laptop" && (
          <div className="overflow-x-auto rounded-xl border border-[#e5eeff] bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#e5eeff] bg-[#eff4ff] text-xs font-bold uppercase text-[#45464d]">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Nama Siswa</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3">Ekstra</th>
                  <th className="px-4 py-3">Keperluan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eff4ff]">
                {filteredLaptop.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-[#45464d]">
                      Belum ada data pengajuan Izin Laptop.
                    </td>
                  </tr>
                ) : (
                  filteredLaptop.map((it, idx) => (
                    <tr key={idx} className="hover:bg-[#f8f9ff]">
                      <td className="px-4 py-3 text-xs whitespace-nowrap text-[#45464d]">
                        {it.tanggal}
                      </td>
                      <td className="px-4 py-3 font-bold text-[#0b1c30]">
                        {it.nama}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block whitespace-nowrap rounded-md bg-[#dae2fd] px-2 py-0.5 text-xs font-bold text-[#131b2e]">
                          {it.kelas}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#006c4a]">
                        {it.ekstra}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#45464d]">
                        {it.keperluan}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

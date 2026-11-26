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
  Users,
  Save,
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

  const [activeTab, setActiveTab] = useState<
    "absensi" | "rapot" | "laptop" | "bisyaroh"
  >("absensi");
  const [loading, setLoading] = useState(false);
  const [today, setToday] = useState("");
  const [monitoringAbsensi, setMonitoringAbsensi] = useState<AbsensiRow[]>([]);
  const [monitoringRapot, setMonitoringRapot] = useState<RapotRow[]>([]);
  const [allRapot, setAllRapot] = useState<AllRapotItem[]>([]);
  const [izinLaptop, setIzinLaptop] = useState<LaptopItem[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterTanggalLaptop, setFilterTanggalLaptop] = useState("");

  // Bisyaroh Guru state
  const [bisyarohPeriods, setBisyarohPeriods] = useState<
    { name: string; isActive: boolean }[]
  >([]);
  const [bisyarohSheet, setBisyarohSheet] = useState("");
  const [bisyarohDates, setBisyarohDates] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
  ]);
  const [bisyarohList, setBisyarohList] = useState<
    {
      rowIndex: number;
      ekstra: string;
      pengajar: string;
      kategori: string;
      p1: string;
      p2: string;
      p3: string;
      p4: string;
      p5: string;
      totalHadir: number;
    }[]
  >([]);
  const [loadingBisyaroh, setLoadingBisyaroh] = useState(false);
  const [savingBisyaroh, setSavingBisyaroh] = useState(false);
  const [selectedPertemuan, setSelectedPertemuan] = useState<
    "p1" | "p2" | "p3" | "p4" | "p5"
  >("p1");
  const [bisyarohSubTab, setBisyarohSubTab] = useState<"semua" | "eksternal">(
    "semua"
  );
  const [bisyarohEksternalSheet, setBisyarohEksternalSheet] = useState("");
  const [eksternalList, setEksternalList] = useState<
    {
      no: string;
      kegiatan: string;
      gender: string;
      pembimbing: string;
      frekuensi: string;
      nominal: string;
      subTotal: string;
      total: string;
    }[]
  >([]);

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

  const loadBisyarohData = async (sheetName?: string) => {
    setLoadingBisyaroh(true);
    try {
      const url = sheetName
        ? `/api/admin/bisyaroh?sheet=${encodeURIComponent(sheetName)}`
        : "/api/admin/bisyaroh";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setBisyarohPeriods(data.periods || []);
        setBisyarohSheet(data.currentSheet || "");
        setBisyarohDates(data.dates || ["", "", "", "", ""]);
        setBisyarohList(data.list || []);
        setBisyarohEksternalSheet(data.bisyarohSheetName || "");
        setEksternalList(data.eksternalList || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingBisyaroh(false);
    }
  };

  useEffect(() => {
    if (activeTab === "bisyaroh" && bisyarohList.length === 0) {
      loadBisyarohData();
    }
  }, [activeTab, bisyarohList.length]);

  const handleSaveBisyarohDates = async () => {
    if (!bisyarohSheet) return;
    setSavingBisyaroh(true);
    try {
      const res = await fetch("/api/admin/bisyaroh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_dates",
          sheetName: bisyarohSheet,
          dates: bisyarohDates,
        }),
      });
      const data = await res.json();
      alert(data.message || "Tanggal tersimpan!");
    } finally {
      setSavingBisyaroh(false);
    }
  };

  const handleSaveBisyarohPresensi = async () => {
    if (!bisyarohSheet || bisyarohList.length === 0) return;
    const colMap = { p1: "E", p2: "F", p3: "G", p4: "H", p5: "I" };
    setSavingBisyaroh(true);
    try {
      const res = await fetch("/api/admin/bisyaroh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_presensi",
          sheetName: bisyarohSheet,
          colLetter: colMap[selectedPertemuan],
          items: bisyarohList.map((b) => ({
            rowIndex: b.rowIndex,
            status: b[selectedPertemuan],
          })),
        }),
      });
      const data = await res.json();
      alert(data.message || "Presensi guru tersimpan!");
    } finally {
      setSavingBisyaroh(false);
    }
  };

  const handleExportBisyarohExcel = () => {
    if (bisyarohList.length === 0) return;
    const headers = [
      "No",
      "Ekstrakurikuler",
      "Nama Pengajar",
      "Kategori",
      `P1 (${bisyarohDates[0] || "-"})`,
      `P2 (${bisyarohDates[1] || "-"})`,
      `P3 (${bisyarohDates[2] || "-"})`,
      `P4 (${bisyarohDates[3] || "-"})`,
      `P5 (${bisyarohDates[4] || "-"})`,
      "Total Hadir",
    ];
    const rows = bisyarohList.map((b, idx) => [
      idx + 1,
      `"${b.ekstra.replace(/"/g, '""')}"`,
      `"${b.pengajar.replace(/"/g, '""')}"`,
      `"${b.kategori.replace(/"/g, '""')}"`,
      `"${b.p1}"`,
      `"${b.p2}"`,
      `"${b.p3}"`,
      `"${b.p4}"`,
      `"${b.p5}"`,
      b.totalHadir,
    ]);
    const csv =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rekap_Bisyaroh_Guru_${bisyarohSheet || "SEP"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
              onClick={() => window.dispatchEvent(new Event("open-pwa-install"))}
              className="flex items-center gap-1.5 rounded-lg border border-[#006c4a]/40 bg-[#82f5c1]/40 px-3 py-2 text-xs font-bold text-[#005137] hover:bg-[#82f5c1]"
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">Install App</span>
            </button>
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
            <button
              onClick={() => setActiveTab("bisyaroh")}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 text-sm font-semibold ${
                activeTab === "bisyaroh"
                  ? "border-[#006c4a] text-[#006c4a]"
                  : "border-transparent text-[#45464d]"
              }`}
            >
              <Users className="h-4 w-4" />
              Absensi Guru (Bisyaroh)
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
        {/* TAB 4: ABSENSI GURU (BISYAROH) */}
        {activeTab === "bisyaroh" && (
          <div className="space-y-4">
            {/* Sub-Tab Toggle: Semua Guru vs Guru Eksternal */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5eeff] bg-white p-3 shadow-sm">
              <div className="flex gap-2">
                <button
                  onClick={() => setBisyarohSubTab("semua")}
                  className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                    bisyarohSubTab === "semua"
                      ? "bg-[#131b2e] text-white"
                      : "bg-[#eff4ff] text-[#45464d] hover:text-[#0b1c30]"
                  }`}
                >
                  Absensi Semua Guru ({bisyarohList.length})
                </button>
                <button
                  onClick={() => setBisyarohSubTab("eksternal")}
                  className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                    bisyarohSubTab === "eksternal"
                      ? "bg-[#006c4a] text-white"
                      : "bg-[#eff4ff] text-[#45464d] hover:text-[#0b1c30]"
                  }`}
                >
                  Guru Eksternal / Bisyaroh ({eksternalList.length})
                </button>
              </div>
              {bisyarohSubTab === "eksternal" && bisyarohEksternalSheet && (
                <span className="text-xs font-bold text-[#006c4a]">
                  Sheet: {bisyarohEksternalSheet}
                </span>
              )}
            </div>

            {bisyarohSubTab === "eksternal" ? (
              <div className="overflow-x-auto rounded-xl border border-[#e5eeff] bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#e5eeff] bg-[#eff4ff] text-xs font-bold uppercase text-[#45464d]">
                    <tr>
                      <th className="px-3 py-3 text-center">No</th>
                      <th className="px-3 py-3">Kegiatan</th>
                      <th className="px-3 py-3">Gender</th>
                      <th className="px-3 py-3">Nama Pembimbing</th>
                      <th className="px-3 py-3 text-center">Frek</th>
                      <th className="px-3 py-3 text-right">Nominal</th>
                      <th className="px-3 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eff4ff]">
                    {eksternalList.map((ex, idx) => (
                      <tr key={idx} className="hover:bg-[#f8f9ff]">
                        <td className="px-3 py-2.5 text-center text-xs text-[#45464d]">
                          {ex.no}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-[#0b1c30]">
                          {ex.kegiatan}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#45464d]">
                          {ex.gender}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-[#006c4a]">
                          {ex.pembimbing}
                        </td>
                        <td className="px-3 py-2.5 text-center font-bold">
                          {ex.frekuensi}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs text-[#45464d]">
                          {ex.nominal}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-[#131b2e]">
                          {ex.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
            <div className="rounded-xl border border-[#e5eeff] bg-white p-4 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase text-[#45464d]">
                    Periode Sheet:
                  </span>
                  <select
                    value={bisyarohSheet}
                    onChange={(e) => loadBisyarohData(e.target.value)}
                    className="rounded-lg border border-[#c6c6cd] bg-[#f8f9ff] px-3 py-1.5 text-xs font-bold text-[#0b1c30]"
                  >
                    {bisyarohPeriods.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleExportBisyarohExcel}
                    className="flex items-center gap-1.5 rounded-xl border border-[#006c4a]/40 bg-[#82f5c1]/40 px-3.5 py-2 text-xs font-bold text-[#005137] hover:bg-[#82f5c1]"
                  >
                    <FileDown className="h-4 w-4" />
                    Excel Bisyaroh
                  </button>
                  <button
                    onClick={handleSaveBisyarohPresensi}
                    disabled={savingBisyaroh}
                    className="flex items-center gap-1.5 rounded-xl bg-[#006c4a] px-4 py-2 text-xs font-bold text-white hover:bg-[#005137] disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    Simpan {selectedPertemuan.toUpperCase()}
                  </button>
                </div>
              </div>

              {/* Tanggal Pertemuan P1 - P5 */}
              <div className="flex flex-wrap items-end gap-2 border-t border-[#eff4ff] pt-3">
                {(["p1", "p2", "p3", "p4", "p5"] as const).map((pKey, idx) => (
                  <div key={pKey} className="flex-1 min-w-[110px]">
                    <label className="mb-1 block text-[10px] font-bold uppercase text-[#45464d]">
                      Tgl {pKey.toUpperCase()}
                    </label>
                    <input
                      type="text"
                      value={bisyarohDates[idx] || ""}
                      onChange={(e) => {
                        const next = [...bisyarohDates];
                        next[idx] = e.target.value;
                        setBisyarohDates(next);
                      }}
                      placeholder="dd/mm/yyyy"
                      className="w-full rounded-lg border border-[#c6c6cd] bg-[#f8f9ff] px-2.5 py-1.5 text-xs font-semibold text-[#0b1c30]"
                    />
                  </div>
                ))}
                <button
                  onClick={handleSaveBisyarohDates}
                  disabled={savingBisyaroh}
                  className="rounded-lg bg-[#131b2e] px-3 py-2 text-xs font-bold text-white hover:bg-[#213145]"
                >
                  Simpan Tanggal
                </button>
              </div>

              {/* Pilih Sesi Aktif */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#45464d]">
                  Input Sesi:
                </span>
                {(["p1", "p2", "p3", "p4", "p5"] as const).map((pKey) => (
                  <button
                    key={pKey}
                    onClick={() => setSelectedPertemuan(pKey)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase ${
                      selectedPertemuan === pKey
                        ? "bg-[#131b2e] text-white"
                        : "bg-[#eff4ff] text-[#45464d]"
                    }`}
                  >
                    {pKey}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#e5eeff] bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#e5eeff] bg-[#eff4ff] text-xs font-bold uppercase text-[#45464d]">
                  <tr>
                    <th className="px-4 py-3">Pengajar</th>
                    <th className="px-4 py-3">Ekstra</th>
                    <th className="px-3 py-3 text-center">Status ({selectedPertemuan.toUpperCase()})</th>
                    <th className="px-3 py-3 text-center">Total Hadir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff]">
                  {loadingBisyaroh ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-[#006c4a]">
                        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                        Memuat data bisyaroh guru...
                      </td>
                    </tr>
                  ) : (
                    bisyarohList
                      .filter((b) => {
                        const q = searchQuery.trim().toLowerCase();
                        return (
                          !q ||
                          b.pengajar.toLowerCase().includes(q) ||
                          b.ekstra.toLowerCase().includes(q)
                        );
                      })
                      .map((b) => (
                        <tr key={b.rowIndex} className="hover:bg-[#f8f9ff]">
                          <td className="px-4 py-3 font-bold text-[#0b1c30]">
                            {b.pengajar}
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-[#006c4a]">
                            {b.ekstra}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <select
                              value={b[selectedPertemuan]}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBisyarohList((prev) =>
                                  prev.map((item) => {
                                    if (item.rowIndex !== b.rowIndex) return item;
                                    const updated = {
                                      ...item,
                                      [selectedPertemuan]: val,
                                    };
                                    updated.totalHadir = [
                                      updated.p1,
                                      updated.p2,
                                      updated.p3,
                                      updated.p4,
                                      updated.p5,
                                    ].filter(
                                      (s) => s.toLowerCase() === "hadir"
                                    ).length;
                                    return updated;
                                  })
                                );
                              }}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${
                                b[selectedPertemuan].toLowerCase() === "hadir"
                                  ? "border-[#006c4a]/40 bg-[#82f5c1]/40 text-[#005137]"
                                  : b[selectedPertemuan].toLowerCase() === "izin"
                                  ? "border-amber-400 bg-amber-100 text-amber-900"
                                  : "border-[#c6c6cd] bg-[#eff4ff] text-[#45464d]"
                              }`}
                            >
                              <option value="-">-</option>
                              <option value="Hadir">Hadir</option>
                              <option value="Izin">Izin</option>
                              <option value="Tidak Hadir">Tidak Hadir</option>
                            </select>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="inline-block rounded-full bg-[#131b2e] px-2.5 py-0.5 text-xs font-extrabold text-[#82f5c1]">
                              {b.totalHadir}x
                            </span>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

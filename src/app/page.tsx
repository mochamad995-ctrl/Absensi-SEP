"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  LogOut,
  Users,
  ClipboardCheck,
  Award,
  UserPlus,
  FileDown,
  Save,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Laptop,
  MapPin,
  TrendingUp,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import LoginScreen, { EkstraOption } from "@/components/LoginScreen";
import KlaimModal from "@/components/KlaimModal";
import { konversiNilaiRapot, VALID_STATUSES } from "@/lib/utils";

interface StudentItem {
  rowId: number;
  nama: string;
  kelas: string;
  gender: string;
  status: string;
  nilai: string;
  kamar: string;
}

interface RapotItem {
  rowId: number;
  nama: string;
  kelas: string;
  gender: string;
  ekstra: string;
  nilai: string;
  predikat: string;
  deskripsi: string;
}

const SESSION_KEY = "presensi_sep_session_v1";

export default function HomePage() {
  const [ekstraList, setEkstraList] = useState<EkstraOption[]>([]);
  const [loadingEkstraList, setLoadingEkstraList] = useState(true);
  const [session, setSession] = useState<EkstraOption | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "absensi" | "rapot" | "laptop" | "denah"
  >("absensi");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchAbsensi, setSearchAbsensi] = useState("");
  const [savingAbsensi, setSavingAbsensi] = useState(false);

  const [rapotStudents, setRapotStudents] = useState<RapotItem[]>([]);
  const [loadingRapot, setLoadingRapot] = useState(false);
  const [savingRapot, setSavingRapot] = useState(false);
  const [searchRapot, setSearchRapot] = useState("");

  // Izin Laptop state
  const [selectedLaptopIds, setSelectedLaptopIds] = useState<number[]>([]);
  const [laptopKeperluan, setLaptopKeperluan] = useState(
    "Kegiatan Ekstrakurikuler SEP"
  );
  const [savingLaptop, setSavingLaptop] = useState(false);

  // Denah state
  const [denahData, setDenahData] = useState<{
    putra: {
      title: string;
      rows: { val: string; bg: string | null; fg: string | null; bold: boolean }[][];
      merges: { startRow: number; endRow: number; startCol: number; endCol: number }[];
    };
    putri: {
      title: string;
      rows: { val: string; bg: string | null; fg: string | null; bold: boolean }[][];
      merges: { startRow: number; endRow: number; startCol: number; endCol: number }[];
    };
  } | null>(null);
  const [loadingDenah, setLoadingDenah] = useState(false);
  const [denahGender, setDenahGender] = useState<"Putra" | "Putri">("Putra");

  const [klaimOpen, setKlaimOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY);
      if (saved) {
        setSession(JSON.parse(saved));
      }
    } catch {
      // ignore invalid storage
    } finally {
      setAuthChecked(true);
    }

    fetch("/api/ekstra")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setEkstraList(data.ekstraList || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingEkstraList(false));
  }, []);

  const loadAbsensiData = useCallback(async (ekstraDisplay: string) => {
    setLoadingStudents(true);
    try {
      const res = await fetch(
        `/api/ekstra?ekstra=${encodeURIComponent(ekstraDisplay)}`
      );
      const data = await res.json();
      if (data.success) {
        setStudents(data.students || []);
      } else {
        showToast(data.message || "Gagal memuat data siswa", false);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error koneksi", false);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  const loadRapotData = useCallback(async (ekstraDisplay: string) => {
    setLoadingRapot(true);
    try {
      const res = await fetch(
        `/api/rapot?ekstra=${encodeURIComponent(ekstraDisplay)}`
      );
      const data = await res.json();
      if (data.success) {
        setRapotStudents(data.students || []);
      } else {
        showToast(data.message || "Gagal memuat data rapot", false);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error koneksi", false);
    } finally {
      setLoadingRapot(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    loadAbsensiData(session.displayName);
    loadRapotData(session.displayName);
  }, [session, loadAbsensiData, loadRapotData]);

  const handleLogin = (selected: EkstraOption) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(selected));
    setSession(selected);
  };

  const handleLogout = () => {
    if (!confirm("Keluar dari sesi ekstrakurikuler ini?")) return;
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setStudents([]);
    setRapotStudents([]);
  };

  // Absensi handlers
  const handleStatusChange = (rowId: number, newStatus: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.rowId === rowId ? { ...s, status: newStatus } : s))
    );
  };

  const handleSaveAbsensi = async () => {
    if (!session || students.length === 0) return;
    setSavingAbsensi(true);
    try {
      const res = await fetch("/api/absensi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: students.map((s) => ({
            nama: s.nama,
            kelas: s.kelas,
            ekstra: session.displayName,
            status: s.status,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, true);
      } else {
        showToast(data.message || "Gagal menyimpan absensi", false);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error koneksi", false);
    } finally {
      setSavingAbsensi(false);
    }
  };

  const handleExportPDF = () => {
    if (!session) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`REKAP PRESENSI EKSTRAKULIKULER - ${session.displayName}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Pembina: ${session.pengajar}`, 14, 23);
    doc.text(
      `Tanggal: ${new Date().toLocaleDateString("id-ID", {
        dateStyle: "full",
      })}`,
      14,
      29
    );

    autoTable(doc, {
      startY: 35,
      head: [["No", "Nama Siswa", "Kelas", "Gender", "Status"]],
      body: students.map((s, idx) => [
        idx + 1,
        s.nama,
        s.kelas,
        s.gender,
        s.status,
      ]),
    });

    doc.save(`Presensi_${session.displayName.replace(/\s+/g, "_")}.pdf`);
  };

  // Rapot handlers
  const handleRapotNilaiChange = (idx: number, val: string) => {
    let clean = val;
    const num = parseFloat(val);
    if (!isNaN(num)) {
      if (num > 100) clean = "100";
      if (num < 0) clean = "0";
    }
    const konv = konversiNilaiRapot(clean);
    setRapotStudents((prev) =>
      prev.map((item, i) =>
        i === idx
          ? {
              ...item,
              nilai: clean,
              predikat: konv.predikat,
              deskripsi: konv.deskripsi,
            }
          : item
      )
    );
  };

  const handleSetNilaiSeragam = () => {
    const input = prompt(
      "Masukkan nilai seragam untuk semua siswa (0 - 100):",
      "85"
    );
    if (input === null) return;
    const num = parseFloat(input);
    if (isNaN(num) || num < 0 || num > 100) {
      showToast("Nilai harus berupa angka 0 - 100", false);
      return;
    }
    const konv = konversiNilaiRapot(num);
    setRapotStudents((prev) =>
      prev.map((item) => ({
        ...item,
        nilai: String(num),
        predikat: konv.predikat,
        deskripsi: konv.deskripsi,
      }))
    );
    showToast(
      `Nilai ${num} diterapkan. Klik Simpan Semua Nilai untuk menyimpan.`,
      true
    );
  };

  const handleSaveRapot = async () => {
    if (rapotStudents.length === 0) return;
    setSavingRapot(true);
    try {
      const res = await fetch("/api/rapot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: rapotStudents }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, true);
      } else {
        showToast(data.message || "Gagal menyimpan nilai rapot", false);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error koneksi", false);
    } finally {
      setSavingRapot(false);
    }
  };

  const rapotStats = useMemo(() => {
    const total = rapotStudents.length;
    let sudah = 0;
    let sum = 0;
    for (const s of rapotStudents) {
      const n = parseFloat(s.nilai);
      if (!isNaN(n) && String(s.nilai).trim() !== "") {
        sudah++;
        sum += n;
      }
    }
    const belum = total - sudah;
    const rerataNum = sudah > 0 ? sum / sudah : 0;
    const rerata = sudah > 0 ? rerataNum.toFixed(1) : "0";
    const pctSudah = total > 0 ? ((sudah / total) * 100).toFixed(1) : "0";
    const pctBelum = total > 0 ? ((belum / total) * 100).toFixed(1) : "0";
    const predikatRerata = sudah > 0 ? konversiNilaiRapot(rerataNum).predikat : "-";
    return {
      total,
      sudah,
      belum,
      rerata,
      pctSudah,
      pctBelum,
      predikatRerata,
    };
  }, [rapotStudents]);

  const filteredRapot = useMemo(() => {
    const q = searchRapot.trim().toLowerCase();
    if (!q) return rapotStudents;
    return rapotStudents.filter(
      (s) =>
        s.nama.toLowerCase().includes(q) || s.kelas.toLowerCase().includes(q)
    );
  }, [rapotStudents, searchRapot]);

  const handleRapotKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number
  ) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = document.getElementById(`rapot-input-${idx + 1}`);
      if (next) next.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = document.getElementById(`rapot-input-${idx - 1}`);
      if (prev) prev.focus();
    }
  };

  const handleExportRapotPDF = () => {
    if (!session) return;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`NILAI RAPOT EKSTRAKULIKULER - ${session.displayName}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Pembina: ${session.pengajar}`, 14, 23);

    autoTable(doc, {
      startY: 30,
      head: [["No", "Nama Siswa", "Kelas", "Nilai", "Predikat", "Deskripsi"]],
      body: rapotStudents.map((s, idx) => [
        idx + 1,
        s.nama,
        s.kelas,
        s.nilai || "-",
        s.predikat,
        s.deskripsi,
      ]),
    });

    doc.save(`Nilai_Rapot_${session.displayName.replace(/\s+/g, "_")}.pdf`);
  };

  // Izin Laptop handlers
  const toggleLaptopStudent = (rowId: number) => {
    setSelectedLaptopIds((prev) =>
      prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]
    );
  };

  const handleSaveLaptop = async () => {
    if (!session || selectedLaptopIds.length === 0) {
      showToast("Pilih minimal 1 siswa untuk izin laptop.", false);
      return;
    }
    setSavingLaptop(true);
    try {
      const selectedStudents = students.filter((s) =>
        selectedLaptopIds.includes(s.rowId)
      );
      const res = await fetch("/api/izin-laptop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedStudents.map((s) => ({
            nama: s.nama,
            kelas: s.kelas,
            ekstra: session.displayName,
            keperluan: laptopKeperluan,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, true);
      } else {
        showToast(data.message || "Gagal menyimpan izin laptop", false);
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error koneksi", false);
    } finally {
      setSavingLaptop(false);
    }
  };

  const handleExportLaptopPDF = () => {
    if (!session || selectedLaptopIds.length === 0) {
      showToast("Pilih minimal 1 siswa terlebih dahulu.", false);
      return;
    }
    const selectedStudents = students.filter((s) =>
      selectedLaptopIds.includes(s.rowId)
    );
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`SURAT REKAP IZIN LAPTOP - ${session.displayName}`, 14, 16);
    doc.setFontSize(10);
    doc.text(`Pembina: ${session.pengajar}`, 14, 23);
    doc.text(`Keperluan: ${laptopKeperluan}`, 14, 29);
    doc.text(
      `Tanggal: ${new Date().toLocaleDateString("id-ID", { dateStyle: "full" })}`,
      14,
      35
    );

    autoTable(doc, {
      startY: 42,
      head: [["No", "Nama Siswa", "Kelas", "Keterangan"]],
      body: selectedStudents.map((s, idx) => [
        idx + 1,
        s.nama,
        s.kelas,
        "Diizinkan membawa laptop",
      ]),
    });

    doc.save(`Izin_Laptop_${session.displayName.replace(/\s+/g, "_")}.pdf`);
  };

  // Load Denah when tab opened
  useEffect(() => {
    if (activeTab !== "denah" || denahData) return;
    if (session?.gender?.toLowerCase() === "putri") {
      setDenahGender("Putri");
    }
    setLoadingDenah(true);
    fetch("/api/denah")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setDenahData({ putra: data.putra, putri: data.putri });
        } else {
          showToast(data.message || "Gagal memuat denah", false);
        }
      })
      .catch(() => showToast("Gagal memuat denah dari spreadsheet", false))
      .finally(() => setLoadingDenah(false));
  }, [activeTab, denahData, session]);

  const filteredAbsensi = useMemo(() => {
    const q = searchAbsensi.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.nama.toLowerCase().includes(q) || s.kelas.toLowerCase().includes(q)
    );
  }, [students, searchAbsensi]);

  const stats = useMemo(() => {
    const counts = { Hadir: 0, Izin: 0, Sakit: 0, Alfa: 0, Belum: 0 };
    for (const s of students) {
      if (s.status in counts) {
        counts[s.status as keyof typeof counts]++;
      } else {
        counts.Belum++;
      }
    }
    return counts;
  }, [students]);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9ff]">
        <Loader2 className="h-8 w-8 animate-spin text-[#006c4a]" />
      </div>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        ekstraList={ekstraList}
        loading={loadingEkstraList}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30]">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-xl ${
            toast.ok
              ? "border-[#006c4a]/30 bg-[#006c4a] text-white"
              : "border-[#ba1a1a]/30 bg-[#ba1a1a] text-white"
          }`}
        >
          {toast.ok ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Sticky Stitch Header */}
      <header className="sticky top-0 z-40 border-b border-[#e5eeff] bg-white/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#131b2e] text-[#82f5c1] shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-base font-bold tracking-tight text-[#0b1c30]">
                  PRESENSI SEP
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#82f5c1] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#005137]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#006c4a]" />
                  {session.displayName}
                </span>
              </div>
              <p className="text-xs text-[#45464d]">
                Pembina:{" "}
                <span className="font-semibold text-[#0b1c30]">
                  {session.pengajar}
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg bg-[#ba1a1a] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#93000a]"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Keluar /</span> Logout
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <nav className="flex items-center gap-6 overflow-x-auto">
            <button
              onClick={() => setActiveTab("absensi")}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 text-sm font-semibold transition ${
                activeTab === "absensi"
                  ? "border-[#006c4a] text-[#006c4a]"
                  : "border-transparent text-[#45464d] hover:text-[#0b1c30]"
              }`}
            >
              <ClipboardCheck className="h-4 w-4" />
              <span>Absensi Harian</span>
              <span className="rounded-full bg-[#82f5c1] px-2 py-0.5 text-[10px] font-bold text-[#005137]">
                {students.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("rapot")}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 text-sm font-semibold transition ${
                activeTab === "rapot"
                  ? "border-[#006c4a] text-[#006c4a]"
                  : "border-transparent text-[#45464d] hover:text-[#0b1c30]"
              }`}
            >
              <Award className="h-4 w-4" />
              <span>Penilaian Rapot</span>
              <span className="rounded-full bg-[#dce9ff] px-2 py-0.5 text-[10px] font-bold text-[#45464d]">
                {rapotStats.sudah}/{rapotStats.total}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("laptop")}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 text-sm font-semibold transition ${
                activeTab === "laptop"
                  ? "border-[#006c4a] text-[#006c4a]"
                  : "border-transparent text-[#45464d] hover:text-[#0b1c30]"
              }`}
            >
              <Laptop className="h-4 w-4" />
              <span>Izin Laptop</span>
              {selectedLaptopIds.length > 0 && (
                <span className="rounded-full bg-[#ffdad6] px-2 py-0.5 text-[10px] font-bold text-[#93000a]">
                  {selectedLaptopIds.length} Dipilih
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("denah")}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 py-3 text-sm font-semibold transition ${
                activeTab === "denah"
                  ? "border-[#006c4a] text-[#006c4a]"
                  : "border-transparent text-[#45464d] hover:text-[#0b1c30]"
              }`}
            >
              <MapPin className="h-4 w-4" />
              <span>Denah Kelas</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 pb-24 md:px-8">
        {/* TAB 1: ABSENSI HARIAN */}
        {activeTab === "absensi" && (
          <div className="space-y-5">
            {/* 5 Stat Cards */}
            <div className="grid grid-cols-5 gap-2 sm:gap-4">
              {[
                { label: "Hadir", val: stats.Hadir, bg: "bg-[#82f5c1]/35 text-[#006c4a]" },
                { label: "Izin", val: stats.Izin, bg: "bg-amber-100 text-amber-800" },
                { label: "Sakit", val: stats.Sakit, bg: "bg-[#c9e6ff] text-[#004c6e]" },
                { label: "Alfa", val: stats.Alfa, bg: "bg-[#ffdad6] text-[#ba1a1a]" },
                { label: "Belum", val: stats.Belum, bg: "bg-[#e5eeff] text-[#45464d]" },
              ].map((st) => (
                <div
                  key={st.label}
                  className="rounded-xl bg-white p-3 text-center shadow-sm border border-[#e5eeff]"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#45464d]">
                    {st.label}
                  </div>
                  <div
                    className={`mx-auto mt-1 inline-block rounded-lg px-2.5 py-0.5 text-lg font-extrabold ${st.bg}`}
                  >
                    {st.val}
                  </div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm border border-[#e5eeff]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#45464d]" />
                <input
                  type="text"
                  value={searchAbsensi}
                  onChange={(e) => setSearchAbsensi(e.target.value)}
                  placeholder="Cari nama atau kelas..."
                  className="w-full rounded-xl border border-[#c6c6cd] bg-[#f8f9ff] py-2.5 pl-10 pr-4 text-sm text-[#0b1c30] placeholder-[#76777d] focus:border-[#006c4a] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setKlaimOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-[#131b2e] px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#213145]"
                >
                  <UserPlus className="h-4 w-4 text-[#82f5c1]" />
                  Tambahkan Murid
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 rounded-xl border border-[#c6c6cd] bg-[#eff4ff] px-3.5 py-2.5 text-xs font-bold text-[#0b1c30] hover:bg-[#dce9ff]"
                >
                  <FileDown className="h-4 w-4" />
                  PDF
                </button>
                <button
                  onClick={handleSaveAbsensi}
                  disabled={savingAbsensi || students.length === 0}
                  className="flex items-center gap-1.5 rounded-xl bg-[#006c4a] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#005137] disabled:opacity-50"
                >
                  {savingAbsensi ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan Absensi
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-[#e5eeff] bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#e5eeff] bg-[#eff4ff] text-xs font-bold uppercase text-[#45464d]">
                  <tr>
                    <th className="w-12 px-4 py-3.5 text-center">No</th>
                    <th className="px-4 py-3.5">Nama Siswa</th>
                    <th className="px-4 py-3.5">Kelas</th>
                    <th className="px-4 py-3.5 text-right">Status Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff]">
                  {loadingStudents ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-[#006c4a]">
                        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                        Memuat daftar siswa...
                      </td>
                    </tr>
                  ) : filteredAbsensi.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-[#45464d]">
                        <Users className="mx-auto mb-2 h-6 w-6 opacity-50" />
                        Tidak ada siswa ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredAbsensi.map((s, idx) => (
                      <tr key={s.rowId} className="hover:bg-[#f8f9ff]">
                        <td className="px-4 py-3 text-center text-xs font-semibold text-[#45464d]">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3 font-bold text-[#0b1c30]">
                          {s.nama}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-[#dae2fd] px-2 py-0.5 text-xs font-bold text-[#131b2e]">
                            {s.kelas}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <select
                            value={s.status}
                            onChange={(e) =>
                              handleStatusChange(s.rowId, e.target.value)
                            }
                            className={`rounded-lg border px-3 py-1.5 text-xs font-bold focus:outline-none ${
                              s.status === "Hadir"
                                ? "border-[#006c4a]/40 bg-[#82f5c1]/40 text-[#005137]"
                                : s.status === "Izin"
                                ? "border-amber-400 bg-amber-100 text-amber-900"
                                : s.status === "Sakit"
                                ? "border-[#89ceff] bg-[#c9e6ff] text-[#004c6e]"
                                : s.status === "Alfa"
                                ? "border-[#ba1a1a]/40 bg-[#ffdad6] text-[#93000a]"
                                : "border-[#c6c6cd] bg-[#eff4ff] text-[#45464d]"
                            }`}
                          >
                            {VALID_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: PENILAIAN RAPOT (STITCH LAYOUT) */}
        {activeTab === "rapot" && (
          <div className="space-y-6">
            {/* 4 Summary Stat Cards (Stitch Style) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Card 1: Navy Dark */}
              <div className="relative overflow-hidden rounded-xl bg-[#131b2e] p-5 text-white shadow-sm flex flex-col justify-between">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#bec6e0]">
                    Total Santri Terdaftar
                  </span>
                  <Users className="h-5 w-5 text-[#dae2fd]" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold tracking-tight">
                      {rapotStats.total}
                    </span>
                    <span className="text-sm text-[#bec6e0]">Santri</span>
                  </div>
                  <p className="mt-1 text-xs text-[#bec6e0]">
                    {session.displayName}
                  </p>
                </div>
              </div>

              {/* Card 2: Sudah Dinilai */}
              <div className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm border border-[#e5eeff]">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#45464d]">
                    Sudah Dinilai
                  </span>
                  <CheckCircle2 className="h-5 w-5 text-[#006c4a]" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-[#006c4a]">
                      {rapotStats.sudah}
                    </span>
                    <span className="text-xs text-[#45464d]">
                      / {rapotStats.total} Santri
                    </span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#e5eeff]">
                    <div
                      className="h-2 rounded-full bg-[#006c4a] transition-all"
                      style={{ width: `${rapotStats.pctSudah}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-[#45464d]">
                    <span>Progres Input</span>
                    <span className="text-[#006c4a]">{rapotStats.pctSudah}%</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Belum Dinilai */}
              <div className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm border border-[#e5eeff]">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#45464d]">
                    Belum Dinilai
                  </span>
                  <AlertCircle className="h-5 w-5 text-[#ba1a1a]" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-[#ba1a1a]">
                      {rapotStats.belum}
                    </span>
                    <span className="text-xs text-[#45464d]">Santri Tertunda</span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#e5eeff]">
                    <div
                      className="h-2 rounded-full bg-[#ba1a1a] transition-all"
                      style={{ width: `${rapotStats.pctBelum}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-[#45464d]">
                    <span>Perlu Diisi</span>
                    <span className="text-[#ba1a1a]">{rapotStats.pctBelum}%</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Rata-rata */}
              <div className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm border border-[#e5eeff]">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#45464d]">
                    Rata-Rata Nilai
                  </span>
                  <TrendingUp className="h-5 w-5 text-[#008cc7]" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-[#0b1c30]">
                      {rapotStats.rerata}
                    </span>
                    <span className="text-xs text-[#45464d]">/ 100</span>
                    <span className="ml-auto rounded-md bg-[#dce9ff] px-2 py-0.5 text-[11px] font-bold text-[#131b2e]">
                      Predikat {rapotStats.predikatRerata}
                    </span>
                  </div>
                  <p className="mt-3 text-[11px] font-medium text-[#006c4a]">
                    Siap simpan ke sheet Nilai_Rapot
                  </p>
                </div>
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm border border-[#e5eeff]">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#45464d]" />
                <input
                  type="text"
                  value={searchRapot}
                  onChange={(e) => setSearchRapot(e.target.value)}
                  placeholder="Cari nama siswa atau kelas..."
                  className="w-full rounded-xl border border-[#c6c6cd] bg-[#f8f9ff] py-2.5 pl-10 pr-4 text-sm text-[#0b1c30] placeholder-[#76777d] focus:border-[#006c4a] focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSetNilaiSeragam}
                  className="rounded-xl bg-[#131b2e] px-3.5 py-2.5 text-xs font-bold text-white hover:bg-[#213145]"
                >
                  Set Nilai Seragam
                </button>
                <button
                  onClick={handleExportRapotPDF}
                  className="flex items-center gap-1.5 rounded-xl border border-[#c6c6cd] bg-[#eff4ff] px-3.5 py-2.5 text-xs font-bold text-[#0b1c30] hover:bg-[#dce9ff]"
                >
                  <FileDown className="h-4 w-4" />
                  PDF
                </button>
                <button
                  onClick={handleSaveRapot}
                  disabled={savingRapot || rapotStudents.length === 0}
                  className="flex items-center gap-1.5 rounded-xl bg-[#006c4a] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#005137] disabled:opacity-50"
                >
                  {savingRapot ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan Semua Nilai
                </button>
              </div>
            </div>

            <p className="rounded-xl border border-dashed border-[#006c4a]/40 bg-[#eff4ff] px-4 py-2.5 text-xs text-[#0b1c30]">
              <strong className="text-[#006c4a]">Aturan Predikat:</strong> A
              (≥91.6) | A- (83.4–91.5) | B+ (75.1–83.3) | B (66.6–75.0) | B-
              (58.4–66.5) | C (&lt;58.4) • Tekan <strong>Enter</strong> /{" "}
              <strong>Panah Bawah</strong> untuk pindah baris cepat.
            </p>

            {/* Grading Table */}
            <div className="overflow-x-auto rounded-xl border border-[#e5eeff] bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#e5eeff] bg-[#eff4ff] text-xs font-bold uppercase text-[#45464d]">
                  <tr>
                    <th className="w-12 px-3 py-3.5 text-center">No</th>
                    <th className="px-3 py-3.5">Nama Siswa</th>
                    <th className="px-3 py-3.5">Kelas</th>
                    <th className="px-3 py-3.5 text-center">Nilai</th>
                    <th className="px-3 py-3.5 text-center">Predikat</th>
                    <th className="px-3 py-3.5">Deskripsi Capaian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff]">
                  {loadingRapot ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#006c4a]">
                        <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                        Memuat data nilai rapot...
                      </td>
                    </tr>
                  ) : filteredRapot.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#45464d]">
                        Tidak ada siswa ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredRapot.map((s, idx) => {
                      const origIdx = rapotStudents.findIndex(
                        (r) => r.rowId === s.rowId
                      );
                      const predColor =
                        s.predikat === "A"
                          ? "bg-[#82f5c1] text-[#005137]"
                          : s.predikat === "A-"
                          ? "bg-[#dae2fd] text-[#131b2e]"
                          : s.predikat === "B+"
                          ? "bg-[#c9e6ff] text-[#004c6e]"
                          : s.predikat === "B" || s.predikat === "B-"
                          ? "bg-amber-100 text-amber-900"
                          : s.predikat === "C"
                          ? "bg-[#ffdad6] text-[#93000a]"
                          : "bg-[#eff4ff] text-[#45464d]";

                      return (
                        <tr key={s.rowId} className="hover:bg-[#f8f9ff]">
                          <td className="px-3 py-3 text-center text-xs font-semibold text-[#45464d]">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-3 font-bold text-[#0b1c30]">
                            {s.nama}
                          </td>
                          <td className="px-3 py-3">
                            <span className="rounded-md bg-[#dae2fd] px-2 py-0.5 text-xs font-bold text-[#131b2e]">
                              {s.kelas}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <input
                              id={`rapot-input-${idx}`}
                              type="number"
                              min={0}
                              max={100}
                              step="any"
                              value={s.nilai}
                              onChange={(e) =>
                                handleRapotNilaiChange(origIdx, e.target.value)
                              }
                              onKeyDown={(e) => handleRapotKeyDown(e, idx)}
                              placeholder="0-100"
                              className="w-20 rounded-lg border border-[#c6c6cd] bg-[#f8f9ff] py-1.5 text-center text-sm font-bold text-[#0b1c30] focus:border-[#006c4a] focus:bg-white focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`inline-block rounded-md px-2.5 py-1 text-xs font-extrabold ${predColor}`}
                            >
                              {s.predikat}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-xs text-[#45464d]">
                            {s.deskripsi}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: IZIN LAPTOP */}
        {activeTab === "laptop" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#e5eeff] bg-white p-5 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-[#0b1c30]">
                    Rekap Izin Laptop Santri (Boarding)
                  </h2>
                  <p className="text-xs text-[#45464d]">
                    Centang siswa yang diizinkan membawa laptop untuk kegiatan SEP hari Sabtu.
                  </p>
                </div>
                <span className="rounded-full bg-[#82f5c1] px-3 py-1 text-xs font-bold text-[#005137]">
                  Terpilih: {selectedLaptopIds.length} siswa
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={laptopKeperluan}
                  onChange={(e) => setLaptopKeperluan(e.target.value)}
                  placeholder="Keperluan / alasan izin laptop..."
                  className="flex-1 min-w-[220px] rounded-xl border border-[#c6c6cd] bg-[#f8f9ff] px-3.5 py-2.5 text-sm text-[#0b1c30] placeholder-[#76777d] focus:border-[#006c4a] focus:bg-white focus:outline-none"
                />
                <button
                  onClick={() =>
                    setSelectedLaptopIds(
                      selectedLaptopIds.length === students.length
                        ? []
                        : students.map((s) => s.rowId)
                    )
                  }
                  className="rounded-xl border border-[#c6c6cd] bg-[#eff4ff] px-3.5 py-2.5 text-xs font-bold text-[#0b1c30] hover:bg-[#dce9ff]"
                >
                  {selectedLaptopIds.length === students.length
                    ? "Batal Semua"
                    : "Pilih Semua"}
                </button>
                <button
                  onClick={handleExportLaptopPDF}
                  className="flex items-center gap-1.5 rounded-xl border border-[#c6c6cd] bg-[#eff4ff] px-3.5 py-2.5 text-xs font-bold text-[#0b1c30] hover:bg-[#dce9ff]"
                >
                  <FileDown className="h-4 w-4" />
                  PDF
                </button>
                <button
                  onClick={handleSaveLaptop}
                  disabled={savingLaptop || selectedLaptopIds.length === 0}
                  className="flex items-center gap-1.5 rounded-xl bg-[#006c4a] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#005137] disabled:opacity-50"
                >
                  {savingLaptop ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan Izin Laptop
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#e5eeff] bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#e5eeff] bg-[#eff4ff] text-xs font-bold uppercase text-[#45464d]">
                  <tr>
                    <th className="w-12 px-4 py-3.5 text-center">Pilih</th>
                    <th className="px-4 py-3.5">Nama Siswa</th>
                    <th className="px-4 py-3.5">Kelas</th>
                    <th className="px-4 py-3.5">Kamar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eff4ff]">
                  {students.map((s) => {
                    const checked = selectedLaptopIds.includes(s.rowId);
                    return (
                      <tr
                        key={s.rowId}
                        onClick={() => toggleLaptopStudent(s.rowId)}
                        className={`cursor-pointer transition ${
                          checked ? "bg-[#82f5c1]/25" : "hover:bg-[#f8f9ff]"
                        }`}
                      >
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {}}
                            className="h-4 w-4 accent-[#006c4a]"
                          />
                        </td>
                        <td className="px-4 py-3 font-bold text-[#0b1c30]">
                          {s.nama}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-[#dae2fd] px-2 py-0.5 text-xs font-bold text-[#131b2e]">
                            {s.kelas}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#45464d]">
                          {s.kamar || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: DENAH KELAS (PUTRA & PUTRI) */}
        {activeTab === "denah" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5eeff] bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-base font-bold text-[#0b1c30]">
                  Denah Lokasi Kelas Ekstrakurikuler
                </h2>
                <p className="text-xs text-[#45464d]">
                  Tampilan langsung sesuai warna &amp; tata letak lantai di Google Sheets (terbagi Putra &amp; Putri).
                </p>
              </div>
              <div className="flex gap-2">
                {(["Putra", "Putri"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setDenahGender(g)}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                      denahGender === g
                        ? g === "Putra"
                          ? "bg-[#131b2e] text-white shadow-sm"
                          : "bg-[#006c4a] text-white shadow-sm"
                        : "bg-[#eff4ff] text-[#45464d] hover:text-[#0b1c30]"
                    }`}
                  >
                    Denah {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#e5eeff] bg-white p-4 shadow-sm">
              {loadingDenah ? (
                <div className="py-12 text-center text-[#006c4a]">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                  Memuat denah dari Google Sheets...
                </div>
              ) : !denahData ? (
                <div className="py-12 text-center text-[#45464d]">
                  Data denah belum tersedia.
                </div>
              ) : (
                (() => {
                  const activeDenah =
                    denahGender === "Putra" ? denahData.putra : denahData.putri;
                  const rows = activeDenah.rows || [];
                  const merges = activeDenah.merges || [];
                  if (rows.length === 0) {
                    return (
                      <div className="py-12 text-center text-[#45464d]">
                        Sheet &ldquo;{activeDenah.title}&rdquo; kosong.
                      </div>
                    );
                  }
                  const maxCols = Math.max(...rows.map((r) => r.length), 1);

                  const isCoveredByMerge = (r: number, c: number) =>
                    merges.some(
                      (m) =>
                        r >= m.startRow &&
                        r < m.endRow &&
                        c >= m.startCol &&
                        c < m.endCol &&
                        !(r === m.startRow && c === m.startCol)
                    );

                  const getMergeSpan = (r: number, c: number) => {
                    const m = merges.find(
                      (mg) => mg.startRow === r && mg.startCol === c
                    );
                    if (!m) return { rowSpan: 1, colSpan: 1 };
                    return {
                      rowSpan: m.endRow - m.startRow,
                      colSpan: m.endCol - m.startCol,
                    };
                  };

                  return (
                    <div>
                      <div className="mb-2 text-xs font-bold text-[#006c4a]">
                        Sheet: {activeDenah.title}
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-[#c6c6cd] bg-white p-1">
                        <table className="w-full border-collapse text-xs">
                          <tbody>
                            {rows.map((row, rIdx) => (
                              <tr key={rIdx}>
                                {Array.from({ length: maxCols }).map(
                                  (_, cIdx) => {
                                    if (isCoveredByMerge(rIdx, cIdx))
                                      return null;
                                    const { rowSpan, colSpan } = getMergeSpan(
                                      rIdx,
                                      cIdx
                                    );
                                    const cell = row[cIdx];
                                    const val = cell?.val || "";
                                    const bg = cell?.bg || "#ffffff";
                                    const fg = cell?.fg || "#0f172a";
                                    return (
                                      <td
                                        key={cIdx}
                                        rowSpan={rowSpan}
                                        colSpan={colSpan}
                                        style={{
                                          backgroundColor: bg,
                                          color: fg,
                                          fontWeight: cell?.bold ? 700 : 500,
                                        }}
                                        className="min-w-[80px] border border-slate-300 px-2 py-2 text-center align-middle"
                                      >
                                        {val}
                                      </td>
                                    );
                                  }
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        )}
      </main>

      {/* Klaim Siswa Modal */}
      <KlaimModal
        isOpen={klaimOpen}
        targetEkstra={session.displayName}
        onClose={() => setKlaimOpen(false)}
        onSuccess={(msg) => {
          showToast(msg, true);
          loadAbsensiData(session.displayName);
          loadRapotData(session.displayName);
        }}
      />
    </div>
  );
}

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

  const [activeTab, setActiveTab] = useState<"absensi" | "rapot">("absensi");
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchAbsensi, setSearchAbsensi] = useState("");
  const [savingAbsensi, setSavingAbsensi] = useState(false);

  const [rapotStudents, setRapotStudents] = useState<RapotItem[]>([]);
  const [loadingRapot, setLoadingRapot] = useState(false);
  const [savingRapot, setSavingRapot] = useState(false);

  const [klaimOpen, setKlaimOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // 1. Load session from localStorage & fetch Info_Ekstra
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

  // 2. Load students for active session
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
    const input = prompt("Masukkan nilai seragam untuk semua siswa (0 - 100):", "85");
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
    showToast(`Nilai ${num} diterapkan. Klik Simpan Semua Nilai untuk menyimpan.`, true);
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
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
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
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl ${
            toast.ok
              ? "border-emerald-500/40 bg-emerald-950/95 text-emerald-200"
              : "border-red-500/40 bg-red-950/95 text-red-200"
          }`}
        >
          {toast.ok ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-400" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/40">
            <Sparkles className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white sm:text-lg">
              {session.displayName}
            </h1>
            <p className="text-xs text-slate-400">
              Pembina: <span className="font-semibold text-sky-400">{session.pengajar}</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/20 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </header>

      {/* Navigation Tabs */}
      <div className="mb-6 flex gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 p-1.5">
        <button
          onClick={() => setActiveTab("absensi")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
            activeTab === "absensi"
              ? "bg-blue-600 text-white shadow-lg"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
          Absensi Harian
        </button>
        <button
          onClick={() => setActiveTab("rapot")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
            activeTab === "rapot"
              ? "bg-blue-600 text-white shadow-lg"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Award className="h-4 w-4" />
          Penilaian Rapot
        </button>
      </div>

      {/* TAB 1: ABSENSI */}
      {activeTab === "absensi" && (
        <div className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {[
              { label: "Hadir", val: stats.Hadir, cls: "text-emerald-400 border-emerald-500/30" },
              { label: "Izin", val: stats.Izin, cls: "text-amber-400 border-amber-500/30" },
              { label: "Sakit", val: stats.Sakit, cls: "text-sky-400 border-sky-500/30" },
              { label: "Alfa", val: stats.Alfa, cls: "text-red-400 border-red-500/30" },
              { label: "Belum", val: stats.Belum, cls: "text-slate-300 border-slate-700" },
            ].map((st) => (
              <div
                key={st.label}
                className={`rounded-xl border bg-slate-900/80 p-2.5 text-center ${st.cls}`}
              >
                <div className="text-[10px] font-bold uppercase text-slate-400">
                  {st.label}
                </div>
                <div className="mt-0.5 text-lg font-extrabold">{st.val}</div>
              </div>
            ))}
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchAbsensi}
                onChange={(e) => setSearchAbsensi(e.target.value)}
                placeholder="Cari nama atau kelas..."
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setKlaimOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-sky-500"
              >
                <UserPlus className="h-4 w-4" />
                Klaim Siswa
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
              >
                <FileDown className="h-4 w-4" />
                PDF
              </button>
              <button
                onClick={handleSaveAbsensi}
                disabled={savingAbsensi || students.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-50"
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
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-center w-12">No</th>
                  <th className="px-4 py-3">Nama Siswa</th>
                  <th className="px-4 py-3">Kelas</th>
                  <th className="px-4 py-3 text-right">Status Kehadiran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {loadingStudents ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-sky-400">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                      Memuat daftar siswa...
                    </td>
                  </tr>
                ) : filteredAbsensi.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      <Users className="mx-auto mb-2 h-6 w-6 opacity-50" />
                      Tidak ada siswa ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredAbsensi.map((s, idx) => (
                    <tr key={s.rowId} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-center text-xs text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">
                        {s.nama}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-xs font-bold text-sky-300">
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
                              ? "border-emerald-500/50 bg-emerald-950 text-emerald-300"
                              : s.status === "Izin"
                              ? "border-amber-500/50 bg-amber-950 text-amber-300"
                              : s.status === "Sakit"
                              ? "border-sky-500/50 bg-sky-950 text-sky-300"
                              : s.status === "Alfa"
                              ? "border-red-500/50 bg-red-950 text-red-300"
                              : "border-slate-700 bg-slate-800 text-slate-300"
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

      {/* TAB 2: PENILAIAN RAPOT */}
      {activeTab === "rapot" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Aturan: A (≥91.6) | A- (83.4-91.5) | B+ (75.1-83.3) | B (66.6-75.0)
              | B- (58.4-66.5) | C (&lt;58.4)
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSetNilaiSeragam}
                className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-500"
              >
                Set Nilai Seragam
              </button>
              <button
                onClick={handleSaveRapot}
                disabled={savingRapot || rapotStudents.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
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

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase text-blue-300">
                <tr>
                  <th className="px-3 py-3 text-center w-12">No</th>
                  <th className="px-3 py-3">Nama Siswa</th>
                  <th className="px-3 py-3">Kelas</th>
                  <th className="px-3 py-3 text-center">Nilai</th>
                  <th className="px-3 py-3 text-center">Predikat</th>
                  <th className="px-3 py-3">Deskripsi Capaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {loadingRapot ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-sky-400">
                      <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
                      Memuat data nilai rapot...
                    </td>
                  </tr>
                ) : rapotStudents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      Tidak ada siswa terdaftar pada ekstrakurikuler ini.
                    </td>
                  </tr>
                ) : (
                  rapotStudents.map((s, idx) => (
                    <tr key={s.rowId} className="hover:bg-slate-800/40">
                      <td className="px-3 py-3 text-center text-xs text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-3 font-bold text-white">
                        {s.nama}
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-xs font-bold text-sky-300">
                          {s.kelas}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={s.nilai}
                          onChange={(e) =>
                            handleRapotNilaiChange(idx, e.target.value)
                          }
                          placeholder="0-100"
                          className="w-20 rounded-lg border border-blue-500/60 bg-slate-950 py-1.5 text-center text-sm font-bold text-white focus:border-blue-400 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="rounded-md bg-slate-800 px-2.5 py-1 text-xs font-extrabold text-amber-300">
                          {s.predikat}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-300">
                        {s.deskripsi}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

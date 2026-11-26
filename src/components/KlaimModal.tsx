"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, X, UserPlus, CheckCircle2, Loader2 } from "lucide-react";

interface MasterStudent {
  rowId: number;
  nama: string;
  ekstraLama: string;
  kelas: string;
  jk: string;
}

interface KlaimModalProps {
  isOpen: boolean;
  targetEkstra: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function KlaimModal({
  isOpen,
  targetEkstra,
  onClose,
  onSuccess,
}: KlaimModalProps) {
  const [masterList, setMasterList] = useState<MasterStudent[]>([]);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [query, setQuery] = useState("");
  const [movingId, setMovingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setErrorMsg("");
    if (masterList.length > 0) return;

    setLoadingMaster(true);
    fetch("/api/siswa/master")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setMasterList(data.students || []);
        } else {
          setErrorMsg(data.message || "Gagal memuat data siswa.");
        }
      })
      .catch((err) => setErrorMsg(err.message))
      .finally(() => setLoadingMaster(false));
  }, [isOpen, masterList.length]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    return masterList
      .filter((s) => {
        const nama = s.nama.toLowerCase();
        const kelas = s.kelas.toLowerCase();
        return terms.every((t) => nama.includes(t) || kelas.includes(t));
      })
      .slice(0, 30);
  }, [masterList, query]);

  const handleKlaim = async (s: MasterStudent) => {
    if (
      !confirm(
        `Pindahkan "${s.nama}" (${s.kelas}) ke "${targetEkstra}"?\n\nSiswa akan langsung tercatat di Google Sheets.`
      )
    ) {
      return;
    }

    setMovingId(s.rowId);
    try {
      const res = await fetch("/api/siswa/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowId: s.rowId,
          namaExpected: s.nama,
          ekstraBaru: targetEkstra,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMasterList((prev) =>
          prev.map((item) =>
            item.rowId === s.rowId
              ? { ...item, ekstraLama: targetEkstra }
              : item
          )
        );
        onSuccess(data.message);
        onClose();
      } else {
        alert(data.message || "Gagal memindahkan siswa.");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error koneksi.");
    } finally {
      setMovingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#131b2e]/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl border border-[#c6c6cd] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e5eeff] px-5 py-4">
          <div className="flex items-center gap-2 text-base font-bold text-[#0b1c30]">
            <UserPlus className="h-5 w-5 text-[#006c4a]" />
            Tambahkan / Pindahkan Murid
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#45464d] hover:bg-[#eff4ff] hover:text-[#0b1c30]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="rounded-xl border border-[#82f5c1] bg-[#eff4ff] px-3.5 py-2.5 text-xs">
            <span className="text-[#45464d]">Target Ekstrakurikuler:</span>
            <div className="mt-0.5 text-sm font-bold text-[#006c4a]">
              {targetEkstra}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#006c4a]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ketik nama siswa atau kelas..."
              autoFocus
              className="w-full rounded-xl border border-[#c6c6cd] bg-[#f8f9ff] py-3 pl-10 pr-4 text-sm font-medium text-[#0b1c30] placeholder-[#76777d] focus:border-[#006c4a] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="min-h-[180px] max-h-[340px] overflow-y-auto rounded-xl border border-[#e5eeff] bg-[#f8f9ff] divide-y divide-[#e5eeff]">
            {loadingMaster ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#006c4a]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat database 842 siswa...
              </div>
            ) : errorMsg ? (
              <div className="p-4 text-center text-sm text-[#ba1a1a]">
                {errorMsg}
              </div>
            ) : !query.trim() ? (
              <div className="py-12 text-center text-xs text-[#45464d]">
                Ketik nama atau kelas di atas untuk mencari ({masterList.length}{" "}
                siswa siap dicari).
              </div>
            ) : matches.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#ba1a1a]">
                Siswa &ldquo;{query}&rdquo; tidak ditemukan di database.
              </div>
            ) : (
              matches.map((s) => {
                const isAlreadyHere =
                  s.ekstraLama.toLowerCase() === targetEkstra.toLowerCase();
                return (
                  <div
                    key={s.rowId}
                    className="flex items-center justify-between gap-3 bg-white p-3.5 hover:bg-[#eff4ff]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-bold text-[#0b1c30]">
                          {s.nama}
                        </span>
                        <span className="rounded bg-[#dae2fd] px-1.5 py-0.5 text-[11px] font-bold text-[#131b2e]">
                          {s.kelas}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${
                            s.jk === "Putra" ? "bg-[#131b2e]" : "bg-[#006c4a]"
                          }`}
                        >
                          {s.jk}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[#45464d]">
                        Ekstra sebelumnya:{" "}
                        <span className="font-semibold text-[#004c6e]">
                          {s.ekstraLama}
                        </span>
                      </div>
                    </div>

                    {isAlreadyHere ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#82f5c1] px-2.5 py-1.5 text-xs font-bold text-[#005137]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Sudah di sini
                      </span>
                    ) : (
                      <button
                        onClick={() => handleKlaim(s)}
                        disabled={movingId === s.rowId}
                        className="shrink-0 rounded-lg bg-[#006c4a] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#005137] disabled:opacity-50"
                      >
                        {movingId === s.rowId ? "Memindah..." : "Pilih & Pindahkan"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

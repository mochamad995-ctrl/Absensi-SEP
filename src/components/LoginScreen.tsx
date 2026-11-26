"use client";

import { useState, useMemo } from "react";
import { LogIn, Users, Sparkles } from "lucide-react";

export interface EkstraOption {
  nama: string;
  pengajar: string;
  gender: string;
  displayName: string;
}

interface LoginScreenProps {
  ekstraList: EkstraOption[];
  loading: boolean;
  onLogin: (selected: EkstraOption) => void;
}

export default function LoginScreen({
  ekstraList,
  loading,
  onLogin,
}: LoginScreenProps) {
  const [gender, setGender] = useState<"Putra" | "Putri" | "">("");
  const [selectedDisplay, setSelectedDisplay] = useState("");

  const filteredEkstra = useMemo(() => {
    if (!gender) return [];
    return ekstraList.filter(
      (e) => e.gender.toLowerCase() === gender.toLowerCase()
    );
  }, [ekstraList, gender]);

  const selectedObj = useMemo(() => {
    return filteredEkstra.find((e) => e.displayName === selectedDisplay) || null;
  }, [filteredEkstra, selectedDisplay]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedObj) {
      onLogin(selectedObj);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9ff] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-[#c6c6cd]/60 bg-white p-7 shadow-[0_8px_30px_rgba(19,27,46,0.08)]">
        <div className="mb-6 text-center">
          <img
            src="/sep-icon.jpg"
            alt="Logo SEP"
            className="mx-auto mb-3 h-20 w-20 rounded-2xl object-cover shadow-md"
          />
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#0b1c30]">
            PRESENSI SEP
          </h1>
          <p className="mt-1 text-xs font-medium text-[#45464d]">
            SMA Progresif Bumi Shalawat • Masuk 1x untuk akses cepat
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 1: Pilih Gender */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#45464d]">
              1. Pilih Gender yang Diajar
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["Putra", "Putri"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => {
                    setGender(g);
                    setSelectedDisplay("");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold transition ${
                    gender === g
                      ? g === "Putra"
                        ? "border-[#131b2e] bg-[#131b2e] text-white shadow-sm"
                        : "border-[#006c4a] bg-[#006c4a] text-white shadow-sm"
                      : "border-[#c6c6cd] bg-[#eff4ff] text-[#0b1c30] hover:bg-[#e5eeff]"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Pilih Bidang Ekstrakurikuler */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#45464d]">
              2. Pilih Bidang Ekstrakurikuler
            </label>
            <select
              value={selectedDisplay}
              onChange={(e) => setSelectedDisplay(e.target.value)}
              disabled={!gender || loading}
              className="w-full rounded-xl border border-[#c6c6cd] bg-[#eff4ff] px-4 py-3 text-sm font-semibold text-[#0b1c30] focus:border-[#006c4a] focus:bg-white focus:outline-none disabled:opacity-50"
            >
              <option value="">
                {loading
                  ? "Memuat daftar ekstra..."
                  : !gender
                  ? "-- Pilih Gender terlebih dahulu --"
                  : "-- Pilih Bidang Ekstrakurikuler --"}
              </option>
              {filteredEkstra.map((item) => (
                <option key={item.displayName} value={item.displayName}>
                  {item.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Info Pembina */}
          {selectedObj && (
            <div className="rounded-xl border border-[#82f5c1] bg-[#eff4ff] px-4 py-3 text-xs">
              <span className="font-medium text-[#45464d]">
                Pembina / Pengajar:
              </span>
              <div className="mt-0.5 text-sm font-bold text-[#006c4a]">
                {selectedObj.pengajar}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedObj}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#006c4a] py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#005137] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <LogIn className="h-4 w-4" />
            Masuk ke Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}

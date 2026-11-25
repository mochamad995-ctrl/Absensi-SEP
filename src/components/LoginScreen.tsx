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
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/90 p-7 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/20 border border-blue-500/40">
            <Sparkles className="h-7 w-7 text-blue-400" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">
            PRESENSI SEP
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-400">
            SMA Progresif Bumi Shalawat • Masuk 1x untuk akses cepat
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 1: Pilih Gender */}
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">
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
                        ? "border-blue-500 bg-blue-600/25 text-blue-300 shadow-lg shadow-blue-500/10"
                        : "border-pink-500 bg-pink-600/25 text-pink-300 shadow-lg shadow-pink-500/10"
                      : "border-slate-700 bg-slate-800/70 text-slate-300 hover:border-slate-600 hover:text-white"
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
            <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300">
              2. Pilih Bidang Ekstrakurikuler
            </label>
            <select
              value={selectedDisplay}
              onChange={(e) => setSelectedDisplay(e.target.value)}
              disabled={!gender || loading}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
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
            <div className="rounded-xl border border-blue-500/30 bg-blue-950/30 px-4 py-3 text-xs">
              <span className="text-slate-400">Pembina / Pengajar:</span>
              <div className="mt-0.5 text-sm font-bold text-blue-300">
                {selectedObj.pengajar}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={!selectedObj}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <LogIn className="h-4 w-4" />
            Masuk ke Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}

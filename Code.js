/**
 * PRESENSI SEP - SMA PROGRESIF BUMI SHALAWAT
 * Backend Google Apps Script (Code.gs)
 * Runtime: V8
 */

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('PRESENSI SEP - SMA Progresif')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ============================================================
// KONSTANTA TIMEZONE & ENUM STATUS
// ============================================================
var SPREADSHEET_ID = "1p7x8l12EZs0yCJm2amkAp_agXbyg15YgXsSsS2rmZTg";
var TZ = "Asia/Jakarta";

function getSpreadsheetSafely() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {
    Logger.log("getActiveSpreadsheet error: " + e.toString());
  }
  if (SPREADSHEET_ID) {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (e2) {
      Logger.log("openById error: " + e2.toString());
    }
  }
  return null;
}
var VALID_STATUSES = ["Belum", "Hadir", "Izin", "Sakit", "Alfa"];

// ============================================================
// HELPER & VALIDASI
// ============================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidStatus(status) {
  if (!status) return false;
  var s = String(status).trim().toLowerCase();
  return VALID_STATUSES.some(function(v) { return v.toLowerCase() === s; });
}

function normalizeStatus(status) {
  if (!status) return "Belum";
  var s = String(status).trim().toLowerCase();
  for (var i = 0; i < VALID_STATUSES.length; i++) {
    if (VALID_STATUSES[i].toLowerCase() === s) return VALID_STATUSES[i];
  }
  return "Belum";
}

function safeInt(val, fallback) {
  var num = parseInt(val, 10);
  return isNaN(num) ? (fallback !== undefined ? fallback : 0) : num;
}

// Normalisasi nama ekstra: potong tanda gender di akhir dengan regex kuat dan buang non-breaking space
function normalisasiNamaEkstra(str) {
  if (!str) return "";
  var s = String(str).replace(/\u00A0/g, ' ').trim();
  s = s.replace(/\s*\(\s*(Putra|Putri)\s*\)\s*$/i, "");
  s = s.replace(/\s+(Putra|Putri)\s*$/i, "");
  return s.trim();
}

function normalisasiGender(str) {
  if (!str) return "";
  var s = String(str).replace(/\u00A0/g, ' ').trim().toLowerCase();
  if (s === "l" || s === "laki-laki" || s === "putra" || s === "pria") return "l";
  if (s === "p" || s === "perempuan" || s === "putri" || s === "wanita") return "p";
  return s;
}

// Infer gender dari nama kelas (misal X10-X15 adalah kelas putri, X1-X9 adalah kelas putra)
function inferGenderFromKelas(kelas) {
  if (!kelas) return "";
  var k = String(kelas).replace(/\u00A0/g, ' ').toUpperCase().trim();
  // Putri classes
  if (/^X1[0-5]/.test(k)) return "p";
  if (k.indexOf("A2") !== -1 || k.indexOf("A3") !== -1 || k.indexOf("B2") !== -1 || 
      k.indexOf("C3") !== -1 || k.indexOf("C4") !== -1 || k.indexOf("ICP 1") !== -1 || 
      k.indexOf("BBC 1") !== -1 || k.indexOf("IUPP 1") !== -1) return "p";
  // Putra classes
  if (/^X[1-9]($|\s)/.test(k)) return "l";
  if (k.indexOf("A1") !== -1 || k.indexOf("B1") !== -1 || k.indexOf("C1") !== -1 || 
      k.indexOf("C2") !== -1 || k.indexOf("E1") !== -1 || k.indexOf("ICP 2") !== -1 || 
      k.indexOf("BBC 2") !== -1 || k.indexOf("CTP") !== -1 || k.indexOf("IUPP 2") !== -1 || 
      k.indexOf("IUPP 3") !== -1) return "l";
  return "";
}

/**
 * HELPER TUNGGAL PENCOCOKAN SISWA BERDASARKAN EKSTRA & GENDER
 * Digunakan bersama oleh getDataEkstra (Tab Absensi) dan getDataNilaiRapotEkstra (Tab Rapot)
 */
function getSiswaByEkstraDanGender(namaEkstraSelected) {
  try {
    var ss = getSpreadsheetSafely();
    if (!ss || !namaEkstraSelected) return [];

    var cleanSelected = String(namaEkstraSelected).replace(/\u00A0/g, ' ').trim();
    var match = cleanSelected.match(/^(.*?)(?:\s*\(\s*(Putra|Putri)\s*\))?$/i);
    var namaEkstraOnly = match && match[1]
      ? normalisasiNamaEkstra(match[1]).toLowerCase()
      : normalisasiNamaEkstra(cleanSelected).toLowerCase();
    var genderTarget = match && match[2] ? normalisasiGender(match[2]) : "";

    var sheetSiswa = getSheetCaseInsensitive(ss, "Data_Siswa");
    if (!sheetSiswa || sheetSiswa.getLastRow() < 2) return [];

    var totalCols = sheetSiswa.getLastColumn();
    var colsToRead = Math.max(4, Math.min(totalCols, 8));
    var lastRow = sheetSiswa.getLastRow();
    var endRow = Math.min(lastRow, 900);
    if (endRow < 2) return [];

    var dataS = sheetSiswa.getRange(2, 1, endRow - 1, colsToRead).getValues();

    var result = [];
    for (var i = 0; i < dataS.length; i++) {
      var sNama = String(dataS[i][0] || "").replace(/\u00A0/g, ' ').trim();
      var rawEkstra = String(dataS[i][1] || "").replace(/\u00A0/g, ' ').trim();
      var sKelas = dataS[i][2] !== undefined ? String(dataS[i][2]).replace(/\u00A0/g, ' ').trim() : "";
      var sGenderRaw = dataS[i][3] !== undefined ? String(dataS[i][3]).replace(/\u00A0/g, ' ').trim() : "";

      if (!sNama || !rawEkstra || sNama.toLowerCase() === "nama") continue;

      var sEkstraPure = normalisasiNamaEkstra(rawEkstra).toLowerCase();

      // Cek apakah ekstrakulikuler sama
      if (sEkstraPure !== namaEkstraOnly) continue;

      // Tentukan gender siswa
      var sGenderCode = normalisasiGender(sGenderRaw);
      if (!sGenderCode) {
        var mG = rawEkstra.match(/\((Putra|Putri)\)/i);
        if (mG) sGenderCode = normalisasiGender(mG[1]);
      }
      if (!sGenderCode) {
        sGenderCode = inferGenderFromKelas(sKelas);
      }

      // Jika dropdown memiliki target gender (Putra/Putri), cocokkan
      if (genderTarget && sGenderCode && sGenderCode !== genderTarget) {
        continue;
      }

      var genderDisplay = sGenderCode === "l" ? "Putra" : (sGenderCode === "p" ? "Putri" : (sGenderRaw || "-"));
      var nilaiVal = (colsToRead >= 6 && dataS[i][5] !== undefined && dataS[i][5] !== null) ? String(dataS[i][5]).trim() : "";
      var kamarVal = (colsToRead >= 7 && dataS[i][6]) ? String(dataS[i][6]).trim() : "-";

      result.push({
        rowId: i + 2,
        nama: sNama,
        kelas: sKelas,
        gender: genderDisplay,
        genderCode: sGenderCode,
        ekstraRaw: rawEkstra,
        nilai: nilaiVal,
        kamar: kamarVal
      });
    }

    result.sort(function(a, b) {
      return String(a.nama).localeCompare(String(b.nama), 'id', { sensitivity: 'base' });
    });

    return result;
  } catch (err) {
    Logger.log("Error getSiswaByEkstraDanGender: " + err.toString());
    return [];
  }
}

function getSheetCaseInsensitive(ss, name) {
  if (!ss || !name) return null;
  var s = ss.getSheetByName(name);
  if (s) return s;
  var sheets = ss.getSheets();
  var target = name.trim().toLowerCase();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().trim().toLowerCase() === target) {
      return sheets[i];
    }
  }
  return null;
}

function getTodayStr() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");
}

function getNowTimestampStr() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm:ss");
}

// ============================================================
// CACHE SERVICE & IN-MEMORY (TTL 5 Menit)
// ============================================================
var _memCache = {};

function invalidateCacheEkstra(namaEkstraOnlyLower, dateStr) {
  var tgl = dateStr || getTodayStr();
  var eKey = (namaEkstraOnlyLower || "").trim().toLowerCase();
  var cacheKey = "status_map_" + tgl + "_" + eKey;

  delete _memCache[cacheKey];
  try {
    var cache = CacheService.getScriptCache();
    cache.remove(cacheKey);
  } catch (e) {
    Logger.log("Cache remove error: " + e.toString());
  }
}

// ============================================================
// MAP STATUS HARI INI
// ============================================================
function getStatusHariIniMap(namaEkstraOnlyLower, dateStr) {
  var today = dateStr || getTodayStr();
  var eKey = (namaEkstraOnlyLower || "").trim().toLowerCase();
  var cacheKey = "status_map_" + today + "_" + eKey;

  if (_memCache[cacheKey]) {
    return _memCache[cacheKey];
  }

  try {
    var cache = CacheService.getScriptCache();
    var cachedJson = cache.get(cacheKey);
    if (cachedJson) {
      var parsed = JSON.parse(cachedJson);
      _memCache[cacheKey] = parsed;
      return parsed;
    }
  } catch (e) {
    Logger.log("Cache get error: " + e.toString());
  }

  var result = {};
  try {
    var ss = getSpreadsheetSafely();
    var sheet = ss.getSheetByName("Log_Absensi");
    if (!sheet) return result;

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 7) return result;

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var dateCol = -1;
    for (var c = 7; c < headers.length; c++) {
      var h = headers[c];
      var fh = (h instanceof Date) ? Utilities.formatDate(h, TZ, "yyyy-MM-dd") : String(h || "").trim();
      if (fh === today) { dateCol = c + 1; break; }
    }
    if (dateCol === -1) return result;

    var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (var i = 0; i < data.length; i++) {
      var e = normalisasiNamaEkstra(data[i][4]).toLowerCase();
      if (eKey && e !== eKey) continue;

      var n = String(data[i][2] || "").trim().toLowerCase();
      var status = String(data[i][dateCol - 1] || "").trim();
      if (n && status && status.toLowerCase() !== "belum") {
        result[n] = normalizeStatus(status);
      }
    }

    _memCache[cacheKey] = result;
    try {
      var cachePut = CacheService.getScriptCache();
      cachePut.put(cacheKey, JSON.stringify(result), 300); // 5 menit
    } catch (errPut) {
      Logger.log("Cache put error: " + errPut.toString());
    }
  } catch (err) {
    Logger.log("Error getStatusHariIniMap: " + err.toString());
  }
  return result;
}

function getStatusHariIniSiswa(nama, ekstra, dateStr) {
  var eKey = normalisasiNamaEkstra(ekstra).toLowerCase();
  var map = getStatusHariIniMap(eKey, dateStr);
  var nKey = String(nama || "").trim().toLowerCase();
  return map[nKey] || "Belum";
}

// ============================================================
// 1. AMBIL DAFTAR EKSTRA
// ============================================================
function getDaftarEkstra() {
  try {
    var ss = getSpreadsheetSafely();
    var sheet = ss.getSheetByName("Info_Ekstra");
    if (!sheet) return [];

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    var list = [];
    var seen = {};

    for (var i = 0; i < data.length; i++) {
      var namaEkstra = data[i][0] ? String(data[i][0]).trim() : "";
      var gender = data[i][2] ? String(data[i][2]).trim() : "";

      if (namaEkstra !== "") {
        var displayName = gender ? namaEkstra + " (" + gender + ")" : namaEkstra;
        if (!seen[displayName]) {
          seen[displayName] = true;
          list.push(displayName);
        }
      }
    }
    return list;
  } catch (err) {
    Logger.log("Error getDaftarEkstra: " + err.toString());
    return [];
  }
}

// ============================================================
// 2. AMBIL DATA SISWA & PENGAJAR
// ============================================================
function getDataEkstra(namaEkstraSelected) {
  try {
    var ss = getSpreadsheetSafely();
    if (!namaEkstraSelected) return { pengajar: "-", students: [] };

    var cleanSelected = String(namaEkstraSelected).replace(/\u00A0/g, ' ').trim();
    var match = cleanSelected.match(/^(.*?)(?:\s*\(\s*(Putra|Putri)\s*\))?$/i);
    var namaEkstraOnly = match && match[1]
      ? normalisasiNamaEkstra(match[1]).toLowerCase()
      : normalisasiNamaEkstra(cleanSelected).toLowerCase();
    var genderTarget = match && match[2] ? normalisasiGender(match[2]) : "";

    // Cari pengajar dari sheet Info_Ekstra (batch read)
    var sheetInfo = ss.getSheetByName("Info_Ekstra");
    var namaPengajar = "-";
    if (sheetInfo && sheetInfo.getLastRow() >= 2) {
      var dataInfo = sheetInfo.getRange(2, 1, sheetInfo.getLastRow() - 1, 3).getValues();
      for (var i = 0; i < dataInfo.length; i++) {
        var ekstraInfo = normalisasiNamaEkstra(dataInfo[i][0]).toLowerCase();
        var genderInfo = dataInfo[i][2] ? normalisasiGender(dataInfo[i][2]) : "";
        if (ekstraInfo === namaEkstraOnly) {
          if (!genderTarget || genderInfo === genderTarget || genderInfo === "") {
            namaPengajar = dataInfo[i][1] ? String(dataInfo[i][1]).trim() : "-";
            break;
          }
        }
      }
    }

    // Ambil status HARI INI dari cache/Log_Absensi sekali saja
    var statusMap = getStatusHariIniMap(namaEkstraOnly);

    // Kumpulkan siswa menggunakan helper bersama getSiswaByEkstraDanGender
    var baseStudents = getSiswaByEkstraDanGender(cleanSelected);
    var listSiswa = [];

    for (var j = 0; j < baseStudents.length; j++) {
      var s = baseStudents[j];
      var statusHariIni = statusMap[s.nama.toLowerCase()] || 'Belum';

      listSiswa.push({
        rowId: s.rowId,
        nama: s.nama,
        kelas: s.kelas,
        gender: s.gender,
        status: statusHariIni,
        nilai: s.nilai,
        kamar: s.kamar
      });
    }

    return {
      pengajar: namaPengajar,
      students: listSiswa
    };
  } catch (err) {
    Logger.log("Error getDataEkstra: " + err.toString());
    return { pengajar: "-", students: [] };
  }
}

// ============================================================
// 3. SINKRONISASI BATCH KE REKAPITULASI (IN-MEMORY SINGLE PASS)
// ============================================================
function syncToRekapitulasiBatch(items) {
  if (!items || items.length === 0) return;

  try {
    var ss = getSpreadsheetSafely();
    var sheet = ss.getSheetByName("rekapitulasi absensi");
    if (!sheet) {
      sheet = ss.insertSheet("rekapitulasi absensi");
      sheet.appendRow(["Nama Siswa", "Ekstrakulikuler", "Kelas", "Hadir", "Sakit", "Izin", "Alpa"]);
      sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#f3f3f3");
      sheet.setFrozenRows(1);
    }

    function statusToColIdx(st) {
      st = String(st || "").toLowerCase();
      if (st === 'hadir') return 3; // index di array 0-based: col 4
      if (st === 'sakit') return 4; // col 5
      if (st === 'izin')  return 5; // col 6
      if (st === 'alfa')  return 6; // col 7
      return -1;
    }

    var lastRow = sheet.getLastRow();
    var allData = [];
    if (lastRow >= 2) {
      allData = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    }

    // Build hash index: "nama|ekstra" -> index di allData
    var mapIndex = {};
    for (var i = 0; i < allData.length; i++) {
      var nK = String(allData[i][0] || "").trim().toLowerCase();
      var eK = normalisasiNamaEkstra(allData[i][1]).toLowerCase();
      mapIndex[nK + "|" + eK] = i;
    }

    var modifiedIndices = {};
    var rowsToAppend = [];

    for (var k = 0; k < items.length; k++) {
      var item = items[k];
      var nama = String(item.nama || "").trim();
      var ekstra = String(item.ekstra || "").trim();
      var kelas = String(item.kelas || "").trim();
      var newStatus = normalizeStatus(item.status);
      var oldStatus = normalizeStatus(item.oldStatus);

      if (newStatus === oldStatus) continue;

      var nKey = nama.toLowerCase();
      var eKey = normalisasiNamaEkstra(ekstra).toLowerCase();
      var hashKey = nKey + "|" + eKey;

      var newColIdx = statusToColIdx(newStatus);
      var oldColIdx = statusToColIdx(oldStatus);

      if (mapIndex.hasOwnProperty(hashKey)) {
        var rowIdx = mapIndex[hashKey];
        if (kelas && String(allData[rowIdx][2] || "").trim() !== kelas) {
          allData[rowIdx][2] = kelas;
        }

        if (oldColIdx !== -1) {
          var curOldVal = safeInt(allData[rowIdx][oldColIdx], 0);
          allData[rowIdx][oldColIdx] = Math.max(0, curOldVal - 1);
        }
        if (newColIdx !== -1) {
          var curNewVal = safeInt(allData[rowIdx][newColIdx], 0);
          allData[rowIdx][newColIdx] = curNewVal + 1;
        }
        modifiedIndices[rowIdx] = true;
      } else {
        // Siswa baru di rekapitulasi
        var h = (newColIdx === 3) ? 1 : 0;
        var s = (newColIdx === 4) ? 1 : 0;
        var iz = (newColIdx === 5) ? 1 : 0;
        var a = (newColIdx === 6) ? 1 : 0;

        var newRow = [nama, ekstra, kelas, h, s, iz, a];
        allData.push(newRow);
        var newIndex = allData.length - 1;
        mapIndex[hashKey] = newIndex;
        rowsToAppend.push(newRow);
      }
    }

    // Tulis kembali baris yang dimodifikasi
    var modKeys = Object.keys(modifiedIndices);
    if (modKeys.length > 0 && lastRow >= 2) {
      if (modKeys.length > 5 || modKeys.length === allData.length - rowsToAppend.length) {
        // Tulis ulang batch jika banyak modifikasi
        var existingRowCount = lastRow - 1;
        var existingSlice = allData.slice(0, existingRowCount);
        sheet.getRange(2, 1, existingRowCount, 7).setValues(existingSlice);
      } else {
        // Tulis baris per baris hanya jika sedikit
        for (var m = 0; m < modKeys.length; m++) {
          var idxM = parseInt(modKeys[m], 10);
          if (idxM < lastRow - 1) {
            sheet.getRange(idxM + 2, 1, 1, 7).setValues([allData[idxM]]);
          }
        }
      }
    }

    // Append baris baru jika ada
    if (rowsToAppend.length > 0) {
      var nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, rowsToAppend.length, 7).setValues(rowsToAppend);
    }
  } catch (e) {
    Logger.log("Error syncToRekapitulasiBatch: " + e.toString());
  }
}

// Wrapper backward compatibility
function syncToRekapitulasi(nama, ekstra, kelas, status, oldStatus) {
  syncToRekapitulasiBatch([{
    nama: nama,
    ekstra: ekstra,
    kelas: kelas,
    status: status,
    oldStatus: oldStatus
  }]);
}

// ============================================================
// 4. LOG ABSENSI HARIAN BATCH
// ============================================================
function logAbsensiBatch(items, keteranganDefault) {
  if (!items || items.length === 0) return { success: true };

  try {
    var ss = getSpreadsheetSafely();
    var sheet = ss.getSheetByName("Log_Absensi");

    if (!sheet) {
      sheet = ss.insertSheet("Log_Absensi");
      sheet.appendRow([
        "Timestamp", "Tanggal", "Nama_Siswa", "Kelas",
        "Ekstra", "Status", "Keterangan"
      ]);
      sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#f3f3f3");
      sheet.setFrozenRows(1);
      sheet.getRange("A:A").setNumberFormat("@");
    }

    var today = getTodayStr();
    var timestampStr = getNowTimestampStr();

    var lastCol = Math.max(sheet.getLastColumn(), 7);
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var dateCol = -1;

    for (var c = 7; c < headers.length; c++) {
      var h = headers[c];
      var fh = (h instanceof Date) ? Utilities.formatDate(h, TZ, "yyyy-MM-dd") : String(h || "").trim();
      if (fh === today) { dateCol = c + 1; break; }
    }

    if (dateCol === -1) {
      dateCol = lastCol + 1;
      sheet.getRange(1, dateCol).setValue(today)
        .setFontWeight("bold")
        .setHorizontalAlignment("center")
        .setBackground("#f3f3f3");
      lastCol = dateCol;
    }

    var lastRow = sheet.getLastRow();
    var allRows = [];
    if (lastRow >= 2) {
      allRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    }

    // Map: "nama|ekstra" -> index di allRows
    var rowMap = {};
    for (var i = 0; i < allRows.length; i++) {
      var nK = String(allRows[i][2] || "").trim().toLowerCase();
      var eK = normalisasiNamaEkstra(allRows[i][4]).toLowerCase();
      rowMap[nK + "|" + eK] = i;
    }

    var modifiedRowIndices = {};
    var rowsToAppend = [];

    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      var nama = String(it.nama || "").trim();
      var kelas = String(it.kelas || "").trim();
      var ekstra = String(it.ekstra || "").trim();
      var status = normalizeStatus(it.status);
      var ket = it.keterangan || keteranganDefault || "Absensi Reguler SEP";

      var nKey = nama.toLowerCase();
      var eKey = normalisasiNamaEkstra(ekstra).toLowerCase();
      var hashKey = nKey + "|" + eKey;

      if (rowMap.hasOwnProperty(hashKey)) {
        var rIdx = rowMap[hashKey];
        allRows[rIdx][0] = timestampStr;
        allRows[rIdx][1] = today;
        if (kelas) allRows[rIdx][3] = kelas;
        allRows[rIdx][5] = status;
        allRows[rIdx][6] = ket;
        allRows[rIdx][dateCol - 1] = status;
        modifiedRowIndices[rIdx] = true;
      } else {
        // Baris baru di Log_Absensi
        var newR = new Array(lastCol);
        for (var p = 0; p < lastCol; p++) newR[p] = "";
        newR[0] = timestampStr;
        newR[1] = today;
        newR[2] = nama;
        newR[3] = kelas;
        newR[4] = ekstra;
        newR[5] = status;
        newR[6] = ket;
        newR[dateCol - 1] = status;

        allRows.push(newR);
        var newIdx = allRows.length - 1;
        rowMap[hashKey] = newIdx;
        rowsToAppend.push(newR);
      }
    }

    // Flush modified rows
    var modKeys = Object.keys(modifiedRowIndices);
    if (modKeys.length > 0 && lastRow >= 2) {
      if (modKeys.length > 5 || modKeys.length === allRows.length - rowsToAppend.length) {
        var existingRowCount = lastRow - 1;
        var existingSlice = allRows.slice(0, existingRowCount);
        sheet.getRange(2, 1, existingRowCount, lastCol).setValues(existingSlice);
      } else {
        for (var m = 0; m < modKeys.length; m++) {
          var idxM = parseInt(modKeys[m], 10);
          if (idxM < lastRow - 1) {
            sheet.getRange(idxM + 2, 1, 1, lastCol).setValues([allRows[idxM]]);
          }
        }
      }
    }

    // Append baris baru
    if (rowsToAppend.length > 0) {
      var nextRow = sheet.getLastRow() + 1;
      sheet.getRange(nextRow, 1, rowsToAppend.length, lastCol).setValues(rowsToAppend);
      sheet.getRange(nextRow, 1, rowsToAppend.length, 1).setNumberFormat("@");
    }

    return { success: true };
  } catch (e) {
    Logger.log("Error logAbsensiBatch: " + e.toString());
    return { success: false, message: e.toString() };
  }
}

// Wrapper backward compatibility
function logAbsensi(nama, kelas, ekstra, status, keterangan) {
  return logAbsensiBatch([{
    nama: nama,
    kelas: kelas,
    ekstra: ekstra,
    status: status,
    keterangan: keterangan
  }], keterangan);
}

// ============================================================
// 5. UPDATE STATUS ABSENSI REGULER (BATCH & SINGLE)
// ============================================================
function updateStatusAbsensiBatch(items) {
  if (!items || items.length === 0) {
    return { success: false, message: "Tidak ada data yang dikirim" };
  }

  try {
    var ss = getSpreadsheetSafely();
    var sheet = getSheetCaseInsensitive(ss, "Data_Siswa");
    if (!sheet) return { success: false, message: "Sheet Data_Siswa tidak ditemukan" };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, message: "Data_Siswa kosong" };

    // Batch read seluruh sheet Data_Siswa (kolom A-E)
    var allDataSiswa = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

    // Map nama siswa ke baris data
    var todayMap = {};
    var processedItems = [];
    var affectedEkstras = {};

    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      var rowNumber = safeInt(it.rowId, -1);
      if (rowNumber < 2 || rowNumber > lastRow) {
        return { success: false, message: "Baris data " + it.rowId + " tidak valid!" };
      }

      var rowData = allDataSiswa[rowNumber - 2];
      var namaSiswa = String(rowData[0] || "").trim();
      var ekstraSiswa = String(rowData[1] || "").trim();
      var kelasSiswa = String(rowData[2] || "").trim();

      // Validasi anti stale rowId
      if (it.expectedNama && namaSiswa.toLowerCase() !== String(it.expectedNama).trim().toLowerCase()) {
        return {
          success: false,
          message: "Data '" + it.expectedNama + "' telah bergeser posisinya. Silakan refresh halaman."
        };
      }

      // Validasi status enum
      var newStatus = normalizeStatus(it.status);
      var eKey = normalisasiNamaEkstra(ekstraSiswa).toLowerCase();
      affectedEkstras[eKey] = true;

      if (!todayMap.hasOwnProperty(eKey)) {
        todayMap[eKey] = getStatusHariIniMap(eKey);
      }

      var oldStatus = todayMap[eKey][namaSiswa.toLowerCase()] || "Belum";

      // Simpan perubahan ke in-memory Data_Siswa kolom E
      allDataSiswa[rowNumber - 2][4] = newStatus;

      // Update in-memory map agar konsisten jika ada item ganda
      todayMap[eKey][namaSiswa.toLowerCase()] = newStatus;

      processedItems.push({
        rowNumber: rowNumber,
        nama: namaSiswa,
        ekstra: ekstraSiswa,
        kelas: kelasSiswa,
        status: newStatus,
        oldStatus: oldStatus,
        keterangan: "Absensi Reguler SEP"
      });
    }

    // Flush perubahan ke Data_Siswa (hanya kolom E)
    if (processedItems.length === 1) {
      sheet.getRange(processedItems[0].rowNumber, 5).setValue(processedItems[0].status);
    } else {
      var colEValues = [];
      for (var r = 0; r < allDataSiswa.length; r++) {
        colEValues.push([allDataSiswa[r][4]]);
      }
      sheet.getRange(2, 5, colEValues.length, 1).setValues(colEValues);
    }

    // Filter yang benar-benar berubah statusnya untuk sync
    var changedItems = processedItems.filter(function(pi) {
      return pi.status.toLowerCase() !== pi.oldStatus.toLowerCase();
    });

    if (changedItems.length > 0) {
      // 1. Sync ke rekapitulasi batch
      syncToRekapitulasiBatch(changedItems);

      // 2. Tulis ke Log_Absensi batch
      logAbsensiBatch(changedItems, "Absensi Reguler SEP");

      // Invalidate cache ekstra yang terpengaruh
      for (var ek in affectedEkstras) {
        invalidateCacheEkstra(ek);
      }
    }

    return {
      success: true,
      count: processedItems.length,
      message: "Status " + processedItems.length + " siswa berhasil diperbarui."
    };
  } catch (err) {
    Logger.log("Error updateStatusAbsensiBatch: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

// Wrapper backward compatibility
function updateStatusAbsensi(rowId, status, expectedNama) {
  var res = updateStatusAbsensiBatch([{
    rowId: rowId,
    status: status,
    expectedNama: expectedNama
  }]);
  return res;
}

// ============================================================
// 6. UPDATE NILAI (DENGAN VALIDASI ROW)
// ============================================================
function simpanNilai(rowId, nilaiVal, expectedNama) {
  try {
    var ss = getSpreadsheetSafely();
    var sheet = getSheetCaseInsensitive(ss, "Data_Siswa");
    if (!sheet) return { success: false, message: "Sheet Data_Siswa tidak ditemukan" };

    var rowNumber = safeInt(rowId, -1);
    if (rowNumber < 2 || rowNumber > sheet.getLastRow()) {
      return { success: false, message: "Baris data tidak valid!" };
    }

    if (expectedNama) {
      var curNama = String(sheet.getRange(rowNumber, 1).getValue() || "").trim();
      if (curNama.toLowerCase() !== String(expectedNama).trim().toLowerCase()) {
        return { success: false, message: "Data telah bergeser. Silakan refresh halaman." };
      }
    }

    sheet.getRange(rowNumber, 6).setValue(nilaiVal);
    return { success: true };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// ============================================================
// 7. SIMPAN IZIN LAPTOP (MENGGUNAKAN APPEND BATCH AMAN)
// ============================================================
function simpanDataIzinLaptop(dataArray) {
  try {
    var ss = getSpreadsheetSafely();
    var sheet = ss.getSheetByName("Izin_Laptop");
    if (!sheet) {
      sheet = ss.insertSheet("Izin_Laptop");
      sheet.appendRow(["Timestamp", "Pengajar", "Nama", "Kelas", "Ekstra", "Note"]);
      sheet.getRange(1, 1, 1, 6).setFontWeight("bold").setBackground("#f3f3f3");
      sheet.setFrozenRows(1);
    }

    var timestamp = getNowTimestampStr();

    var rows = dataArray.map(function(item) {
      return [
        timestamp,
        String(item.pengajar || "-").trim(),
        String(item.nama || "").trim(),
        String(item.kelas || "-").trim(),
        String(item.ekstra || "-").trim(),
        String(item.note || "Perizinan Laptop SEP").trim()
      ];
    });

    var nextRow = sheet.getLastRow() + 1;
    sheet.getRange(nextRow, 1, rows.length, 6).setValues(rows);

    return { success: true, count: dataArray.length };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

// ============================================================
// 8. EXPORT IZIN LAPTOP KE PDF (DENGAN ESCAPING & BASE64 DIRECT DOWNLOAD)
// ============================================================
function exportIzinLaptopKePDF(dataArray, tanggalSurat, saveToDrive) {
  try {
    if (!dataArray || dataArray.length === 0) {
      return { success: false, message: "Tidak ada siswa yang dipilih." };
    }

    var cleanTanggal = escapeHtml(tanggalSurat || getTodayStr());

    // Susun baris HTML dengan sanitasi
    var tableRows = "";
    for (var i = 0; i < dataArray.length; i++) {
      var item = dataArray[i];
      tableRows += "<tr>" +
        "<td>" + escapeHtml(item.pengajar || "-") + "</td>" +
        "<td><strong>" + escapeHtml(item.nama || "-") + "</strong></td>" +
        "<td>" + escapeHtml(item.kelas || "-") + "</td>" +
        "<td>" + escapeHtml(item.kamar || "-") + "</td>" +
        "<td>" + escapeHtml(item.keperluan || "-") + "</td>" +
        "</tr>";
    }

    var htmlContent = "<!DOCTYPE html>" +
      "<html><head><meta charset='UTF-8'>" +
      "<style>" +
      "body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 20px; }" +
      ".header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }" +
      ".header h1 { font-size: 16px; margin: 0 0 6px 0; letter-spacing: 0.5px; color: #0f172a; }" +
      ".header p { margin: 0; font-size: 12px; font-weight: bold; color: #2563eb; }" +
      "table { width: 100%; border-collapse: collapse; margin-top: 10px; }" +
      "th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; }" +
      "th { background-color: #f1f5f9; text-align: center; font-weight: 700; color: #0f172a; font-size: 11px; }" +
      "tr:nth-child(even) td { background-color: #f8fafc; }" +
      ".footer { margin-top: 30px; display: flex; justify-content: flex-end; }" +
      ".ttd-box { width: 200px; text-align: center; float: right; margin-top: 25px; }" +
      "</style>" +
      "</head><body>" +
      "<div class='header'>" +
      "<h1>SURAT PERIZINAN MEMBAWA LAPTOP SEP</h1>" +
      "<p>SMA PROGRESIF BUMI SHALAWAT — " + cleanTanggal + "</p>" +
      "</div>" +
      "<table>" +
      "<thead><tr>" +
      "<th style='width: 22%;'>Yang Mengizinkan</th>" +
      "<th style='width: 25%;'>Nama Siswa</th>" +
      "<th style='width: 15%;'>Kelas</th>" +
      "<th style='width: 15%;'>Kamar</th>" +
      "<th style='width: 23%;'>Keperluan / Alasan</th>" +
      "</tr></thead>" +
      "<tbody>" + tableRows + "</tbody>" +
      "</table>" +
      "<div class='ttd-box'>" +
      "<p>Sidoarjo, " + cleanTanggal + "<br>Pengajar / Pembina,</p>" +
      "<br><br><br>" +
      "<p><strong>(" + escapeHtml(dataArray[0].pengajar || "........................") + ")</strong></p>" +
      "</div>" +
      "</body></html>";

    var pdfBlob = Utilities.newBlob(htmlContent, 'text/html', 'surat.html').getAs('application/pdf');
    var fileName = "Perizinan_Laptop_" + cleanTanggal.replace(/[^a-zA-Z0-9]/g, '_') + ".pdf";
    pdfBlob.setName(fileName);

    var base64Data = Utilities.base64Encode(pdfBlob.getBytes());
    var fileUrl = null;

    if (saveToDrive === true) {
      try {
        var folderName = "Surat_Izin_Laptop_PDF";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
        var pdfFile = folder.createFile(pdfBlob);
        fileUrl = pdfFile.getUrl();
      } catch (driveErr) {
        Logger.log("Drive save skipped/error: " + driveErr.toString());
      }
    }

    return {
      success: true,
      namaFile: fileName,
      base64: base64Data,
      url: fileUrl
    };
  } catch (err) {
    Logger.log("Error exportIzinLaptopKePDF: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

// ============================================================
// 9. MONITORING SELURUH EKSTRA
// ============================================================
function getStatusSemuaEkstra() {
  try {
    var ss = getSpreadsheetSafely();
    var sheetInfo = ss.getSheetByName("Info_Ekstra");
    var sheetSiswa = getSheetCaseInsensitive(ss, "Data_Siswa");
    var sheetLog = ss.getSheetByName("Log_Absensi");

    if (!sheetInfo || !sheetSiswa) return [];

    var dataInfo = sheetInfo.getDataRange().getValues();
    var dataSiswa = sheetSiswa.getDataRange().getValues();
    var today = getTodayStr();

    var logHariIni = {};
    if (sheetLog && sheetLog.getLastRow() >= 2) {
      var lastColL = sheetLog.getLastColumn();
      var dataLog = sheetLog.getRange(2, 1, sheetLog.getLastRow() - 1, lastColL).getValues();
      var headersL = sheetLog.getRange(1, 1, 1, lastColL).getValues()[0];
      var dateColL = -1;
      for (var c = 7; c < headersL.length; c++) {
        var h = headersL[c];
        var fh = (h instanceof Date) ? Utilities.formatDate(h, TZ, "yyyy-MM-dd") : String(h || "").trim();
        if (fh === today) { dateColL = c; break; }
      }

      if (dateColL !== -1) {
        for (var L = 0; L < dataLog.length; L++) {
          var namaLog = String(dataLog[L][2] || "").trim().toLowerCase();
          var ekstraLog = normalisasiNamaEkstra(dataLog[L][4]).toLowerCase();
          var statusLog = String(dataLog[L][dateColL] || "").trim().toLowerCase();
          if (namaLog && ekstraLog && statusLog) {
            logHariIni[namaLog + "|" + ekstraLog] = statusLog;
          }
        }
      }
    }

    var ekstraStats = [];

    for (var i = 1; i < dataInfo.length; i++) {
      var namaEkstra = dataInfo[i][0] ? String(dataInfo[i][0]).trim() : "";
      var pembina = dataInfo[i][1] ? String(dataInfo[i][1]).trim() : "-";
      var gender = dataInfo[i][2] ? String(dataInfo[i][2]).trim() : "";

      if (!namaEkstra) continue;

      var ekstraKey = normalisasiNamaEkstra(namaEkstra).toLowerCase();
      var total = 0;
      var sudahAbsen = 0;
      var belum = 0;

      for (var j = 1; j < dataSiswa.length; j++) {
        var namaSiswaRaw = String(dataSiswa[j][0] || "").trim();
        var eSiswa = normalisasiNamaEkstra(dataSiswa[j][1]).toLowerCase();
        var gSiswa = normalisasiGender(dataSiswa[j][3]);

        if (eSiswa === ekstraKey) {
          var matchGender = true;
          if (gender !== "") matchGender = (gSiswa === gender.toLowerCase());
          if (matchGender) {
            total++;
            var key = namaSiswaRaw.toLowerCase() + "|" + ekstraKey;
            var statusHariIni = logHariIni[key];
            if (statusHariIni && statusHariIni !== "belum") sudahAbsen++;
            else belum++;
          }
        }
      }

      ekstraStats.push({
        nama: gender ? namaEkstra + " (" + gender + ")" : namaEkstra,
        namaEkstraMurni: namaEkstra,
        pembina: pembina,
        totalSiswa: total,
        sudahAbsen: sudahAbsen,
        belumAbsen: belum,
        status: (total === 0) ? 'Kosong' : (belum === 0 ? 'Lengkap' : (sudahAbsen > 0 ? 'Sebagian' : 'Belum'))
      });
    }

    return ekstraStats;
  } catch (err) {
    Logger.log("Error getStatusSemuaEkstra: " + err.toString());
    return [];
  }
}

// ============================================================
// 10. LATIHAN TAMBAHAN TAEKWONDO (BATCH & SINGLE)
// ============================================================
function getDataLatihanTambahan(tanggalTarget) {
  try {
    var ss = getSpreadsheetSafely();
    var sheet = ss.getSheetByName("Latihan Tambahan") || ss.getSheetByName("Latihan_Tambahan");
    if (!sheet) return { students: [] };

    var rangeData = sheet.getDataRange().getValues();
    if (rangeData.length < 2) return { students: [] };

    var tglCari = tanggalTarget ? String(tanggalTarget).trim() : getTodayStr();
    var headerRow = rangeData[0];
    var colIndex = -1;

    for (var c = 3; c < headerRow.length; c++) {
      var headerVal = headerRow[c];
      var formattedHeader = (headerVal instanceof Date)
        ? Utilities.formatDate(headerVal, TZ, "yyyy-MM-dd")
        : String(headerVal || "").trim();
      if (formattedHeader === tglCari) { colIndex = c; break; }
    }

    var list = [];
    for (var i = 1; i < rangeData.length; i++) {
      var nama = rangeData[i][1] ? String(rangeData[i][1]).trim() : "";
      var kelas = rangeData[i][2] ? String(rangeData[i][2]).trim() : "";
      var rawStatus = (colIndex !== -1 && rangeData[i][colIndex]) ? String(rangeData[i][colIndex]).trim() : "Belum";

      if (nama !== "") {
        list.push({
          rowId: i + 1,
          nama: nama,
          kelas: kelas,
          status: normalizeStatus(rawStatus)
        });
      }
    }

    return { students: list, tanggal: tglCari };
  } catch (err) {
    Logger.log("Error getDataLatihanTambahan: " + err.toString());
    return { students: [] };
  }
}

function updateAbsensiLatihanTambahanBatch(items, tanggalStr) {
  if (!items || items.length === 0) return { success: false, message: "Tidak ada data" };

  try {
    var ss = getSpreadsheetSafely();
    var sheet = ss.getSheetByName("Latihan Tambahan") || ss.getSheetByName("Latihan_Tambahan");
    if (!sheet) return { success: false, message: "Sheet Latihan Tambahan tidak ditemukan!" };

    var tglSimpan = tanggalStr ? String(tanggalStr).trim() : getTodayStr();
    var lastRow = sheet.getLastRow();
    var lastCol = Math.max(sheet.getLastColumn(), 3);
    if (lastRow < 2) return { success: false, message: "Sheet kosong" };

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var targetCol = -1;

    for (var c = 3; c < headers.length; c++) {
      var h = headers[c];
      var fh = (h instanceof Date) ? Utilities.formatDate(h, TZ, "yyyy-MM-dd") : String(h || "").trim();
      if (fh === tglSimpan) { targetCol = c + 1; break; }
    }

    if (targetCol === -1) {
      targetCol = lastCol + 1;
      sheet.getRange(1, targetCol).setValue(tglSimpan);
      sheet.getRange(1, targetCol).setFontWeight("bold").setHorizontalAlignment("center");
      lastCol = targetCol;
    }

    // Baca seluruh kolom A-targetCol sekaligus
    var dataAll = sheet.getRange(2, 1, lastRow - 1, targetCol).getValues();

    var syncItems = [];
    var logItems = [];
    var modifiedRows = {};

    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      var rowNumber = safeInt(it.rowId, -1);
      if (rowNumber < 2 || rowNumber > lastRow) continue;

      var rIdx = rowNumber - 2;
      var namaSiswa = String(dataAll[rIdx][1] || "").trim();
      var kelasSiswa = String(dataAll[rIdx][2] || "").trim();

      if (it.expectedNama && namaSiswa.toLowerCase() !== String(it.expectedNama).trim().toLowerCase()) {
        continue;
      }

      var oldStatus = normalizeStatus(dataAll[rIdx][targetCol - 1]);
      var newStatus = normalizeStatus(it.status);

      if (oldStatus.toLowerCase() !== newStatus.toLowerCase()) {
        dataAll[rIdx][targetCol - 1] = newStatus;
        modifiedRows[rIdx] = true;

        syncItems.push({
          nama: namaSiswa,
          ekstra: "Taekwondo",
          kelas: kelasSiswa,
          status: newStatus,
          oldStatus: oldStatus
        });

        if (newStatus.toLowerCase() !== 'belum') {
          logItems.push({
            nama: namaSiswa,
            kelas: kelasSiswa,
            ekstra: "Taekwondo",
            status: newStatus,
            keterangan: "Latihan Tambahan Taekwondo"
          });
        }
      }
    }

    // Flush ke sheet Latihan Tambahan
    var modKeys = Object.keys(modifiedRows);
    if (modKeys.length > 0) {
      if (modKeys.length > 5 || modKeys.length === dataAll.length) {
        var colValues = [];
        for (var i = 0; i < dataAll.length; i++) {
          colValues.push([dataAll[i][targetCol - 1]]);
        }
        sheet.getRange(2, targetCol, colValues.length, 1).setValues(colValues);
      } else {
        for (var m = 0; m < modKeys.length; m++) {
          var idxM = parseInt(modKeys[m], 10);
          sheet.getRange(idxM + 2, targetCol).setValue(dataAll[idxM][targetCol - 1]);
        }
      }
    }

    // Sync ke Rekap & Log
    if (syncItems.length > 0) {
      syncToRekapitulasiBatch(syncItems);
    }
    if (logItems.length > 0) {
      logAbsensiBatch(logItems, "Latihan Tambahan Taekwondo");
    }

    return { success: true, count: modKeys.length };
  } catch (err) {
    Logger.log("Error updateAbsensiLatihanTambahanBatch: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

// Wrapper backward compatibility
function updateAbsensiLatihanTambahan(rowId, status, tanggalStr) {
  return updateAbsensiLatihanTambahanBatch([{
    rowId: rowId,
    status: status
  }], tanggalStr);
}

// ============================================================
// 11. REQUEST BARANG
// ============================================================
function simpanRequestBarang(payload) {
  try {
    var ss = getSpreadsheetSafely();
    var sheet = ss.getSheetByName("Request_Barang");
    if (!sheet) {
      sheet = ss.insertSheet("Request_Barang");
      sheet.appendRow(["Timestamp", "Ekstra", "Pengajar", "Nama Barang", "Jumlah", "Keterangan", "Status"]);
      sheet.getRange(1, 1, 1, 7).setFontWeight("bold").setBackground("#f3f3f3");
      sheet.setFrozenRows(1);
    }

    var timestamp = getNowTimestampStr();

    sheet.appendRow([
      timestamp,
      payload.ekstra ? String(payload.ekstra).trim() : "",
      payload.pengajar ? String(payload.pengajar).trim() : "",
      payload.namaBarang ? String(payload.namaBarang).trim() : "",
      payload.jumlahBarang ? String(payload.jumlahBarang).trim() : "",
      payload.keterangan ? String(payload.keterangan).trim() : "",
      "Menunggu"
    ]);

    return { success: true };
  } catch (e) {
    Logger.log("Error simpanRequestBarang: " + e.toString());
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// 12. FITUR BARU A: RIWAYAT ABSENSI PER SISWA (30 HARI TERAKHIR)
// ============================================================
function getRiwayatSiswa(nama, ekstra, jumlahHari) {
  try {
    if (!nama) return { success: false, message: "Nama siswa tidak boleh kosong" };

    var limitHari = safeInt(jumlahHari, 30);
    var ss = getSpreadsheetSafely();
    var sheet = ss.getSheetByName("Log_Absensi");
    if (!sheet) return { success: true, nama: nama, ekstra: ekstra, riwayat: [] };

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2 || lastCol < 7) {
      return { success: true, nama: nama, ekstra: ekstra, riwayat: [] };
    }

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    var nTarget = String(nama).trim().toLowerCase();
    var eTarget = ekstra ? normalisasiNamaEkstra(ekstra).toLowerCase() : "";

    // Cari baris siswa
    var targetRowIdx = -1;
    for (var i = 0; i < data.length; i++) {
      var n = String(data[i][2] || "").trim().toLowerCase();
      var e = normalisasiNamaEkstra(data[i][4]).toLowerCase();

      if (n === nTarget) {
        if (!eTarget || e === eTarget) {
          targetRowIdx = i;
          break;
        }
      }
    }

    if (targetRowIdx === -1) {
      return { success: true, nama: nama, ekstra: ekstra, riwayat: [] };
    }

    var rowValues = data[targetRowIdx];
    var riwayatList = [];

    // Ambil tanggal mulai kolom H (index 7) ke kanan
    for (var c = 7; c < headers.length; c++) {
      var hVal = headers[c];
      var dateStr = (hVal instanceof Date)
        ? Utilities.formatDate(hVal, TZ, "yyyy-MM-dd")
        : String(hVal || "").trim();

      if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        var status = String(rowValues[c] || "").trim();
        riwayatList.push({
          tanggal: dateStr,
          status: status || "Belum"
        });
      }
    }

    // Urutkan tanggal terbaru di atas
    riwayatList.sort(function(a, b) {
      return b.tanggal.localeCompare(a.tanggal);
    });

    if (riwayatList.length > limitHari) {
      riwayatList = riwayatList.slice(0, limitHari);
    }

    return {
      success: true,
      nama: nama,
      kelas: rowValues[3] || "-",
      ekstra: rowValues[4] || ekstra,
      riwayat: riwayatList
    };
  } catch (err) {
    Logger.log("Error getRiwayatSiswa: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

// ============================================================
// 13. FITUR BARU B: EXPORT REKAP ABSENSI HARIAN KE PDF
// ============================================================
function exportRekapHarianKePDF(namaEkstraSelected, tanggalStr, saveToDrive) {
  try {
    if (!namaEkstraSelected) {
      return { success: false, message: "Pilih ekstrakulikuler terlebih dahulu" };
    }

    var tgl = tanggalStr ? String(tanggalStr).trim() : getTodayStr();
    var cleanTanggal = escapeHtml(tgl);

    // Ambil data siswa & pengajar
    var ekstraData = getDataEkstra(namaEkstraSelected);
    var students = ekstraData.students || [];
    var pengajar = ekstraData.pengajar || "-";

    if (students.length === 0) {
      return { success: false, message: "Tidak ada siswa di ekstra ini." };
    }

    // Hitung ringkasan
    var hadir = 0, izin = 0, sakit = 0, alfa = 0, belum = 0;
    var rowsHtml = "";

    for (var i = 0; i < students.length; i++) {
      var s = students[i];
      var st = (s.status || "Belum").toLowerCase();
      if (st === "hadir") hadir++;
      else if (st === "izin") izin++;
      else if (st === "sakit") sakit++;
      else if (st === "alfa") alfa++;
      else belum++;

      var badgeColor = "#64748b";
      if (st === "hadir") badgeColor = "#16a34a";
      else if (st === "izin") badgeColor = "#ca8a04";
      else if (st === "sakit") badgeColor = "#0284c7";
      else if (st === "alfa") badgeColor = "#dc2626";

      rowsHtml += "<tr>" +
        "<td style='text-align:center;'>" + (i + 1) + "</td>" +
        "<td><strong>" + escapeHtml(s.nama) + "</strong></td>" +
        "<td style='text-align:center;'>" + escapeHtml(s.kelas) + "</td>" +
        "<td style='text-align:center;'>" + escapeHtml(s.kamar || "-") + "</td>" +
        "<td style='text-align:center;'><span style='font-weight:bold; color:" + badgeColor + ";'>" + escapeHtml(s.status) + "</span></td>" +
        "<td style='text-align:center;'>" + escapeHtml(s.nilai || "-") + "</td>" +
        "</tr>";
    }

    var htmlContent = "<!DOCTYPE html>" +
      "<html><head><meta charset='UTF-8'>" +
      "<style>" +
      "body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 20px; }" +
      ".header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }" +
      ".header h1 { font-size: 16px; margin: 0 0 4px 0; color: #0f172a; }" +
      ".header h2 { font-size: 13px; margin: 0 0 6px 0; color: #2563eb; font-weight: 600; }" +
      ".meta { display: flex; justify-content: space-between; margin-bottom: 14px; font-size: 11px; }" +
      ".stats-bar { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; text-align: center; font-size: 11px; }" +
      ".stats-bar span { margin: 0 10px; font-weight: bold; }" +
      "table { width: 100%; border-collapse: collapse; margin-top: 8px; }" +
      "th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }" +
      "th { background-color: #f1f5f9; text-align: center; font-weight: 700; color: #0f172a; font-size: 10px; text-transform: uppercase; }" +
      "tr:nth-child(even) td { background-color: #f8fafc; }" +
      ".ttd-box { width: 220px; text-align: center; float: right; margin-top: 25px; }" +
      "</style>" +
      "</head><body>" +
      "<div class='header'>" +
      "<h1>LAPORAN REKAPITULASI PRESENSI HARIAN SEP</h1>" +
      "<h2>SMA PROGRESIF BUMI SHALAWAT</h2>" +
      "</div>" +
      "<div class='meta'>" +
      "<div><strong>Ekstrakulikuler:</strong> " + escapeHtml(namaEkstraSelected) + " | <strong>Pembina:</strong> " + escapeHtml(pengajar) + "</div>" +
      "<div><strong>Tanggal:</strong> " + cleanTanggal + "</div>" +
      "</div>" +
      "<div class='stats-bar'>" +
      "<span>Total: " + students.length + "</span> | " +
      "<span style='color:#16a34a;'>Hadir: " + hadir + "</span> | " +
      "<span style='color:#ca8a04;'>Izin: " + izin + "</span> | " +
      "<span style='color:#0284c7;'>Sakit: " + sakit + "</span> | " +
      "<span style='color:#dc2626;'>Alfa: " + alfa + "</span> | " +
      "<span style='color:#64748b;'>Belum: " + belum + "</span>" +
      "</div>" +
      "<table>" +
      "<thead><tr>" +
      "<th style='width: 35px;'>No</th>" +
      "<th>Nama Lengkap Siswa</th>" +
      "<th style='width: 90px;'>Kelas</th>" +
      "<th style='width: 90px;'>Kamar</th>" +
      "<th style='width: 90px;'>Kehadiran</th>" +
      "<th style='width: 60px;'>Nilai</th>" +
      "</tr></thead>" +
      "<tbody>" + rowsHtml + "</tbody>" +
      "</table>" +
      "<div class='ttd-box'>" +
      "<p>Sidoarjo, " + cleanTanggal + "<br>Pembina / Pengajar,</p>" +
      "<br><br><br>" +
      "<p><strong>(" + escapeHtml(pengajar) + ")</strong></p>" +
      "</div>" +
      "</body></html>";

    var pdfBlob = Utilities.newBlob(htmlContent, 'text/html', 'rekap.html').getAs('application/pdf');
    var fileName = "Rekap_Presensi_" + namaEkstraSelected.replace(/[^a-zA-Z0-9]/g, '_') + "_" + cleanTanggal.replace(/[^a-zA-Z0-9]/g, '_') + ".pdf";
    pdfBlob.setName(fileName);

    var base64Data = Utilities.base64Encode(pdfBlob.getBytes());
    var fileUrl = null;

    if (saveToDrive === true) {
      try {
        var folderName = "Rekap_Presensi_Harian_PDF";
        var folders = DriveApp.getFoldersByName(folderName);
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
        var pdfFile = folder.createFile(pdfBlob);
        fileUrl = pdfFile.getUrl();
      } catch (driveErr) {
        Logger.log("Drive save skipped/error: " + driveErr.toString());
      }
    }

    return {
      success: true,
      namaFile: fileName,
      base64: base64Data,
      url: fileUrl
    };
  } catch (err) {
    Logger.log("Error exportRekapHarianKePDF: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

// ============================================================
// 12. MODUL PENILAIAN RAPOT (SEMESTER GANJIL)
// ============================================================

/**
 * Konversi nilai angka ke predikat dan deskripsi capaian kompetensi
 */
function konversiNilaiRapot(nilai) {
  var n = parseFloat(nilai);
  if (isNaN(n) || n === null || n === undefined || String(nilai).trim() === "") {
    return { predikat: "-", deskripsi: "-" };
  }

  // 1. Penentuan Predikat Huruf
  var predikat = "C";
  if (n >= 91.6) {
    predikat = "A";
  } else if (n >= 83.4) {
    predikat = "A-";
  } else if (n >= 75.1) {
    predikat = "B+";
  } else if (n >= 66.6) {
    predikat = "B";
  } else if (n >= 58.4) {
    predikat = "B-";
  } else {
    predikat = "C";
  }

  // 2. Penentuan Deskripsi Capaian Rapot
  var deskripsi = "Perlu pendampingan dalam meningkatkan kompetensi yang diajarkan";
  if (n > 87.0) {
    deskripsi = "Mengikuti kompetensi dan performasi yang diajarkan dengan sangat baik";
  } else if (n >= 74.0) {
    deskripsi = "Mengikuti kompetensi dan performasi yang diajarkan dengan baik";
  } else if (n >= 60.0) {
    deskripsi = "Mengikuti kompetensi dan performasi yang diajarkan dengan cukup";
  }

  return { predikat: predikat, deskripsi: deskripsi };
}

/**
 * Inisialisasi sheet 'Nilai_Rapot' jika belum tersedia di Spreadsheet
 */
function getOrCreateSheetNilaiRapot(ss) {
  var spreadsheet = ss || getSpreadsheetSafely();
  var sheet = getSheetCaseInsensitive(spreadsheet, "Nilai_Rapot");

  if (!sheet) {
    sheet = spreadsheet.insertSheet("Nilai_Rapot");
    var headers = ["TIMESTAMP", "NAMA", "KELAS", "JK", "SEP", "NILAI", "PREDIKAT", "KETERANGAN"];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Format header rapi
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#1e293b");
    headerRange.setFontColor("#f8fafc");
    headerRange.setFontWeight("bold");
    headerRange.setHorizontalAlignment("center");
    sheet.setFrozenRows(1);

    // Auto set column widths yang pas
    sheet.setColumnWidth(1, 160); // Timestamp
    sheet.setColumnWidth(2, 240); // Nama
    sheet.setColumnWidth(3, 160); // Kelas
    sheet.setColumnWidth(4, 50);  // JK
    sheet.setColumnWidth(5, 140); // SEP
    sheet.setColumnWidth(6, 75);  // Nilai
    sheet.setColumnWidth(7, 85);  // Predikat
    sheet.setColumnWidth(8, 420); // Keterangan
  }

  return sheet;
}

/**
 * Mengambil data nilai rapot per ekstrakurikuler
 * Jika siswa belum punya nilai di 'Nilai_Rapot', ditarik dari 'Data_Siswa'
 */
function getDataNilaiRapotEkstra(namaEkstraSelected) {
  try {
    var ss = getSpreadsheetSafely();
    if (!ss) return { success: false, message: "Spreadsheet database tidak ditemukan. Periksa ID spreadsheet.", students: [] };

    var sheetRapot = getOrCreateSheetNilaiRapot(ss);
    var cleanSelected = String(namaEkstraSelected || "").replace(/\u00A0/g, ' ').trim();
    if (!cleanSelected) return { success: false, message: "Pilih ekstrakulikuler terlebih dahulu.", students: [] };

    var match = cleanSelected.match(/^(.*?)(?:\s*\(\s*(Putra|Putri)\s*\))?$/i);
    var namaEkstraOnly = match && match[1]
      ? normalisasiNamaEkstra(match[1]).toLowerCase()
      : normalisasiNamaEkstra(cleanSelected).toLowerCase();

    // 1. Baca data yang sudah ada di Nilai_Rapot (Mapping per nama_lowercase)
    var mapRapot = {};
    var lastRowRapot = sheetRapot.getLastRow();
    var lastColRapot = sheetRapot.getLastColumn();
    if (lastRowRapot >= 2 && lastColRapot >= 5) {
      var numColsRapot = Math.min(lastColRapot, 8);
      var dataR = sheetRapot.getRange(2, 1, lastRowRapot - 1, numColsRapot).getValues();
      for (var r = 0; r < dataR.length; r++) {
        var rNama = String(dataR[r][1] || "").trim();
        var rEkstra = normalisasiNamaEkstra(dataR[r][4]).toLowerCase();
        if (!rNama) continue;
        
        var key = rNama.toLowerCase() + "_" + rEkstra;
        mapRapot[key] = {
          rowNumber: r + 2,
          nilai: (numColsRapot >= 6 && dataR[r][5] !== "" && dataR[r][5] !== undefined) ? dataR[r][5] : "",
          predikat: (numColsRapot >= 7 ? dataR[r][6] : "") || "",
          deskripsi: (numColsRapot >= 8 ? dataR[r][7] : "") || ""
        };
      }
    }

    // 2. Kumpulkan daftar siswa menggunakan helper bersama getSiswaByEkstraDanGender
    var baseStudents = getSiswaByEkstraDanGender(cleanSelected);
    var listSiswa = [];

    for (var i = 0; i < baseStudents.length; i++) {
      var s = baseStudents[i];
      var keyFind = s.nama.toLowerCase() + "_" + namaEkstraOnly;
      var curNilai = "";
      var curPredikat = "-";
      var curDeskripsi = "-";

      if (mapRapot[keyFind] && mapRapot[keyFind].nilai !== "") {
        curNilai = mapRapot[keyFind].nilai;
        var konv = konversiNilaiRapot(curNilai);
        curPredikat = konv.predikat;
        curDeskripsi = konv.deskripsi;
      } else if (s.nilai !== "") {
        // Fallback jika pernah tersimpan di Data_Siswa kolom F
        curNilai = s.nilai;
        var konv2 = konversiNilaiRapot(curNilai);
        curPredikat = konv2.predikat;
        curDeskripsi = konv2.deskripsi;
      }

      listSiswa.push({
        rowId: s.rowId,
        nama: s.nama,
        kelas: s.kelas,
        gender: s.gender,
        ekstra: cleanSelected,
        nilai: curNilai,
        predikat: curPredikat,
        deskripsi: curDeskripsi
      });
    }

    return {
      success: true,
      ekstra: cleanSelected,
      count: listSiswa.length,
      students: listSiswa
    };
  } catch (err) {
    Logger.log("Error getDataNilaiRapotEkstra: " + err.toString());
    return { success: false, message: "Error backend: " + (err.message || err.toString()), students: [] };
  }
}

function simpanNilaiRapotBatch(items) {
  try {
    if (!items || !items.length) {
      return { success: false, message: "Tidak ada data nilai yang dikirim." };
    }

    var ss = getSpreadsheetSafely();
    var sheet = getOrCreateSheetNilaiRapot(ss);
    var nowTimestamp = getNowTimestampStr();

    var lastRow = sheet.getLastRow();
    var existingMap = {}; // key: "nama_lowercase_ekstra_lowercase" => rowIndex (1-based)

    if (lastRow >= 2) {
      var existingData = sheet.getRange(2, 2, lastRow - 1, 4).getValues(); // Kolom B-E: NAMA, KELAS, JK, SEP
      for (var r = 0; r < existingData.length; r++) {
        var exNama = String(existingData[r][0] || "").trim().toLowerCase();
        var exSep = normalisasiNamaEkstra(existingData[r][3]).toLowerCase();
        if (exNama) {
          existingMap[exNama + "_" + exSep] = r + 2;
        }
      }
    }

    var rowsToAppend = [];
    var updatedCount = 0;

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var nama = String(it.nama || "").trim();
      var kelas = String(it.kelas || "").trim();
      var jk = String(it.gender || "").trim();
      var ekstra = String(it.ekstra || "").trim();
      var ekstraOnly = normalisasiNamaEkstra(ekstra).toLowerCase();
      var nilai = it.nilai !== undefined && it.nilai !== null ? String(it.nilai).trim() : "";

      if (!nama) continue;

      var konv = konversiNilaiRapot(nilai);
      var predikat = konv.predikat;
      var deskripsi = konv.deskripsi;

      var key = nama.toLowerCase() + "_" + ekstraOnly;
      var existingRow = existingMap[key];

      if (existingRow) {
        // Baris sudah ada -> langsung update kolom TIMESTAMP, NILAI, PREDIKAT, KETERANGAN
        sheet.getRange(existingRow, 1).setValue(nowTimestamp);
        sheet.getRange(existingRow, 6, 1, 3).setValues([[
          nilai !== "" ? parseFloat(nilai) || nilai : "",
          predikat,
          deskripsi
        ]]);
        updatedCount++;
      } else {
        // Baris baru -> siapkan untuk append batch
        rowsToAppend.push([
          nowTimestamp,
          nama,
          kelas,
          jk,
          ekstra,
          nilai !== "" ? parseFloat(nilai) || nilai : "",
          predikat,
          deskripsi
        ]);
      }
    }

    // Append baris baru sekaligus
    if (rowsToAppend.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToAppend.length, 8).setValues(rowsToAppend);
    }

    return {
      success: true,
      message: "Berhasil menyimpan " + (updatedCount + rowsToAppend.length) + " nilai siswa ke sheet Nilai_Rapot."
    };
  } catch (err) {
    Logger.log("Error simpanNilaiRapotBatch: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

// ============================================================
// 13. KLAIM / MUTASI SISWA ANTAR EKSTRAKURIKULER
// ============================================================

/**
 * Mengambil daftar ringkas seluruh siswa aktif di sekolah dari sheet 'Data_Siswa'
 * untuk keperluan pencarian saat guru ingin mengklaim siswa ke ekstranya
 */
function getSemuaSiswaMaster() {
  try {
    var ss = getSpreadsheetSafely();
    var sheet = getSheetCaseInsensitive(ss, "Data_Siswa");
    if (!sheet || sheet.getLastRow() < 2) return [];

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    var totalCols = sheet.getLastColumn();
    var numCols = Math.max(4, Math.min(totalCols, 4));
    var endRow = Math.min(lastRow, 900);
    var data = sheet.getRange(2, 1, endRow - 1, numCols).getValues(); // Kolom A: Nama, B: Ekstra, C: Kelas, D: JK

    var list = [];
    for (var i = 0; i < data.length; i++) {
      var nama = String(data[i][0] || "").replace(/\u00A0/g, ' ').trim();
      var ekstra = String(data[i][1] || "").replace(/\u00A0/g, ' ').trim();
      var kelas = String(data[i][2] || "").replace(/\u00A0/g, ' ').trim();
      var rawJk = String(data[i][3] || "").replace(/\u00A0/g, ' ').trim();

      if (!nama || nama.toLowerCase() === "nama") continue;

      var g = normalisasiGender(rawJk);
      if (!g) {
        var mG = ekstra.match(/\((Putra|Putri)\)/i);
        if (mG) g = normalisasiGender(mG[1]);
      }
      if (!g) g = inferGenderFromKelas(kelas);
      var jkDisplay = g === "l" ? "Putra" : (g === "p" ? "Putri" : (rawJk || "-"));

      list.push({
        rowId: i + 2,
        nama: nama,
        ekstraLama: ekstra || "Belum Ada",
        kelas: kelas,
        jk: jkDisplay
      });
    }

    list.sort(function(a, b) {
      return a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' });
    });

    return list;
  } catch (err) {
    Logger.log("Error getSemuaSiswaMaster: " + err.toString());
    return [];
  }
}

function klaimSiswaKeEkstra(rowId, namaExpected, ekstraBaru) {
  try {
    var ss = getSpreadsheetSafely();
    var sheet = getSheetCaseInsensitive(ss, "Data_Siswa");
    if (!sheet) return { success: false, message: "Sheet Data_Siswa tidak ditemukan" };

    var rId = safeInt(rowId, -1);
    if (rId < 2 || rId > sheet.getLastRow()) {
      return { success: false, message: "Baris data siswa tidak valid!" };
    }

    // Validasi nama siswa untuk keamanan agar tidak salah baris
    var namaAktual = String(sheet.getRange(rId, 1).getValue() || "").trim();
    if (namaExpected && namaAktual.toLowerCase() !== String(namaExpected).trim().toLowerCase()) {
      return { success: false, message: "Data telah bergeser. Silakan ulangi pencarian." };
    }

    var ekstraLama = String(sheet.getRange(rId, 2).getValue() || "").trim();
    var kelasSiswa = String(sheet.getRange(rId, 3).getValue() || "").trim();
    var cleanEkstraBaru = String(ekstraBaru || "").trim();
    var cleanEkstraBaruNormalized = normalisasiNamaEkstra(cleanEkstraBaru);

    // Update langsung kolom Ekstra (Kolom B / 2) di Data_Siswa
    sheet.getRange(rId, 2).setValue(cleanEkstraBaruNormalized);

    // Invalidate cache untuk ekstra lama & baru agar data instan ter-refresh
    invalidateCacheEkstra(normalisasiNamaEkstra(ekstraLama).toLowerCase());
    invalidateCacheEkstra(cleanEkstraBaruNormalized.toLowerCase());

    // Catat log mutasi siswa (Audit Trail)
    try {
      var logSheet = ss.getSheetByName("Log_Mutasi_Siswa");
      if (!logSheet) {
        logSheet = ss.insertSheet("Log_Mutasi_Siswa");
        var headers = ["TIMESTAMP", "NAMA SISWA", "KELAS", "EKSTRA ASAL", "EKSTRA BARU", "KETERANGAN"];
        logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        var hr = logSheet.getRange(1, 1, 1, headers.length);
        hr.setBackground("#1e293b").setFontColor("#f8fafc").setFontWeight("bold");
        logSheet.setFrozenRows(1);
      }
      logSheet.appendRow([
        getNowTimestampStr(),
        namaAktual,
        kelasSiswa,
        ekstraLama || "-",
        cleanEkstraBaruNormalized,
        "Diklaim manual oleh guru dari Web App"
      ]);
    } catch (logErr) {
      Logger.log("Audit log mutasi skipped: " + logErr.toString());
    }

    return {
      success: true,
      message: "Siswa " + namaAktual + " berhasil dipindahkan dari " + (ekstraLama || "-") + " ke " + cleanEkstraBaruNormalized + "!"
    };
  } catch (err) {
    Logger.log("Error klaimSiswaKeEkstra: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

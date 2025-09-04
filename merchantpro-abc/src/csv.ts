import fs from "fs";
import path from "path";

export function ensureDataDir() {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
  return dir;
}

export function writeCSV(filename: string, rows: Array<Record<string, any>>) {
  const dir = ensureDataDir();
  const file = path.join(dir, filename);

  if (!rows || rows.length === 0) {
    fs.writeFileSync(file, "");
    return file;
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map(r =>
      headers.map(h => {
        const v = r[h] ?? "";
        // escape CSV
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
      }).join(",")
    )
  ];
  fs.writeFileSync(file, lines.join("\n"));
  return file;
}

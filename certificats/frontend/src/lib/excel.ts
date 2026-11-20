import { getAddress, isAddress } from "viem";
import * as XLSX from "xlsx";
import type { ParsedRow, ParseResult } from "@/lib/certificates";

const HEADER_ALIASES: Record<string, keyof ParsedRow | "recipientAddress"> = {
  studentname: "studentName",
  nom: "studentName",
  nomcomplet: "studentName",
  name: "studentName",
  etudiant: "studentName",
  studentid: "studentId",
  cne: "studentId",
  identifiant: "studentId",
  identifiantetudiant: "studentId",
  matricule: "studentId",
  id: "studentId",
  diplomattitle: "diplomaTitle",
  diploma: "diplomaTitle",
  diplome: "diplomaTitle",
  intitule: "diplomaTitle",
  intitulediplome: "diplomaTitle",
  intituledudiplome: "diplomaTitle",
  nomdiplome: "diplomaTitle",
  diplomeobtenu: "diplomaTitle",
  formation: "diplomaTitle",
  titre: "diplomaTitle",
  issuedate: "issueDate",
  datedemission: "issueDate",
  dateemission: "issueDate",
  date: "issueDate",
  recipientaddress: "recipientAddress",
  adresse: "recipientAddress",
  wallet: "recipientAddress",
  address: "recipientAddress",
  grade: "grade",
  mention: "grade",
  note: "grade",
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function toISODate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toISODate(value);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return toISODate(parsed);
  return raw;
}

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && toISODate(date) === value;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeAddress(value: string): { address: `0x${string}` | ""; valid: boolean } {
  const raw = value.trim();
  if (!raw) return { address: "", valid: true };
  if (!isAddress(raw, { strict: false })) return { address: "", valid: false };
  try {
    return { address: getAddress(raw.toLowerCase()), valid: true };
  } catch {
    return { address: "", valid: false };
  }
}

export function parseCertificateWorkbook(buffer: ArrayBuffer, fileName: string): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Le classeur ne contient aucune feuille.");

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    throw new Error("La première feuille est vide. Vérifiez le fichier et l'en-tête des colonnes.");
  }

  const headerMap = new Map<string, string>();
  for (const key of Object.keys(rawRows[0] ?? {})) {
    const mapped = HEADER_ALIASES[normalizeHeader(key)];
    if (mapped) headerMap.set(key, mapped);
  }

  if (![...headerMap.values()].includes("studentName")) {
    throw new Error(
      `Colonnes introuvables. En-têtes lus : ${Object.keys(rawRows[0] ?? {}).join(", ")}. ` +
        "Le fichier doit contenir au minimum studentName, studentId, diplomaTitle et issueDate.",
    );
  }

  const seenIds = new Map<string, number>();
  const rows: ParsedRow[] = [];

  rawRows.forEach((rawRow, index) => {
    const record: Record<string, string> = {
      studentName: "",
      studentId: "",
      diplomaTitle: "",
      issueDate: "",
      recipientAddress: "",
      grade: "",
    };

    for (const [key, mapped] of headerMap) {
      record[mapped] = text(rawRow[key]);
    }

    const isEmpty = Object.values(record).every((value) => value === "");
    if (isEmpty) return;

    const studentId = record.studentId.trim().toUpperCase();
    const issueDate = normalizeDate(record.issueDate);
    const address = normalizeAddress(record.recipientAddress);
    const errors: string[] = [];

    if (!record.studentName) errors.push("Nom de l'étudiant manquant.");
    if (!studentId) errors.push("Identifiant étudiant manquant.");
    if (!issueDate) errors.push("Date d'émission manquante.");
    else if (!isValidISODate(issueDate)) errors.push(`Date invalide « ${issueDate} » (format attendu : AAAA-MM-JJ).`);
    if (!address.valid) errors.push(`Adresse wallet invalide « ${record.recipientAddress} ».`);

    if (studentId) {
      const firstRow = seenIds.get(studentId);
      if (firstRow !== undefined) {
        errors.push(`Doublon dans le fichier : identifiant déjà utilisé ligne ${firstRow}.`);
      } else {
        seenIds.set(studentId, index + 2);
      }
    }

    rows.push({
      rowNumber: index + 2,
      studentName: record.studentName,
      studentId,
      diplomaTitle: record.diplomaTitle || "Diplôme académique",
      issueDate,
      recipientAddress: address.address,
      grade: record.grade,
      errors,
      selected: errors.length === 0,
    });
  });

  if (rows.length === 0) {
    throw new Error("Aucune ligne exploitable trouvée dans la feuille.");
  }

  return { rows, sheetName, fileName };
}

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

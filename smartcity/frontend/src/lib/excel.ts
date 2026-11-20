import * as XLSX from "xlsx";
import {
  PRIORITY_NAMES,
  STATUS_NAMES,
  type ParseResult,
  type ParsedRow,
} from "@/lib/issues";

const HEADER_ALIASES: Record<string, keyof ParsedRow | "rawPriority" | "rawStatus"> = {
  issueid: "issueId",
  id: "issueId",
  identifiant: "issueId",
  identifiantsignalement: "issueId",
  issuetype: "issueType",
  type: "issueType",
  typesignalement: "issueType",
  location: "location",
  lieu: "location",
  localisation: "location",
  adresse: "location",
  description: "description",
  datedescription: "description",
  reportdate: "reportDate",
  date: "reportDate",
  datesignalement: "reportDate",
  priority: "rawPriority",
  priorite: "rawPriority",
  niveau: "rawPriority",
  reportedby: "reportedBy",
  citizen: "reportedBy",
  citoyen: "reportedBy",
  declarepar: "reportedBy",
  assignedto: "assignedTo",
  team: "assignedTo",
  equipe: "assignedTo",
  affectea: "assignedTo",
  statut: "rawStatus",
  status: "rawStatus",
};

const PRIORITY_VALUES: Record<string, number> = {
  low: 0,
  faible: 0,
  medium: 1,
  moyenne: 1,
  high: 2,
  haute: 2,
  critical: 3,
  critique: 3,
};

const STATUS_VALUES: Record<string, number> = {
  reported: 0,
  signale: 0,
  assigned: 1,
  affecte: 1,
  inprogress: 2,
  encours: 2,
  resolved: 3,
  resolu: 3,
  closed: 4,
  cloture: 4,
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function toISODate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toISODate(value);

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const raw = text(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const dmy = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return toISODate(parsed);
  return raw;
}

function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && toISODate(date) === value;
}

export function parseIssueWorkbook(buffer: ArrayBuffer, fileName: string): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Le classeur ne contient aucune feuille.");

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rawRows.length === 0) {
    throw new Error("La première feuille est vide. Vérifiez l'en-tête des colonnes.");
  }

  const headerMap = new Map<string, string>();
  for (const key of Object.keys(rawRows[0] ?? {})) {
    const mapped = HEADER_ALIASES[normalize(key)];
    if (mapped) headerMap.set(key, mapped);
  }

  if (![...headerMap.values()].includes("issueId")) {
    throw new Error(
      `Colonne issueId introuvable. En-têtes lus : ${Object.keys(rawRows[0] ?? {}).join(", ")}.`,
    );
  }

  const seenIds = new Map<string, number>();
  const rows: ParsedRow[] = [];

  rawRows.forEach((rawRow, index) => {
    const record: Record<string, string> = {
      issueId: "",
      issueType: "",
      location: "",
      description: "",
      reportDate: "",
      rawPriority: "",
      reportedBy: "",
      assignedTo: "",
      rawStatus: "",
    };

    for (const [key, mapped] of headerMap) {
      record[mapped] = text(rawRow[key]);
    }

    if (Object.values(record).every((value) => value === "")) return;

    const issueId = record.issueId.toUpperCase();
    const reportDate = normalizeDate(record.reportDate);
    const priorityKey = normalize(record.rawPriority);
    const statusKey = normalize(record.rawStatus);
    const priority = PRIORITY_VALUES[priorityKey] ?? -1;
    const status = STATUS_VALUES[statusKey] ?? -1;
    const errors: string[] = [];

    if (!issueId) errors.push("Identifiant manquant.");
    if (!record.issueType) errors.push("Type de signalement manquant.");
    if (!record.location) errors.push("Localisation manquante.");
    if (!record.description) errors.push("Description manquante.");
    if (!reportDate) errors.push("Date de signalement manquante.");
    else if (!isValidISODate(reportDate)) {
      errors.push(`Date invalide « ${reportDate} » (format attendu : AAAA-MM-JJ).`);
    }
    if (!record.reportedBy) errors.push("Pseudonyme du déclarant manquant.");
    if (priority < 0) {
      errors.push(`Priorité invalide « ${record.rawPriority} » (${PRIORITY_NAMES.join(", ")}).`);
    }
    if (status < 0) {
      errors.push(`Statut invalide « ${record.rawStatus} » (${STATUS_NAMES.join(", ")}).`);
    }
    if (status > 0 && !record.assignedTo) {
      errors.push("Une équipe est requise lorsque le statut n'est pas Reported.");
    }

    if (issueId) {
      const firstRow = seenIds.get(issueId);
      if (firstRow !== undefined) {
        errors.push(`Doublon dans le fichier : identifiant déjà utilisé ligne ${firstRow}.`);
      } else {
        seenIds.set(issueId, index + 2);
      }
    }

    rows.push({
      issueId,
      issueType: record.issueType,
      location: record.location,
      description: record.description,
      reportDate,
      priority: priority < 0 ? 1 : priority,
      reportedBy: record.reportedBy,
      assignedTo: record.assignedTo,
      status: status < 0 ? 0 : status,
      rawPriority: record.rawPriority,
      rawStatus: record.rawStatus,
      rowNumber: index + 2,
      errors,
      selected: errors.length === 0,
    });
  });

  if (rows.length === 0) {
    throw new Error("Aucune ligne exploitable trouvée dans la feuille.");
  }

  return { rows, sheetName, fileName };
}

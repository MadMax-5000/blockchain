import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

type IssueRow = {
  issueId: string;
  issueType: string;
  location: string;
  description: string;
  reportDate: string;
  priority: string;
  reportedBy: string;
  assignedTo: string;
  status: string;
};

const HEADERS: (keyof IssueRow)[] = [
  "issueId",
  "issueType",
  "location",
  "description",
  "reportDate",
  "priority",
  "reportedBy",
  "assignedTo",
  "status",
];

const COLUMN_WIDTHS = [
  { wch: 18 },
  { wch: 16 },
  { wch: 32 },
  { wch: 46 },
  { wch: 14 },
  { wch: 12 },
  { wch: 14 },
  { wch: 18 },
  { wch: 14 },
];

const VALIDATION_ROWS: IssueRow[] = [
  {
    issueId: "CITY-2026-201",
    issueType: "StreetLight",
    location: "Avenue Mohammed V, Rabat",
    description: "Lampadaire éteint devant la mairie",
    reportDate: "2026-11-19",
    priority: "High",
    reportedBy: "Citizen201",
    assignedTo: "",
    status: "Reported",
  },
  {
    issueId: "CITY-2026-202",
    issueType: "Road",
    location: "Boulevard Hassan II, Rabat",
    description: "Nid-de-poule sur la voie de droite",
    reportDate: "2026-11-19",
    priority: "Critical",
    reportedBy: "Citizen202",
    assignedTo: "",
    status: "Reported",
  },
  {
    issueId: "CITY-2026-202",
    issueType: "Waste",
    location: "Place du Marché, Salé",
    description: "Doublon volontaire pour tester la validation",
    reportDate: "2026-11-19",
    priority: "Medium",
    reportedBy: "Citizen203",
    assignedTo: "",
    status: "Reported",
  },
  {
    issueId: "CITY-2026-204",
    issueType: "Water",
    location: "Rue des Lilas, Rabat",
    description: "Priorité invalide volontaire",
    reportDate: "2026-11-19",
    priority: "Urgent",
    reportedBy: "Citizen204",
    assignedTo: "",
    status: "Reported",
  },
  {
    issueId: "CITY-2026-205",
    issueType: "Park",
    location: "",
    description: "Localisation manquante volontaire",
    reportDate: "2026-11-19",
    priority: "Low",
    reportedBy: "Citizen205",
    assignedTo: "",
    status: "Reported",
  },
  {
    issueId: "CITY-2026-206",
    issueType: "Traffic",
    location: "Carrefour Moulay Abdellah, Salé",
    description: "Statut invalide volontaire",
    reportDate: "2026-11-19",
    priority: "High",
    reportedBy: "Citizen206",
    assignedTo: "",
    status: "EnCours",
  },
  {
    issueId: "CITY-2026-207",
    issueType: "StreetLight",
    location: "Avenue de la Liberté, Témara",
    description: "Ligne valide après les cas d'erreur",
    reportDate: "2026-11-19",
    priority: "Medium",
    reportedBy: "Citizen207",
    assignedTo: "",
    status: "Reported",
  },
  {
    issueId: "CITY-2026-208",
    issueType: "Waste",
    location: "Corniche de Rabat",
    description: "Date invalide volontaire",
    reportDate: "2026-13-45",
    priority: "Medium",
    reportedBy: "Citizen208",
    assignedTo: "",
    status: "Reported",
  },
  {
    issueId: "CITY-2026-209",
    issueType: "Road",
    location: "Rue de Fès, Rabat",
    description: "",
    reportDate: "2026-11-19",
    priority: "High",
    reportedBy: "Citizen209",
    assignedTo: "",
    status: "Reported",
  },
  {
    issueId: "CITY-2026-210",
    issueType: "Water",
    location: "Rue de Toulouse, Rabat",
    description: "Dernière ligne valide du jeu de test",
    reportDate: "2026-11-19",
    priority: "Low",
    reportedBy: "Citizen210",
    assignedTo: "",
    status: "Reported",
  },
];

const NOTICE = [
  ["Colonne", "Exemple", "Description"],
  ["issueId", "CITY-2026-001", "Identifiant unique du signalement"],
  ["issueType", "StreetLight", "Type de problème urbain"],
  ["location", "Avenue Mohammed V", "Localisation fictive"],
  ["description", "Streetlight not working", "Description courte du problème"],
  ["reportDate", "2026-11-19", "Date AAAA-MM-JJ ou JJ/MM/AAAA"],
  ["priority", "High", "Low, Medium, High ou Critical"],
  ["reportedBy", "Citizen01", "Pseudonyme, jamais de donnée personnelle"],
  ["assignedTo", "UrbanTeam01", "Requis dès que le statut n'est pas Reported"],
  ["status", "Reported", "Reported, Assigned, InProgress, Resolved ou Closed"],
  ["", "", ""],
  [
    "Note",
    "",
    "urban_issues.xlsx contient volontairement des lignes invalides pour démontrer la validation avant signature.",
  ],
];

function writeWorkbook(targetName: string, rows: IssueRow[]): void {
  const root = path.resolve(__dirname, "..", "..");
  const target = path.resolve(root, "data", targetName);
  const publicDir = path.resolve(root, "frontend", "public");
  const publicTarget = path.resolve(publicDir, targetName);

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
  worksheet["!cols"] = COLUMN_WIDTHS;

  const noticeSheet = XLSX.utils.aoa_to_sheet(NOTICE);
  noticeSheet["!cols"] = [{ wch: 18 }, { wch: 30 }, { wch: 68 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "signalements");
  XLSX.utils.book_append_sheet(workbook, noticeSheet, "modele");

  fs.mkdirSync(publicDir, { recursive: true });
  XLSX.writeFile(workbook, target);
  fs.copyFileSync(target, publicTarget);
  console.log(`Fichier Excel généré : data/${targetName} (${rows.length} lignes)`);
}

function main(): void {
  const root = path.resolve(__dirname, "..", "..");
  const importRows = JSON.parse(
    fs.readFileSync(path.resolve(root, "data", "urban_issues-import.json"), "utf8"),
  ) as IssueRow[];

  writeWorkbook("urban_issues.xlsx", VALIDATION_ROWS);
  writeWorkbook("urban_issues-import.xlsx", importRows);
}

main();

import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

type StudentRow = {
  studentName: string;
  studentId: string;
  diplomaTitle: string;
  issueDate: string;
  recipientAddress: string;
  grade: string;
};

const HEADERS: (keyof StudentRow)[] = [
  "studentName",
  "studentId",
  "diplomaTitle",
  "issueDate",
  "recipientAddress",
  "grade",
];

function writeWorkbook(
  sourceName: string,
  targetName: string,
  notice: string[][],
): void {
  const root = path.resolve(__dirname, "..", "..");
  const source = path.resolve(root, "data", sourceName);
  const target = path.resolve(root, "data", targetName);
  const publicTarget = path.resolve(root, "frontend", "public", targetName);

  const data = JSON.parse(fs.readFileSync(source, "utf8")) as StudentRow[];
  const worksheet = XLSX.utils.json_to_sheet(data, { header: HEADERS });
  worksheet["!cols"] = [
    { wch: 28 },
    { wch: 18 },
    { wch: 30 },
    { wch: 14 },
    { wch: 44 },
    { wch: 20 },
  ];

  const noticeSheet = XLSX.utils.aoa_to_sheet(notice);
  noticeSheet["!cols"] = [{ wch: 18 }, { wch: 48 }, { wch: 62 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "etudiants");
  XLSX.utils.book_append_sheet(workbook, noticeSheet, "modele");

  XLSX.writeFile(workbook, target);
  fs.copyFileSync(target, publicTarget);
  console.log(`Fichier Excel généré : data/${targetName} (${data.length} lignes)`);
}

function main(): void {
  writeWorkbook(
    "etudiants.json",
    "etudiants.xlsx",
    [
      ["Colonne", "Exemple", "Description"],
      ["studentName", "Amina Benali", "Nom complet de l'étudiant"],
      ["studentId", "2023-INF-042", "Identifiant unique interne (CNE)"],
      ["diplomaTitle", "Licence Informatique", "Intitulé du diplôme"],
      ["issueDate", "2026-06-15", "Date d'émission (ISO)"],
      ["recipientAddress", "0x7099...79C8", "Adresse wallet du destinataire (optionnel)"],
      ["grade", "Mention Bien", "Mention / note"],
      ["", "", ""],
      [
        "Note",
        "",
        "Les 7 premiers identifiants sont déjà émis par seed:local. La dernière ligne réutilise 2023-INF-042 pour tester le doublon.",
      ],
    ],
  );

  writeWorkbook(
    "etudiants-import.json",
    "etudiants-import.xlsx",
    [
      ["Colonne", "Exemple", "Description"],
      ["studentName", "Léa Martin", "Nom complet de l'étudiant"],
      ["studentId", "2026-DEMO-001", "Identifiant unique interne"],
      ["diplomaTitle", "Licence Informatique", "Intitulé du diplôme"],
      ["issueDate", "2026-11-20", "Date d'émission (ISO)"],
      ["recipientAddress", "0x71bE...5788", "Adresse wallet du destinataire"],
      ["grade", "Mention Bien", "Mention / note"],
      ["", "", ""],
      [
        "Note",
        "",
        "Fichier de démonstration : 5 lignes, 4 nouveaux identifiants émettables et 1 doublon volontaire dans le fichier.",
      ],
    ],
  );
}

main();

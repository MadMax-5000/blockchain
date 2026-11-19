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

function main(): void {
  const source = path.resolve(__dirname, "..", "..", "data", "etudiants.json");
  const target = path.resolve(__dirname, "..", "..", "data", "etudiants.xlsx");

  const rows = JSON.parse(fs.readFileSync(source, "utf8")) as StudentRow[];

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: ["studentName", "studentId", "diplomaTitle", "issueDate", "recipientAddress", "grade"],
  });
  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 16 },
    { wch: 30 },
    { wch: 14 },
    { wch: 44 },
    { wch: 20 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "etudiants");

  const notice = XLSX.utils.aoa_to_sheet([
    ["Colonne", "Exemple", "Description"],
    ["studentName", "Amina Benali", "Nom complet de l'étudiant"],
    ["studentId", "2023-INF-042", "Identifiant unique interne (CNE)"],
    ["diplomaTitle", "Licence Informatique", "Intitulé du diplôme"],
    ["issueDate", "2026-06-15", "Date d'émission (ISO)"],
    ["recipientAddress", "0x7099...79C8", "Adresse wallet du destinataire (optionnel)"],
    ["grade", "Mention Bien", "Mention / note"],
    ["", "", ""],
    ["Note", "", "La dernière ligne réutilise volontairement 2023-INF-042 pour tester la détection de doublon."],
  ]);
  notice["!cols"] = [{ wch: 18 }, { wch: 48 }, { wch: 62 }];
  XLSX.utils.book_append_sheet(workbook, notice, "modele");

  XLSX.writeFile(workbook, target);
  console.log(`Fichier Excel généré : ${target} (${rows.length} lignes)`);
}

main();

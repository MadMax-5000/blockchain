import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TxHash } from "@/components/common/tx-hash";
import { useIssueActions } from "@/hooks/use-actions";
import { useIssues } from "@/hooks/use-issues";
import { useMunicipalRole } from "@/hooks/use-role";
import { getErrorMessage } from "@/lib/errors";
import { parseIssueWorkbook } from "@/lib/excel";
import { priorityLabel, statusLabel, type IssueInput, type ParseResult } from "@/lib/issues";

const MAX_BATCH = 50;

export function ExcelImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParseResult>();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [hash, setHash] = useState<string>();
  const [error, setError] = useState<string>();
  const { batchCreateIssues, isPending } = useIssueActions();
  const { data: onChain } = useIssues();
  const role = useMunicipalRole();

  const rows = useMemo(() => {
    if (!parsed) return [];
    const existing = new Set((onChain ?? []).map((issue) => issue.issueId));
    return parsed.rows.map((row) => {
      const onChainDuplicate = existing.has(row.issueId);
      const errors = onChainDuplicate
        ? [...row.errors, "Identifiant déjà présent on-chain."]
        : row.errors;
      return { ...row, onChainDuplicate, errors, selected: selected.has(row.rowNumber) && errors.length === 0 };
    });
  }, [parsed, onChain, selected]);

  const validRows = rows.filter((row) => row.errors.length === 0);
  const chosen = rows.filter((row) => row.selected && row.errors.length === 0);
  const invalidCount = rows.length - validRows.length;

  async function readFile(file: File) {
    setError(undefined);
    setHash(undefined);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseIssueWorkbook(buffer, file.name);
      setParsed(result);
      setSelected(new Set(result.rows.filter((row) => row.errors.length === 0).map((row) => row.rowNumber)));
      if (result.rows.length > MAX_BATCH) {
        setError(`Le fichier contient ${result.rows.length} lignes : un lot est limité à ${MAX_BATCH}.`);
      }
    } catch (cause) {
      setParsed(undefined);
      setSelected(new Set());
      setError(getErrorMessage(cause));
    }
  }

  function toggleRow(rowNumber: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }

  function toggleAll() {
    setSelected(chosen.length === validRows.length ? new Set() : new Set(validRows.map((row) => row.rowNumber)));
  }

  async function submit() {
    if (chosen.length === 0) {
      toast.error("Sélectionnez au moins une ligne valide.");
      return;
    }
    if (chosen.length > MAX_BATCH) {
      toast.error(`Lot trop volumineux : ${chosen.length} lignes sélectionnées, maximum ${MAX_BATCH}.`);
      return;
    }
    if (!role.isAgent) {
      toast.error("Rôle AGENT_ROLE requis pour importer un lot.");
      return;
    }

    const inputs: IssueInput[] = chosen.map((row) => ({
      issueId: row.issueId,
      issueType: row.issueType,
      location: row.location,
      description: row.description,
      reportDate: row.reportDate,
      priority: row.priority,
      reportedBy: row.reportedBy,
      assignedTo: row.assignedTo,
      status: row.status,
    }));

    try {
      const result = await batchCreateIssues(inputs);
      setHash(result.hash);
      toast.success(result.message);
      setParsed(undefined);
      setSelected(new Set());
      if (fileRef.current) fileRef.current.value = "";
    } catch (cause) {
      toast.error("Échec de l'import", { description: getErrorMessage(cause) });
    }
  }

  return (
    <div className="grid gap-6">
      <section className="panel grid gap-5 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <h2 className="text-[15px] font-semibold">1 · Choisir un classeur</h2>
          <p className="meta mt-1">
            Colonnes attendues : issueId, issueType, location, description, reportDate, priority, reportedBy, assignedTo, status.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readFile(file);
              }}
              className="h-9 max-w-[340px] cursor-pointer text-[13px]"
              aria-label="Fichier Excel ou CSV"
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              Parcourir
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col">
          <Button asChild variant="outline" size="sm">
            <a href="/urban_issues-import.xlsx" download>
              <Download className="h-3.5 w-3.5" />
              Modèle valide (8 lignes)
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href="/urban_issues.xlsx" download>
              <Download className="h-3.5 w-3.5" />
              Jeu de validation (erreurs)
            </a>
          </Button>
        </div>
      </section>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-[13px] text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {parsed ? (
        <>
          <section className="panel grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            <Stat label="Feuille" value={parsed.sheetName} />
            <Stat label="Lignes lues" value={String(rows.length)} />
            <Stat label="Lignes valides" value={String(validRows.length)} tone="ok" />
            <Stat label="Lignes invalides" value={String(invalidCount)} tone={invalidCount ? "bad" : undefined} />
          </section>

          <section className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold">2 · Vérifier et sélectionner</h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Checkbox
                    checked={validRows.length > 0 && chosen.length === validRows.length}
                    onCheckedChange={toggleAll}
                    aria-label="Sélectionner toutes les lignes valides"
                  />
                  Toutes les lignes valides
                </label>
                <span className="mono text-muted-foreground">
                  {chosen.length} / {validRows.length} sélectionnée(s)
                </span>
              </div>
            </div>

            <div className="panel px-4 py-1">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-0" />
                    <TableHead className="w-12">Ligne</TableHead>
                    <TableHead>Identifiant</TableHead>
                    <TableHead>Signalement</TableHead>
                    <TableHead>Priorité</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Contrôle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.rowNumber} className={row.errors.length ? "bg-destructive/5" : undefined}>
                      <TableCell className="pl-0">
                        <Checkbox
                          checked={row.selected}
                          disabled={row.errors.length > 0}
                          onCheckedChange={() => toggleRow(row.rowNumber)}
                          aria-label={`Sélectionner la ligne ${row.rowNumber}`}
                        />
                      </TableCell>
                      <TableCell className="mono text-muted-foreground">{row.rowNumber}</TableCell>
                      <TableCell className="mono">{row.issueId || "—"}</TableCell>
                      <TableCell>
                        <p className="max-w-[320px] truncate text-[13px]">{row.description || "—"}</p>
                        <p className="meta mt-0.5 truncate">{row.location || "localisation manquante"}</p>
                      </TableCell>
                      <TableCell className="text-[13px]">{priorityLabel(row.priority)}</TableCell>
                      <TableCell className="text-[13px]">{statusLabel(row.status)}</TableCell>
                      <TableCell>
                        {row.errors.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-[13px] text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Valide
                          </span>
                        ) : (
                          <span className="flex items-start gap-1 text-[13px] text-red-300">
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{row.errors.join(" ")}</span>
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[15px] font-semibold">3 · Signer l'import</h2>
              <p className="meta mt-1">
                {role.isAgent
                  ? `${chosen.length} signalement(s) seront créés dans une seule transaction.`
                  : "Connectez le compte municipal (AGENT_ROLE) pour signer le lot."}
              </p>
              {hash ? (
                <div className="mt-3">
                  <TxHash hash={hash} />
                </div>
              ) : null}
            </div>
            <Button size="sm" disabled={isPending || chosen.length === 0 || !role.isAgent} onClick={() => void submit()}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
              {isPending ? "Signature en cours…" : `Importer ${chosen.length} ligne(s)`}
            </Button>
          </section>
        </>
      ) : (
        <section className="panel flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <FileSpreadsheet className="h-7 w-7 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-[14px] font-medium">Aucun classeur chargé</p>
          <p className="meta max-w-md">
            Téléchargez le modèle valide pour voir un import réussi, ou le jeu de validation pour observer les erreurs bloquées avant signature.
          </p>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  return (
    <div>
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={`mono mt-2 ${tone === "ok" ? "text-emerald-300" : tone === "bad" ? "text-red-300" : ""}`}>
        {value}
      </p>
    </div>
  );
}

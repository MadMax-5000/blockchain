import { useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TxHash } from "@/components/common/tx-hash";
import { ConnectButton } from "@/components/wallet/connect-button";
import { getAbi, type ContractVersion } from "@/lib/contracts";
import type { CertificateInput, ParsedRow, ParseResult } from "@/lib/certificates";
import { parseCertificateWorkbook } from "@/lib/excel";
import { getErrorMessage } from "@/lib/errors";
import { shortenAddress } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCertificateActions } from "@/hooks/use-actions";
import { useContractAddress } from "@/hooks/use-deployment";
import { useNetwork } from "@/hooks/use-network";
import { useVersion } from "@/hooks/use-version";

/* eslint-disable @typescript-eslint/no-explicit-any */

type EmissionResult = { rows: number[]; hash?: string; error?: string };

type EffectiveRow = ParsedRow & { onChainDuplicate: boolean };

export function ExcelImport() {
  const { version } = useVersion();
  const { address: account, isConnected } = useAccount();
  const { chainId } = useNetwork();
  const { address } = useContractAddress(version);
  const publicClient = usePublicClient({ chainId });
  const { mintBatch } = useCertificateActions();
  const queryClient = useQueryClient();

  const [parse, setParse] = useState<ParseResult | null>(null);
  const [parseError, setParseError] = useState<string>();
  const [deselected, setDeselected] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<"batch" | "sequential">("batch");
  const [chunkSize, setChunkSize] = useState(10);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<EmissionResult[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const duplicateQuery = useQuery<Map<number, boolean>>({
    queryKey: [
      "duplicate-check",
      version,
      chainId,
      address,
      parse?.rows.map((row) => row.studentId).join("|"),
    ],
    enabled: Boolean(publicClient && address && parse && parse.rows.length > 0),
    retry: false,
    queryFn: async () => {
      const abi = getAbi(version) as any;
      const entries = await Promise.all(
        parse!.rows.map(async (row) => {
          if (!row.studentId) return [row.rowNumber, false] as const;
          try {
            const id = (await publicClient!.readContract({
              address: address!,
              abi,
              functionName: version === "v1" ? "certificateIdByStudentId" : "tokenIdByStudentId",
              args: [row.studentId],
            })) as bigint;
            return [row.rowNumber, id !== 0n] as const;
          } catch {
            return [row.rowNumber, false] as const;
          }
        }),
      );
      return new Map(entries);
    },
  });

  const rows: EffectiveRow[] = useMemo(() => {
    return (parse?.rows ?? []).map((row) => {
      const onChainDuplicate = duplicateQuery.data?.get(row.rowNumber) ?? false;
      const errors = onChainDuplicate
        ? ["Identifiant déjà enregistré on-chain.", ...row.errors]
        : [...row.errors];
      if (!row.recipientAddress && !account) {
        errors.push("Adresse destinataire absente (aucun wallet connecté pour servir de défaut).");
      }
      return { ...row, errors, onChainDuplicate };
    });
  }, [parse, duplicateQuery.data, account]);

  const validRows = rows.filter((row) => row.errors.length === 0);
  const selectedRows = validRows.filter((row) => !deselected.has(row.rowNumber));
  const errorCount = rows.length - validRows.length;

  const reset = () => {
    setParse(null);
    setDeselected(new Set());
    setResults([]);
    setProgress(0);
    setParseError(undefined);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setParseError(undefined);
    setResults([]);
    setDeselected(new Set());
    setProgress(0);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Fichier trop volumineux (maximum 5 Mo).");
      const buffer = await file.arrayBuffer();
      const parsed = parseCertificateWorkbook(buffer, file.name);
      setParse(parsed);
      toast.success(`${parsed.rows.length} ligne(s) analysée(s) dans « ${parsed.sheetName} »`);
    } catch (error) {
      setParse(null);
      setParseError(error instanceof Error ? error.message : "Fichier illisible.");
      toast.error("Impossible de lire le fichier");
    }
  };

  const toggleRow = (rowNumber: number) => {
    setDeselected((current) => {
      const next = new Set(current);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  };

  const allValidSelected = validRows.length > 0 && selectedRows.length === validRows.length;

  const toggleAll = () => {
    setDeselected((current) => {
      const next = new Set(current);
      if (allValidSelected) {
        validRows.forEach((row) => next.add(row.rowNumber));
      } else {
        validRows.forEach((row) => next.delete(row.rowNumber));
      }
      return next;
    });
  };

  const run = async () => {
    if (selectedRows.length === 0) return;
    setBusy(true);
    setResults([]);
    setProgress(0);

    const inputs: CertificateInput[] = selectedRows.map((row) => ({
      studentName: row.studentName,
      studentId: row.studentId,
      diplomaTitle: row.diplomaTitle,
      issueDate: row.issueDate,
      recipientAddress: (row.recipientAddress || account) as `0x${string}`,
      grade: row.grade,
    }));

    const groups =
      mode === "batch" ? chunk(inputs, 50) : chunk(inputs, Math.min(50, chunkSize));

    let done = 0;
    const collected: EmissionResult[] = [];

    for (const group of groups) {
      const rowNumbers = selectedRows
        .slice(done, done + group.length)
        .map((row) => row.rowNumber);
      try {
        const hash = await mintBatch(version, group);
        collected.push({ rows: rowNumbers, hash });
        toast.success(`${group.length} certificat(s) émis`);
      } catch (error) {
        const message = getErrorMessage(error);
        collected.push({ rows: rowNumbers, error: message });
        toast.error(message);
      }
      done += group.length;
      setProgress(Math.round((done / inputs.length) * 100));
      setResults([...collected]);
    }

    setBusy(false);
    setConfirmOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["recent"] });
    await queryClient.invalidateQueries({ queryKey: ["totals"] });
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Import Excel</CardTitle>
              <CardDescription className="mt-1">
                .xlsx, .xls ou .csv — parsing 100 % côté client avec SheetJS. Rien n'est envoyé à un serveur.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="/etudiants.xlsx" download>
                  <Download className="h-3.5 w-3.5" />
                  Fichier d'exemple
                </a>
              </Button>
              <Button asChild size="sm">
                <a href="/etudiants-import.xlsx" download>
                  <Download className="h-3.5 w-3.5" />
                  Démo (nouveaux ID)
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <Alert variant="warning" className="mb-4">
              <Wallet />
              <AlertTitle>Wallet requis pour émettre</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>Vous pouvez analyser le fichier, mais l'émission nécessite un wallet.</span>
                <ConnectButton />
              </AlertDescription>
            </Alert>
          ) : null}

          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
              dragOver
                ? "border-primary/60 bg-primary/5"
                : "border-border/80 bg-background/30 hover:border-border hover:bg-secondary/20",
            )}
          >
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-border/70 bg-secondary/50 text-muted-foreground">
              {parse ? <FileSpreadsheet className="h-5 w-5 text-primary" /> : <Upload className="h-5 w-5" />}
            </div>
            <p className="mt-3 text-[13.5px] font-medium">
              {parse ? parse.fileName : "Déposez votre fichier ou cliquez pour parcourir"}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {parse
                ? `${parse.rows.length} ligne(s) · feuille « ${parse.sheetName} »`
                : "Colonnes attendues : studentName, studentId, issueDate, recipientAddress, grade"}
            </p>
            {parse ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={(event) => {
                  event.stopPropagation();
                  reset();
                }}
              >
                Changer de fichier
              </Button>
            ) : null}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>

          {parseError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle />
              <AlertTitle>Fichier invalide</AlertTitle>
              <AlertDescription>{parseError}</AlertDescription>
            </Alert>
          ) : null}

        </CardContent>
      </Card>

      {parse ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Lignes valides" value={validRows.length} tone="ok" />
            <SummaryCard label="Lignes en erreur" value={errorCount} tone={errorCount ? "error" : "muted"} />
            <SummaryCard label="Sélectionnées" value={selectedRows.length} tone="accent" />
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-[14px]">Aperçu et sélection</CardTitle>
                <CardDescription className="mt-1">
                  Décochez les lignes à ne pas émettre. Les doublons on-chain sont détectés avant signature.
                </CardDescription>
              </div>
              {duplicateQuery.isFetching ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Vérification on-chain
                </span>
              ) : null}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-5">
                      <Checkbox
                        checked={allValidSelected}
                        onCheckedChange={toggleAll}
                        disabled={validRows.length === 0}
                        aria-label="Tout sélectionner"
                      />
                    </TableHead>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Étudiant</TableHead>
                    <TableHead>Identifiant</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Destinataire</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const selected = row.errors.length === 0 && !deselected.has(row.rowNumber);
                    return (
                      <TableRow
                        key={row.rowNumber}
                        data-state={selected ? "selected" : undefined}
                        className={row.errors.length > 0 ? "opacity-80" : undefined}
                      >
                        <TableCell className="pl-5">
                          <Checkbox
                            checked={selected}
                            disabled={row.errors.length > 0}
                            onCheckedChange={() => toggleRow(row.rowNumber)}
                            aria-label={`Sélectionner la ligne ${row.rowNumber}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {row.rowNumber}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[13px]">{row.studentName || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-[11.5px]">
                          {row.studentId || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-[11.5px]">
                          {row.issueDate || "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-[11.5px]">
                          {row.recipientAddress ? (
                            <span title={row.recipientAddress}>{shortenAddress(row.recipientAddress)}</span>
                          ) : account ? (
                            <span className="text-muted-foreground">moi ({shortenAddress(account)})</span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {row.errors.length === 0 ? (
                            <Badge variant="default" className="gap-1 text-[10px]">
                              <CheckCircle2 className="h-3 w-3" />
                              prêt
                            </Badge>
                          ) : (
                            <Badge
                              variant="destructive"
                              className="gap-1 text-[10px]"
                              title={row.errors.join(" ")}
                            >
                              <XCircle className="h-3 w-3" />
                              {row.onChainDuplicate
                                ? "déjà émis"
                                : row.errors.some((error) => error.startsWith("Doublon dans le fichier"))
                                  ? "doublon"
                                  : "erreur"}
                            </Badge>
                          )}
                          {row.errors.length > 0 ? (
                            <p className="mt-1 max-w-[220px] text-[10.5px] leading-tight text-red-400/80">
                              {row.errors.join(" ")}
                            </p>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-[14px]">Stratégie d'émission</CardTitle>
              <CardDescription>
                Un batch unique minimise les frais, les lots séquentiels limitent l'impact d'un échec.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <ModeOption
                  active={mode === "batch"}
                  title="Une transaction (batch)"
                  description={`${selectedRows.length} certificat(s) en ${Math.max(1, Math.ceil(selectedRows.length / 50))} transaction(s)`}
                  onClick={() => setMode("batch")}
                />
                <ModeOption
                  active={mode === "sequential"}
                  title="Lots séquentiels"
                  description={`${Math.max(1, Math.ceil(selectedRows.length / chunkSize))} transaction(s) de ${chunkSize} max`}
                  onClick={() => setMode("sequential")}
                />
              </div>

              {mode === "sequential" ? (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 bg-background/30 px-4 py-3">
                  <span className="text-[12.5px] text-muted-foreground">Taille des lots</span>
                  <div className="flex gap-1">
                    {[5, 10, 15].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setChunkSize(size)}
                        className={cn(
                          "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                          chunkSize === size
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Le contrat plafonne chaque transaction à 50.
                  </span>
                </div>
              ) : null}

              {busy || progress > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11.5px] text-muted-foreground">
                    <span>{busy ? "Émission en cours…" : "Terminé"}</span>
                    <span className="font-mono">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              ) : null}

              {results.length > 0 ? (
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <div
                      key={`${result.rows.join("-")}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/30 px-3 py-2"
                    >
                      <span className="text-[12px] text-muted-foreground">
                        Lignes {result.rows[0]}–{result.rows[result.rows.length - 1]} · {result.rows.length} certificat(s)
                      </span>
                      {result.hash ? (
                        <TxHash hash={result.hash} />
                      ) : (
                        <span className="text-[11.5px] text-red-400">{result.error}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-col justify-between gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center">
                <p className="text-[11.5px] text-muted-foreground">
                  {selectedRows.length === 0
                    ? "Aucune ligne sélectionnée."
                    : `${selectedRows.length} certificat(s) prêt(s) à être émis sur ${version === "v2" ? "ERC-721" : "le registre"}.`}
                </p>
                <Button
                  disabled={selectedRows.length === 0 || busy || !isConnected}
                  onClick={() => setConfirmOpen(true)}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {busy ? "Émission…" : `Émettre ${selectedRows.length} certificat(s)`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'émission</DialogTitle>
            <DialogDescription>
              {selectedRows.length} certificat(s) seront émis en{" "}
              {mode === "batch"
                ? `${Math.max(1, Math.ceil(selectedRows.length / 50))} transaction(s)`
                : `${Math.max(1, Math.ceil(selectedRows.length / chunkSize))} transaction(s) séquentielle(s)`}
              . Chaque transaction devra être confirmée dans votre wallet.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border/70 bg-background/40 p-3 text-[12px] text-muted-foreground">
            <p>
              Contrat : <span className="font-mono">{version === "v2" ? "CertificateNFT (ERC-721)" : "CertificateRegistry"}</span>
            </p>
            <p className="mt-1">
              Réseau : <span className="font-mono">chainId {chainId}</span>
            </p>
            <p className="mt-1">
              Destinataires sans adresse : <span className="font-mono">{account ?? "aucun"}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              Annuler
            </Button>
            <Button onClick={() => void run()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {busy ? "Signature…" : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "error" | "accent" | "muted";
}) {
  const color =
    tone === "ok"
      ? "text-primary"
      : tone === "error"
        ? "text-red-400"
        : tone === "accent"
          ? "text-foreground"
          : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border/70 bg-card px-4 py-3">
      <p className="label-mono">{label}</p>
      <p className={cn("mt-1.5 font-display text-xl", color)}>{value}</p>
    </div>
  );
}

function ModeOption({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-4 py-3 text-left transition-colors",
        active
          ? "border-primary/40 bg-primary/[0.06]"
          : "border-border/70 bg-background/30 hover:border-border hover:bg-secondary/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium">{title}</span>
        <span
          className={cn(
            "h-3.5 w-3.5 rounded-full border",
            active ? "border-primary bg-primary shadow-[inset_0_0_0_3px_hsl(var(--background))]" : "border-border",
          )}
        />
      </div>
      <p className="mt-1 text-[11.5px] text-muted-foreground">{description}</p>
    </button>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

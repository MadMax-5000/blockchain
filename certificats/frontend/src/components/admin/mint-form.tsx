import type * as React from "react";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { TxHash } from "@/components/common/tx-hash";
import { ConnectButton } from "@/components/wallet/connect-button";
import { getErrorMessage } from "@/lib/errors";
import { shortenAddress, todayISO } from "@/lib/format";
import { useCertificateActions } from "@/hooks/use-actions";
import { useContractStatus } from "@/hooks/use-contract-status";
import { useVersion } from "@/hooks/use-version";

type FormState = {
  studentName: string;
  studentId: string;
  diplomaTitle: string;
  issueDate: string;
  recipientAddress: string;
  grade: string;
};

const EMPTY_FORM: FormState = {
  studentName: "",
  studentId: "",
  diplomaTitle: "",
  issueDate: todayISO(),
  recipientAddress: "",
  grade: "",
};

export function MintForm() {
  const { version } = useVersion();
  const { address, isConnected } = useAccount();
  const status = useContractStatus(version);
  const { mint } = useCertificateActions();

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, recipientAddress: address ?? "" });
  const [busy, setBusy] = useState(false);
  const [hash, setHash] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (address) {
      setForm((current) =>
        current.recipientAddress ? current : { ...current, recipientAddress: address },
      );
    }
  }, [address]);

  const update = (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = key === "studentId" ? event.target.value.toUpperCase() : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
  };

  const validation = validate(form, Boolean(address));
  const canSubmit =
    isConnected && status.data?.canMint && validation.length === 0 && !busy;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(undefined);
    setHash(undefined);
    try {
      const txHash = await mint(version, {
        studentName: form.studentName.trim(),
        studentId: form.studentId.trim().toUpperCase(),
        diplomaTitle: form.diplomaTitle.trim(),
        issueDate: form.issueDate,
        recipientAddress: form.recipientAddress as `0x${string}`,
        grade: form.grade.trim(),
      });
      setHash(txHash);
      toast.success("Certificat émis avec succès");
      setForm((current) => ({
        ...current,
        studentName: "",
        studentId: "",
        diplomaTitle: "",
        grade: "",
      }));
    } catch (submitError) {
      const message = getErrorMessage(submitError);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Émission unitaire</CardTitle>
              <CardDescription className="mt-1">
                Une transaction, un certificat. Les champs sont validés côté client avant signature.
              </CardDescription>
            </div>
            <Badge variant={version === "v2" ? "default" : "muted"} className="font-mono text-[10px]">
              {version === "v2" ? "ERC-721" : "registre"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <Alert variant="warning" className="mb-5">
              <Wallet />
              <AlertTitle>Wallet requis</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <span>Connectez un wallet pour signer la transaction d'émission.</span>
                <ConnectButton />
              </AlertDescription>
            </Alert>
          ) : null}

          {status.data && !status.data.canMint ? (
            <Alert variant="destructive" className="mb-5">
              <ShieldAlert />
              <AlertTitle>
                {version === "v1" && status.data.paused ? "Émissions en pause" : "Compte non autorisé"}
              </AlertTitle>
              <AlertDescription>
                {version === "v2"
                  ? `Ce compte (${address ? shortenAddress(address) : "inconnu"}) n'a pas MINTER_ROLE. Un administrateur peut l'accorder dans l'onglet Administration.`
                  : status.data.paused
                    ? "Le contrat est en pause. Réactivez les émissions depuis l'onglet Administration."
                    : `Compte ${address ? shortenAddress(address) : "inconnu"} connecté. Owner du registre : ${status.data.owner ? shortenAddress(status.data.owner) : "—"}. Importez le compte Hardhat #0 dans MetaMask, ou demandez à l'owner de vous ajouter comme admin.`}
              </AlertDescription>
            </Alert>
          ) : null}

          {status.data?.paused ? (
            <Alert variant="warning" className="mb-5">
              <AlertTriangle />
              <AlertTitle>Contrat en pause</AlertTitle>
              <AlertDescription>Les émissions sont temporairement bloquées.</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom complet" htmlFor="studentName">
                <Input
                  id="studentName"
                  value={form.studentName}
                  onChange={update("studentName")}
                  placeholder="Amina Benali"
                  autoComplete="off"
                />
              </Field>
              <Field label="Identifiant étudiant (CNE)" htmlFor="studentId">
                <Input
                  id="studentId"
                  value={form.studentId}
                  onChange={update("studentId")}
                  placeholder="2023-INF-042"
                  className="font-mono text-[13px] uppercase"
                  autoComplete="off"
                />
              </Field>
              <Field label="Intitulé du diplôme" htmlFor="diplomaTitle" className="sm:col-span-2">
                <Input
                  id="diplomaTitle"
                  value={form.diplomaTitle}
                  onChange={update("diplomaTitle")}
                  placeholder="Licence Informatique"
                  autoComplete="off"
                />
              </Field>
              <Field label="Date d'émission" htmlFor="issueDate">
                <Input id="issueDate" type="date" value={form.issueDate} onChange={update("issueDate")} />
              </Field>
              <Field label="Mention / note (optionnel)" htmlFor="grade">
                <Input
                  id="grade"
                  value={form.grade}
                  onChange={update("grade")}
                  placeholder="Mention Bien"
                  autoComplete="off"
                />
              </Field>
              <Field label="Adresse du destinataire" htmlFor="recipientAddress" className="sm:col-span-2">
                <div className="flex gap-2">
                  <Input
                    id="recipientAddress"
                    value={form.recipientAddress}
                    onChange={update("recipientAddress")}
                    placeholder="0x…"
                    className="font-mono text-[12.5px]"
                    autoComplete="off"
                  />
                  {address ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setForm((current) => ({ ...current, recipientAddress: address }))}
                    >
                      Mon adresse
                    </Button>
                  ) : null}
                </div>
              </Field>
            </div>

            {validation.length > 0 ? (
              <p className="text-[12px] text-amber-400">{validation[0]}</p>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                Le studentId est normalisé en majuscules. Un doublon sera rejeté par le contrat.
              </p>
            )}

            {error ? (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            {hash ? (
              <Alert variant="success">
                <CheckCircle2 />
                <AlertTitle>Certificat émis</AlertTitle>
                <AlertDescription className="mt-2 flex flex-wrap items-center gap-2">
                  <TxHash hash={hash} />
                  <span>La transaction est confirmée.</span>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
                {version === "v2" ? "mintCertificate → tokenId" : "mintCertificate → certId"}
              </span>
              <Button type="submit" disabled={!canSubmit}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {busy ? "Émission…" : "Émettre le certificat"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Contrôle d'accès</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-[12.5px]">
            <RoleRow
              label="Compte"
              value={address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "non connecté"}
              ok={isConnected}
            />
            {version === "v2" ? (
              <RoleRow
                label="MINTER_ROLE"
                value={status.data?.canMint ? "accordé" : "absent"}
                ok={Boolean(status.data?.canMint)}
              />
            ) : (
              <RoleRow
                label="Admin"
                value={status.data?.canMint ? "autorisé" : "non autorisé"}
                ok={Boolean(status.data?.canMint)}
              />
            )}
            <RoleRow
              label="Pause"
              value={status.data?.paused ? "actif" : "inactif"}
              ok={!status.data?.paused}
            />
            <RoleRow label="Réseau" value={version === "v2" ? "ERC-721" : "Registre"} ok />
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="p-5 text-[12px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Bon à savoir</p>
            <ul className="mt-2 space-y-1.5">
              <li>• Le destinataire peut être n'importe quel wallet, y compris le vôtre.</li>
              <li>• Les métadonnées sont immuables ; seule la révocation peut changer le statut.</li>
              <li>• En v2, le tokenURI est généré on-chain en JSON base64.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-2 block">
        {label}
      </Label>
      {children}
    </div>
  );
}

function RoleRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={ok ? "text-primary" : "text-muted-foreground"}>{value}</span>
    </div>
  );
}

function validate(form: FormState, hasAccount: boolean): string[] {
  const errors: string[] = [];
  if (!form.studentName.trim()) errors.push("Le nom de l'étudiant est requis.");
  if (!form.studentId.trim()) errors.push("L'identifiant étudiant est requis.");
  if (!form.diplomaTitle.trim()) errors.push("L'intitulé du diplôme est requis.");
  if (!form.issueDate) errors.push("La date d'émission est requise.");
  if (!form.recipientAddress.trim()) {
    errors.push(hasAccount ? "L'adresse du destinataire est requise." : "Connectez un wallet ou saisissez une adresse.");
  } else if (!isAddress(form.recipientAddress, { strict: false })) {
    errors.push("L'adresse du destinataire est invalide.");
  }
  return errors;
}

import type * as React from "react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, FileJson, Link2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddressDisplay } from "@/components/common/address-display";
import { CopyButton } from "@/components/common/copy-button";
import { StatusBadge } from "@/components/common/status-badge";
import type { CertificateRecord } from "@/lib/certificates";
import { copyToClipboard, formatDate, formatTimestamp } from "@/lib/format";
import { VERSION_META } from "@/lib/contracts";
import { cn } from "@/lib/utils";

export function CertificateCard({ certificate }: { certificate: CertificateRecord }) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify?q=${certificate.id.toString()}`
      : "";

  const decoded = certificate.tokenURI ? decodeTokenURI(certificate.tokenURI) : null;

  return (
    <>
      <Card className={cn("overflow-hidden", certificate.revoked ? "border-red-500/20" : "border-primary/15")}>
        <div className={cn("h-0.5 w-full", certificate.revoked ? "bg-red-500/50" : "bg-primary/60")} />
        <CardContent className="p-0">
          <div className="flex flex-col gap-8 p-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={certificate.version === "v2" ? "default" : "muted"} className="font-mono text-[10px]">
                  {certificate.version} · {VERSION_META[certificate.version].contract}
                </Badge>
                <StatusBadge revoked={certificate.revoked} />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {certificate.version === "v2" ? "tokenId" : "certId"} #{certificate.id.toString()}
                </span>
              </div>

              <div>
                <h2 className="text-balance text-2xl tracking-[-0.02em]">{certificate.diplomaTitle}</h2>
                <p className="mt-1.5 text-[15px] text-muted-foreground">{certificate.studentName}</p>
              </div>

              <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                <Detail label="Identifiant étudiant" value={certificate.studentId} mono />
                <Detail label="Date d'émission" value={formatDate(certificate.issueDate)} />
                <Detail label="Mention" value={certificate.grade || "—"} />
                <Detail
                  label="Destinataire"
                  value={<AddressDisplay address={certificate.recipient} chars={5} />}
                />
                {certificate.issuedAt ? (
                  <Detail label="Enregistré le" value={formatTimestamp(certificate.issuedAt)} />
                ) : null}
                <Detail
                  label="Statut"
                  value={
                    certificate.revoked ? (
                      <span className="text-red-400">Révoqué — ne plus considérer comme valide</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Valide
                      </span>
                    )
                  }
                />
              </div>

              {certificate.tokenURI ? (
                <div className="rounded-lg border border-border/70 bg-background/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="label-mono">tokenURI</span>
                    <div className="flex items-center gap-1">
                      <CopyButton value={certificate.tokenURI} label="Copier le tokenURI" />
                      <Button variant="ghost" size="sm" onClick={() => setJsonOpen(true)}>
                        <FileJson className="h-3.5 w-3.5" />
                        Voir le JSON
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1.5 truncate font-mono text-[11px] text-muted-foreground">
                    {certificate.tokenURI.slice(0, 96)}…
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col items-center gap-3 lg:w-40">
              <div className="rounded-xl bg-white p-3 shadow-[0_0_0_1px_hsl(var(--border))]">
                <QRCodeSVG value={shareUrl} size={112} level="M" bgColor="#ffffff" fgColor="#0A0A0A" />
              </div>
              <p className="text-center font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                scan pour vérifier
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  void copyToClipboard(shareUrl).then((ok) =>
                    ok ? toast.success("Lien de vérification copié") : toast.error("Copie impossible"),
                  );
                }}
              >
                <Link2 className="h-3.5 w-3.5" />
                Copier le lien
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 bg-background/30 px-6 py-3 text-[11.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Vérifié on-chain
            </span>
            <span className="h-3 w-px bg-border" />
            <span>
              Réseau : <span className="font-mono">chainId {certificate.version === "v2" ? "actif" : "actif"}</span>
            </span>
            <span className="h-3 w-px bg-border" />
            <span>
              Contrat :{" "}
              <span className="font-mono">{VERSION_META[certificate.version].contract}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={jsonOpen} onOpenChange={setJsonOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Métadonnées on-chain</DialogTitle>
            <DialogDescription>
              tokenURI décodé. En v2, ce JSON est généré directement par le contrat.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[55vh] overflow-auto rounded-lg border border-border/70 bg-background/60 p-4 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
            {decoded ?? "tokenURI indisponible"}
          </pre>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setJsonOpen(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="label-mono">{label}</p>
      <div className={cn("mt-1 text-[13px]", mono && "font-mono text-[12.5px]")}>{value}</div>
    </div>
  );
}

export function decodeTokenURI(uri: string): string {
  const prefix = "data:application/json;base64,";
  if (!uri.startsWith(prefix)) return uri;
  try {
    const payload = uri.slice(prefix.length);
    const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return uri;
  }
}

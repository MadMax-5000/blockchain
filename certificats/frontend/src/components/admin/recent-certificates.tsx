import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddressDisplay } from "@/components/common/address-display";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState, ErrorState } from "@/components/common/states";
import { getErrorMessage } from "@/lib/errors";
import type { RecentCertificate } from "@/lib/certificates";
import { useCertificateActions } from "@/hooks/use-actions";
import { useRecentCertificates } from "@/hooks/use-certificate-read";
import { useContractStatus } from "@/hooks/use-contract-status";
import { useVersion } from "@/hooks/use-version";

export function RecentCertificates() {
  const { version } = useVersion();
  const { data, isLoading, isError, error, refetch } = useRecentCertificates(version);
  const status = useContractStatus(version);
  const { revoke } = useCertificateActions();
  const queryClient = useQueryClient();

  const [target, setTarget] = useState<RecentCertificate | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmRevoke = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await revoke(version, target.id);
      toast.success(`Certificat #${target.id} révoqué`);
      setTarget(null);
      await queryClient.invalidateQueries({ queryKey: ["recent"] });
      await queryClient.invalidateQueries({ queryKey: ["certificate"] });
      await queryClient.invalidateQueries({ queryKey: ["totals"] });
    } catch (revokeError) {
      toast.error(getErrorMessage(revokeError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-[14px]">Certificats récents</CardTitle>
              <CardDescription className="mt-1">
                Derniers events <span className="font-mono text-[11px]">CertificateMinted</span> sur{" "}
                {version === "v2" ? "ERC-721" : "le registre"}.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              Rafraîchir
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-5">
              <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
            </div>
          ) : !data || data.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Aucun certificat pour le moment"
                description="Émettez un certificat unitaire ou importez un fichier Excel pour voir apparaître les événements ici."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/admin">Aller à l'émission</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">ID</TableHead>
                  <TableHead>Étudiant</TableHead>
                  <TableHead>Diplôme</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Destinataire</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="pr-5 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((certificate) => (
                  <TableRow key={`${certificate.version}-${certificate.id}`}>
                    <TableCell className="pl-5 font-mono text-[12px]">#{certificate.id.toString()}</TableCell>
                    <TableCell className="whitespace-nowrap text-[13px]">
                      {certificate.studentName}
                      <span className="ml-2 font-mono text-[10.5px] text-muted-foreground">
                        {certificate.studentId}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-[170px] text-[13px]">{certificate.diplomaTitle}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-[11.5px]">
                      {certificate.issueDate}
                    </TableCell>
                    <TableCell>
                      <AddressDisplay address={certificate.recipient} chars={3} withExplorer={false} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge revoked={certificate.revoked} />
                    </TableCell>
                    <TableCell className="pr-5">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/verify?q=${certificate.id.toString()}`}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Vérifier
                          </Link>
                        </Button>
                        {status.data?.canRevoke && !certificate.revoked ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            onClick={() => setTarget(certificate)}
                          >
                            <ShieldOff className="h-3.5 w-3.5" />
                            Révoquer
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Révoquer le certificat #{target?.id.toString()}</DialogTitle>
            <DialogDescription>
              Le token reste lisible pour la vérification publique, mais son statut passera à « révoqué ».
              Cette action est définitive.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border/70 bg-background/40 p-3 text-[12.5px]">
            <p className="font-medium">{target?.studentName}</p>
            <p className="mt-1 text-muted-foreground">
              {target?.diplomaTitle} · {target?.studentId}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)} disabled={busy}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={() => void confirmRevoke()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
              Révoquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import type * as React from "react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isAddress } from "viem";
import { KeyRound, Loader2, PauseCircle, PlayCircle, ShieldOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AddressDisplay } from "@/components/common/address-display";
import { getErrorMessage } from "@/lib/errors";
import { useCertificateActions } from "@/hooks/use-actions";
import { useContractAddress } from "@/hooks/use-deployment";
import { useContractStatus } from "@/hooks/use-contract-status";
import { useVersion } from "@/hooks/use-version";

export function AdminPanel() {
  const { version } = useVersion();
  const status = useContractStatus(version);
  const { address, fromBlock } = useContractAddress(version);
  const { setAdmin, grantRole, revokeRole, setPaused, revoke } = useCertificateActions();
  const queryClient = useQueryClient();

  const [target, setTarget] = useState("");
  const [certId, setCertId] = useState("");
  const [busy, setBusy] = useState<string>();

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["contract-status"] });
    await queryClient.invalidateQueries({ queryKey: ["recent"] });
    await queryClient.invalidateQueries({ queryKey: ["totals"] });
  };

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await refresh();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(undefined);
    }
  };

  const validTarget = isAddress(target, { strict: false });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-[14px]">Contrat actif</CardTitle>
          <CardDescription>{version === "v2" ? "CertificateNFT — ERC-721" : "CertificateRegistry — registre"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-[12.5px]">
          <Row label="Adresse">
            {address ? <AddressDisplay address={address} chars={6} /> : <span>non déployé</span>}
          </Row>
          <Row label="Bloc de déploiement">
            <span className="font-mono">{fromBlock || "—"}</span>
          </Row>
          <Row label="Votre accès">
            {status.data?.canMint ? (
              <Badge variant="default">émetteur</Badge>
            ) : (
              <Badge variant="muted">lecture seule</Badge>
            )}
          </Row>
          {version === "v2" ? (
            <Row label="Transferts">
              <Badge variant={status.data?.soulbound ? "warning" : "muted"}>
                {status.data?.soulbound ? "soulbound" : "transférable"}
              </Badge>
            </Row>
          ) : null}
          <Row label="Pause">
            <Badge variant={status.data?.paused ? "destructive" : "default"}>
              {status.data?.paused ? "en pause" : "actif"}
            </Badge>
          </Row>
        </CardContent>
      </Card>

      {version === "v1" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Owner et admins</CardTitle>
            <CardDescription>
              Seul le owner peut nommer des admins. Les admins peuvent émettre et révoquer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-[12.5px]">
            <Row label="Owner">
              {status.data?.owner ? <AddressDisplay address={status.data.owner} chars={6} /> : "—"}
            </Row>
            <Separator />
            {status.data?.isOwner ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="admin-address">Adresse admin</Label>
                  <Input
                    id="admin-address"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    placeholder="0x…"
                    className="font-mono text-[12px]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!validTarget || busy === "grant"}
                    onClick={() =>
                      void run("grant", () => setAdmin(target as `0x${string}`, true), "Admin ajouté")
                    }
                  >
                    {busy === "grant" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                    Ajouter
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!validTarget || busy === "revoke-admin"}
                    onClick={() =>
                      void run("revoke-admin", () => setAdmin(target as `0x${string}`, false), "Admin retiré")
                    }
                  >
                    Retirer
                  </Button>
                </div>
              </>
            ) : (
              <Alert variant="warning">
                <KeyRound />
                <AlertDescription>Seul le owner peut gérer les admins.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Rôles OpenZeppelin</CardTitle>
            <CardDescription>
              MINTER_ROLE pour émettre, DEFAULT_ADMIN_ROLE pour révoquer, mettre en pause et gérer les rôles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-[12.5px]">
            <Row label="MINTER_ROLE">
              <span className="font-mono text-[10.5px]">{status.data?.minterRole?.slice(0, 18)}…</span>
            </Row>
            <Row label="Votre rôle">
              <Badge variant={status.data?.isAdmin ? "default" : "muted"}>
                {status.data?.isAdmin ? "admin" : "simple lecteur"}
              </Badge>
            </Row>
            <Separator />
            {status.data?.isAdmin ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="role-address">Adresse à promouvoir</Label>
                  <Input
                    id="role-address"
                    value={target}
                    onChange={(event) => setTarget(event.target.value)}
                    placeholder="0x…"
                    className="font-mono text-[12px]"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!validTarget || !status.data?.minterRole || busy === "grant-role"}
                    onClick={() =>
                      void run(
                        "grant-role",
                        () => grantRole(status.data!.minterRole as `0x${string}`, target as `0x${string}`),
                        "MINTER_ROLE accordé",
                      )
                    }
                  >
                    {busy === "grant-role" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                    Accorder MINTER
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!validTarget || !status.data?.minterRole || busy === "revoke-role"}
                    onClick={() =>
                      void run(
                        "revoke-role",
                        () => revokeRole(status.data!.minterRole as `0x${string}`, target as `0x${string}`),
                        "MINTER_ROLE retiré",
                      )
                    }
                  >
                    Retirer
                  </Button>
                </div>
              </>
            ) : (
              <Alert variant="warning">
                <KeyRound />
                <AlertDescription>Seul un compte DEFAULT_ADMIN_ROLE peut gérer les rôles.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-[14px]">Pause d'urgence</CardTitle>
          <CardDescription>
            Bloque toutes les émissions sans modifier les certificats existants.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant={status.data?.paused ? "default" : "outline"}
            disabled={!(status.data?.isOwner || status.data?.isAdmin) || busy === "pause"}
            onClick={() =>
              void run(
                "pause",
                () => setPaused(version, !status.data?.paused),
                status.data?.paused ? "Contrat réactivé" : "Contrat mis en pause",
              )
            }
          >
            {busy === "pause" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : status.data?.paused ? (
              <PlayCircle className="h-4 w-4" />
            ) : (
              <PauseCircle className="h-4 w-4" />
            )}
            {status.data?.paused ? "Réactiver les émissions" : "Mettre en pause"}
          </Button>
          <p className="text-[11.5px] text-muted-foreground">
            Réservé au owner (v1) ou au DEFAULT_ADMIN_ROLE (v2).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-[14px]">Révocation manuelle</CardTitle>
          <CardDescription>
            Révoque un certificat par son {version === "v2" ? "tokenId" : "certId"}. Le statut reste consultable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={certId}
              onChange={(event) => setCertId(event.target.value.replace(/\D/g, ""))}
              placeholder="Identifiant (ex. 1)"
              className="font-mono text-[12px]"
            />
            <Button
              variant="destructive"
              disabled={!certId || !status.data?.canRevoke || busy === "revoke-cert"}
              onClick={() =>
                void run("revoke-cert", () => revoke(version, BigInt(certId)), `Certificat #${certId} révoqué`)
              }
            >
              {busy === "revoke-cert" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldOff className="h-4 w-4" />
              )}
              Révoquer
            </Button>
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            En v2, la révocation est réservée à DEFAULT_ADMIN_ROLE.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

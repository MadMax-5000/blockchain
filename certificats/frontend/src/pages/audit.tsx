import type * as React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, CheckCircle2, CircleSlash, FileWarning, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

type CheckStatus = "ok" | "risk" | "critical" | "uncovered";

type Control = {
  id: string;
  control: string;
  status: CheckStatus;
  note: string;
};

const CHECKLIST: Control[] = [
  {
    id: "AC-01",
    control: "Contrôle d'accès au mint",
    status: "ok",
    note: "MINTER_ROLE (v2) / owner + admins (v1). Tests d'accès refusé.",
  },
  {
    id: "AC-02",
    control: "Contrôle d'accès à la révocation",
    status: "ok",
    note: "DEFAULT_ADMIN_ROLE en v2, owner/admins en v1.",
  },
  {
    id: "EV-01",
    control: "Events CertificateMinted / CertificateRevoked",
    status: "ok",
    note: "tokenId et certId indexés, recipient indexé.",
  },
  {
    id: "RE-01",
    control: "Reentrancy sur le mint",
    status: "ok",
    note: "_safeMint appelle onERC721Received : mint/batch protégés par nonReentrant, test avec contrat malveillant.",
  },
  {
    id: "IN-01",
    control: "Validation des entrées",
    status: "ok",
    note: "Adresse nulle et champs requis rejetés avec custom errors.",
  },
  {
    id: "IN-02",
    control: "Unicité du studentId",
    status: "risk",
    note: "Mapping keccak256 on-chain. La normalisation (trim + majuscules) est faite côté frontend, un appel direct peut la contourner.",
  },
  {
    id: "RV-01",
    control: "Révocation claire",
    status: "ok",
    note: "Flag booléen + event, token conservé et toujours lisible. Double révocation bloquée.",
  },
  {
    id: "SO-01",
    control: "Solidity ≥ 0.8.x",
    status: "ok",
    note: "pragma 0.8.24, arithmétique vérifiée par le compilateur.",
  },
  {
    id: "OF-01",
    control: "Overflow / underflow",
    status: "ok",
    note: "Aucun unchecked ; compteurs uint256 largement dimensionnés.",
  },
  {
    id: "SB-01",
    control: "Transferts non autorisés (soulbound)",
    status: "ok",
    note: "_update bloque les transferts, approve et setApprovalForAll revertent. Option désactivable au déploiement.",
  },
  {
    id: "PS-01",
    control: "Pause d'urgence",
    status: "ok",
    note: "Pausable sur les mints, réservé au rôle admin. N'affecte pas les certificats existants.",
  },
  {
    id: "MD-01",
    control: "Injection dans les métadonnées JSON",
    status: "ok",
    note: "Échappement des guillemets, backslashes et retours à la ligne dans _escape.",
  },
  {
    id: "BT-01",
    control: "Limites de batch et longueurs",
    status: "ok",
    note: "MAX_BATCH_SIZE = 50, LengthMismatch et EmptyBatch couverts par tests.",
  },
  {
    id: "SC-01",
    control: "Aucun secret dans le frontend",
    status: "ok",
    note: "Aucune clé privée, adresses injectées depuis les artefacts de déploiement.",
  },
  {
    id: "SC-02",
    control: "Analyse statique (Slither)",
    status: "uncovered",
    note: "Non exécutée dans cet environnement Windows. Configuration et commande documentées.",
  },
  {
    id: "SC-03",
    control: "Fuzzing (Foundry)",
    status: "uncovered",
    note: "Hors périmètre. Tests unitaires Hardhat uniquement.",
  },
  {
    id: "SC-04",
    control: "Dépendance SheetJS (xlsx)",
    status: "risk",
    note: "Version communautaire avec advisories connus. Parsing strictement côté client, aucune donnée envoyée à un serveur.",
  },
  {
    id: "FE-01",
    control: "Gestion des erreurs de rôle côté UI",
    status: "ok",
    note: "hasRole est lu avant l'émission, message explicite si MINTER_ROLE absent.",
  },
];

const TESTS = [
  { suite: "CertificateRegistry (v1)", cases: "20", result: "20 / 20", detail: "mint, accès, doublon, batch, revoke, pause" },
  { suite: "CertificateNFT (v2)", cases: "21", result: "21 / 21", detail: "rôles, métadonnées, batch, revoke, soulbound, reentrancy" },
  { suite: "Frontend — typecheck", cases: "—", result: "0 erreur", detail: "tsc --noEmit" },
  { suite: "Frontend — build", cases: "—", result: "OK", detail: "vite build (~1,2 Mo)" },
  { suite: "Slither", cases: "—", result: "non exécuté", detail: "à lancer sur Linux/macOS" },
];

const RISKS = [
  "Longueur des chaînes non bornée on-chain : un admin malveillant peut faire exploser le coût du gas d'un batch.",
  "Normalisation du studentId côté client uniquement : un appel direct au contrat peut enregistrer une variante de casse.",
  "tokenURI en data URI base64 : certains wallets tronquent les très longues URI.",
  "Dépendance xlsx (SheetJS community) avec advisories de sécurité connus.",
  "Mode séquentiel non atomique : un échec au milieu d'un lot laisse les précédents émis.",
  "Aucun déploiement Sepolia vérifié dans ce livrable (réseau local uniquement).",
];

const RECOMMENDATIONS = [
  "Exécuter Slither et un fuzz Foundry en CI avant toute mise en production.",
  "Borner la longueur des champs (par exemple 128 octets) ou stocker un hash des métadonnées volumineuses.",
  "Séparer un REVOKER_ROLE du DEFAULT_ADMIN_ROLE pour le principe du moindre privilège.",
  "Déplacer les images et métadonnées lourdes vers IPFS, en ne gardant qu'un hash on-chain.",
  "Ajouter un indexeur (The Graph) pour l'historique complet et la recherche côté public.",
  "Mettre en place une clé de déploiement dédiée et un multisig pour le rôle admin.",
];

export function AuditPage() {
  const counts = CHECKLIST.reduce(
    (acc, item) => ({ ...acc, [item.status]: acc[item.status] + 1 }),
    { ok: 0, risk: 0, critical: 0, uncovered: 0 } as Record<CheckStatus, number>,
  );

  return (
    <div className="page-shell py-10 sm:py-14">
      <PageHeader
        eyebrow="Devoir 2 · Sécurité"
        title="Rapport d'audit simplifié"
        description="Périmètre, checklist appliquée, vulnérabilités recherchées, résultats des tests et risques résiduels. Le rapport complet est dans docs/audit-report.md."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/verify">
              Vérifier un certificat
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Summary label="Contrôles OK" value={counts.ok} tone="ok" icon={CheckCircle2} />
        <Summary label="Risques" value={counts.risk} tone="risk" icon={AlertTriangle} />
        <Summary label="Critiques" value={counts.critical} tone="critical" icon={FileWarning} />
        <Summary label="Non couverts" value={counts.uncovered} tone="uncovered" icon={CircleSlash} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ScopeCard title="Périmètre" items={["CertificateRegistry.sol", "CertificateNFT.sol", "Frontend (lecture des rôles)"]} />
        <ScopeCard title="Hors périmètre" items={["Infrastructure RPC", "Wallet / MetaMask", "Contrats OpenZeppelin"]} />
        <ScopeCard title="Méthode" items={["Revue manuelle ligne par ligne", "41 tests Hardhat", "Scénarios d'abus ciblés"]} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-[14px]">Checklist appliquée</CardTitle>
          <CardDescription>
            Statut par contrôle : OK, risque (faible/moyen, accepté ou à traiter), critique, non couvert.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20 pl-5">ID</TableHead>
                <TableHead>Contrôle</TableHead>
                <TableHead className="w-28">Statut</TableHead>
                <TableHead>Commentaire</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CHECKLIST.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="pl-5 font-mono text-[11px] text-muted-foreground">{item.id}</TableCell>
                  <TableCell className="min-w-[190px] text-[13px] font-medium">{item.control}</TableCell>
                  <TableCell>
                    <StatusPill status={item.status} />
                  </TableCell>
                  <TableCell className="min-w-[280px] text-[12px] leading-relaxed text-muted-foreground">
                    {item.note}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Vulnérabilités recherchées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Finding
              title="Reentrancy"
              description="Le callback onERC721Received est un vecteur réel. nonReentrant sur mint et batch, test avec un receveur qui tente un second mint."
            />
            <Finding
              title="Access control"
              description="Rôles OpenZeppelin, pas de tx.origin, pas de fonction publique non protégée. Tests d'accès refusé sur mint, revoke et pause."
            />
            <Finding
              title="Overflow / underflow"
              description="Solidity 0.8.24, aucun bloc unchecked, compteurs incrémentés une seule fois par mint."
            />
            <Finding
              title="Logique métier"
              description="Double studentId, double révocation, batchs de longueurs incohérentes, adresses nulles, champs vides."
            />
            <Finding
              title="Injection de métadonnées"
              description="Échappement JSON des chaînes contrôlées par l'admin avant encodage base64."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[14px]">Tests automatisés</CardTitle>
            <CardDescription>
              <code className="font-mono text-[11px]">npm test</code> dans certificats/contracts.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Suite</TableHead>
                  <TableHead>Cas</TableHead>
                  <TableHead>Résultat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TESTS.map((test) => (
                  <TableRow key={test.suite}>
                    <TableCell className="pl-5">
                      <p className="text-[12.5px] font-medium">{test.suite}</p>
                      <p className="mt-0.5 text-[10.5px] text-muted-foreground">{test.detail}</p>
                    </TableCell>
                    <TableCell className="font-mono text-[11.5px]">{test.cases}</TableCell>
                    <TableCell className="text-[11.5px] text-muted-foreground">{test.result}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[14px]">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Risques résiduels
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {RISKS.map((risk) => (
                <li key={risk} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400/80" />
                  {risk}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[14px]">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Recommandations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {RECOMMENDATIONS.map((recommendation) => (
                <li
                  key={recommendation}
                  className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground"
                >
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/80" />
                  {recommendation}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      <div className="rounded-xl border border-border/70 bg-card/40 p-5 text-[12.5px] leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Portée et honnêteté du rapport</p>
        <p className="mt-2">
          Cet audit est un exercice pédagogique, pas une certification de sécurité. Il couvre les
          contrats du dépôt et les scénarios d'abus classiques. Il ne remplace pas un audit
          professionnel, ni des tests d'intégration sur un réseau public avec des montants réels.
        </p>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: CheckStatus;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const color =
    tone === "ok"
      ? "text-primary"
      : tone === "risk"
        ? "text-amber-400"
        : tone === "critical"
          ? "text-red-400"
          : "text-muted-foreground";
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="label-mono">{label}</p>
        <Icon className={cn("h-3.5 w-3.5", color)} />
      </div>
      <p className={cn("mt-2 font-display text-2xl", color)}>{value}</p>
    </div>
  );
}

function ScopeCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/40 p-4">
      <p className="label-mono">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="h-1 w-1 rounded-full bg-primary/60" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Finding({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/30 p-3">
      <p className="text-[12.5px] font-medium">{title}</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function StatusPill({ status }: { status: CheckStatus }) {
  if (status === "ok") {
    return (
      <Badge variant="default" className="gap-1 text-[10px]">
        <CheckCircle2 className="h-3 w-3" />
        OK
      </Badge>
    );
  }
  if (status === "risk") {
    return (
      <Badge variant="warning" className="gap-1 text-[10px]">
        <AlertTriangle className="h-3 w-3" />
        Risque
      </Badge>
    );
  }
  if (status === "critical") {
    return (
      <Badge variant="destructive" className="gap-1 text-[10px]">
        <FileWarning className="h-3 w-3" />
        Critique
      </Badge>
    );
  }
  return (
    <Badge variant="muted" className="gap-1 text-[10px]">
      <CircleSlash className="h-3 w-3" />
      Non couvert
    </Badge>
  );
}

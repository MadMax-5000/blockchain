import { useAccount } from "wagmi";
import { AlertTriangle, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { VersionSwitch } from "@/components/wallet/version-switch";
import { ConnectButton } from "@/components/wallet/connect-button";
import { MintForm } from "@/components/admin/mint-form";
import { ExcelImport } from "@/components/admin/excel-import";
import { RecentCertificates } from "@/components/admin/recent-certificates";
import { AdminPanel } from "@/components/admin/admin-panel";
import { VERSION_META } from "@/lib/contracts";
import { getChainMeta } from "@/lib/chains";
import { useDeployment } from "@/hooks/use-deployment";
import { useNetwork } from "@/hooks/use-network";
import { useVersion } from "@/hooks/use-version";

export function AdminPage() {
  const { version } = useVersion();
  const { isConnected } = useAccount();
  const { chainId } = useNetwork();
  const deployment = useDeployment();
  const meta = VERSION_META[version];
  const chain = getChainMeta(chainId);

  return (
    <div className="page-shell py-10 sm:py-14">
      <PageHeader
        eyebrow="Espace administrateur"
        title="Émettre et administrer"
        description="Formulaire unitaire, import Excel validé côté client, suivi des certificats et gestion des rôles. Chaque écriture est une transaction signée par votre wallet."
        actions={
          <div className="flex items-center gap-2">
            <VersionSwitch />
            <Badge variant="outline" className="font-mono text-[10px]">
              {chain.short}
            </Badge>
          </div>
        }
      />

      {!deployment.hasDeployment ? (
        <Alert variant="warning" className="mb-5">
          <AlertTriangle />
          <AlertTitle>Aucun contrat déployé sur {chain.name}</AlertTitle>
          <AlertDescription className="mt-1">
            Lancez <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[11px]">npm run node</code> dans
            un terminal, puis <code className="rounded bg-background/60 px-1 py-0.5 font-mono text-[11px]">npm run deploy:local</code>.
            Les adresses sont ensuite injectées automatiquement dans le frontend.
          </AlertDescription>
        </Alert>
      ) : null}

      {!isConnected ? (
        <Alert variant="info" className="mb-5">
          <Wallet />
          <AlertTitle>Wallet non connecté</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>La consultation reste possible, mais l'émission nécessite une signature.</span>
            <ConnectButton />
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border/70 bg-card/50 px-4 py-3 text-[12px] text-muted-foreground">
        <span>
          Contrat actif :{" "}
          <span className="font-mono text-foreground">{meta.contract}</span>
        </span>
        <span className="hidden h-3 w-px bg-border sm:block" />
        <span>{meta.description}</span>
      </div>

      <Tabs defaultValue="single">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="single">Émission unitaire</TabsTrigger>
          <TabsTrigger value="excel">Import Excel</TabsTrigger>
          <TabsTrigger value="recent">Certificats récents</TabsTrigger>
          <TabsTrigger value="admin">Administration</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <MintForm />
        </TabsContent>
        <TabsContent value="excel">
          <ExcelImport />
        </TabsContent>
        <TabsContent value="recent">
          <RecentCertificates />
        </TabsContent>
        <TabsContent value="admin">
          <AdminPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

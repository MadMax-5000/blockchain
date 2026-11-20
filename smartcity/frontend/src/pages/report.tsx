import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/layout/page-heading";
import { ConnectButton } from "@/components/wallet/connect-button";
import { TxHash } from "@/components/common/tx-hash";
import { useDeployment } from "@/hooks/use-deployment";
import { useIssueActions } from "@/hooks/use-actions";
import { getErrorMessage } from "@/lib/errors";
import { todayISO } from "@/lib/format";
import { PRIORITY_NAMES, type IssueInput } from "@/lib/issues";

const INITIAL: IssueInput = {
  issueId: "CITY-2026-301",
  issueType: "StreetLight",
  location: "",
  description: "",
  reportDate: todayISO(),
  priority: 1,
  reportedBy: "",
  assignedTo: "",
  status: 0,
};

export function ReportPage() {
  const [form, setForm] = useState<IssueInput>(INITIAL);
  const [hash, setHash] = useState<string>();
  const { hasDeployment } = useDeployment();
  const { createIssue, isPending } = useIssueActions();

  const set = <K extends keyof IssueInput>(key: K, value: IssueInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.issueId || !form.issueType || !form.location || !form.description || !form.reportedBy) {
      toast.error("Renseignez tous les champs obligatoires.");
      return;
    }

    try {
      const result = await createIssue({
        ...form,
        issueId: form.issueId.trim().toUpperCase(),
        assignedTo: "",
        status: 0,
      });
      setHash(result.hash);
      toast.success(result.message);
      setForm({ ...INITIAL, issueId: `CITY-2026-${Math.floor(300 + Math.random() * 600)}` });
    } catch (error) {
      toast.error("Échec de la déclaration", { description: getErrorMessage(error) });
    }
  };

  return (
    <div className="page-shell space-y-8 py-8 sm:py-10">
      <PageHeading
        title="Nouveau signalement"
        description="Déclarez un problème urbain avec un identifiant unique, une localisation fictive et une priorité. Aucune donnée personnelle n'est stockée on-chain."
      />

      <form onSubmit={(event) => void submit(event)} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="panel space-y-5 p-5 sm:p-6">
          <Field label="Identifiant unique" hint="Exemple : CITY-2026-301">
            <Input
              value={form.issueId}
              onChange={(event) => set("issueId", event.target.value)}
              className="mono"
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Type de problème" hint="StreetLight, Road, Waste…">
              <Input
                value={form.issueType}
                onChange={(event) => set("issueType", event.target.value)}
                required
              />
            </Field>
            <Field label="Priorité">
              <select
                value={form.priority}
                onChange={(event) => set("priority", Number(event.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-[13px]"
              >
                {PRIORITY_NAMES.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Localisation" hint="Adresse ou quartier fictif">
            <Input
              value={form.location}
              onChange={(event) => set("location", event.target.value)}
              placeholder="Avenue Mohammed V, Rabat"
              required
            />
          </Field>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              rows={4}
              placeholder="Décrivez le problème observé"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground"
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Date de signalement">
              <Input
                type="date"
                value={form.reportDate}
                onChange={(event) => set("reportDate", event.target.value)}
                className="mono"
                required
              />
            </Field>
            <Field label="Déclarant" hint="Pseudonyme uniquement">
              <Input
                value={form.reportedBy}
                onChange={(event) => set("reportedBy", event.target.value)}
                placeholder="Citizen01"
                required
              />
            </Field>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="text-[15px] font-semibold">Ce qui sera écrit</h2>
            <ul className="mt-4 space-y-3 text-[13px] leading-relaxed text-muted-foreground">
              <li>Statut initial : Signalé</li>
              <li>Équipe : aucune (affectation par la municipalité)</li>
              <li>Acteur : adresse du wallet connecté</li>
              <li>Horodatage : block.timestamp</li>
            </ul>
            <div className="mt-5 border-t border-border pt-4">
              {hasDeployment ? (
                <p className="meta">Contrat prêt sur ce réseau.</p>
              ) : (
                <p className="text-[13px] text-amber-300">Déployez d'abord le contrat.</p>
              )}
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="text-[15px] font-semibold">Signature</h2>
            <p className="meta mt-2">
              Une transaction MetaMask est nécessaire. Le bouton reste désactivé sans wallet connecté.
            </p>
            <div className="mt-4 space-y-2">
              <ConnectButton />
              <Button type="submit" className="w-full" disabled={isPending || !hasDeployment}>
                {isPending ? "Signature en cours…" : "Enregistrer on-chain"}
              </Button>
            </div>
            {hash ? (
              <div className="mt-4 border-t border-border pt-4">
                <p className="meta mb-2">Dernière transaction</p>
                <TxHash hash={hash} />
              </div>
            ) : null}
          </div>
        </aside>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px]">{label}</Label>
      {children}
      {hint ? <p className="text-[13px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

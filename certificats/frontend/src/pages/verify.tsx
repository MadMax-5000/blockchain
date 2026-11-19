import type * as React from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, ScanSearch, Search, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/layout/page-header";
import { CertificateCard } from "@/components/verify/certificate-card";
import { EmptyState } from "@/components/common/states";
import { getErrorMessage } from "@/lib/errors";
import type { CertificateRecord } from "@/lib/certificates";
import { useCertificateSearch } from "@/hooks/use-certificate-search";

const EXAMPLES = ["1", "2", "2023-INF-042"];

export function VerifyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = useCertificateSearch();

  const [term, setTerm] = useState(searchParams.get("q") ?? "");
  const [results, setResults] = useState<CertificateRecord[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const run = async (value: string) => {
    const query = value.trim();
    if (!query) return;
    setLoading(true);
    setError(undefined);
    setSearched(true);
    try {
      const found = await search(query);
      setResults(found);
    } catch (searchError) {
      setError(getErrorMessage(searchError));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initial = searchParams.get("q");
    if (initial) {
      setTerm(initial);
      void run(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!term.trim()) return;
    setSearchParams(term.trim() ? { q: term.trim() } : {});
    void run(term);
  };

  return (
    <div className="page-shell py-10 sm:py-14">
      <PageHeader
        eyebrow="Vérification publique"
        title="Vérifier un certificat"
        description="Recherchez par identifiant de certificat ou par identifiant étudiant. La recherche interroge les deux contrats (registre v1 et ERC-721 v2) sans nécessiter de wallet."
        actions={
          <Badge variant="outline" className="font-mono text-[10px]">
            lecture seule
          </Badge>
        }
      />

      <Card className="overflow-hidden">
        <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="certId / tokenId (ex. 1) ou studentId (ex. 2023-INF-042)"
                className="h-11 pl-9 font-mono text-[13px]"
                aria-label="Identifiant à vérifier"
              />
            </div>
            <Button type="submit" size="lg" disabled={loading || !term.trim()} className="sm:w-40">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
              {loading ? "Recherche…" : "Vérifier"}
            </Button>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
            <span>Exemples :</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setTerm(example);
                  setSearchParams({ q: example });
                  void run(example);
                }}
                className="rounded-md border border-border/70 bg-background/40 px-2 py-0.5 font-mono text-[11px] transition-colors hover:border-primary/30 hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 space-y-4">
        {error ? (
          <Alert variant="destructive">
            <ShieldQuestion />
            <AlertTitle>Recherche impossible</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center gap-3 py-16 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Interrogation des contrats…
            </CardContent>
          </Card>
        ) : null}

        {!loading && searched && !error && results.length === 0 ? (
          <EmptyState
            title="Aucun certificat trouvé"
            description="Vérifiez l'identifiant saisi. Si le certificat a été émis sur un autre réseau, changez de réseau dans l'en-tête. Un certificat révoqué reste consultable."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTerm("");
                  setSearched(false);
                  setSearchParams({});
                }}
              >
                Nouvelle recherche
              </Button>
            }
          />
        ) : null}

        {!loading && results.length > 0 ? (
          <>
            <p className="text-[12px] text-muted-foreground">
              {results.length} résultat{results.length > 1 ? "s" : ""} — vérifiez que le statut est bien « valide ».
            </p>
            {results.map((certificate) => (
              <CertificateCard
                key={`${certificate.version}-${certificate.id.toString()}`}
                certificate={certificate}
              />
            ))}
          </>
        ) : null}

        {!loading && !searched ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <InfoCard
              title="Sans wallet"
              description="La vérification publique utilise un RPC en lecture seule. Aucune signature n'est demandée."
            />
            <InfoCard
              title="Deux contrats"
              description="La recherche couvre le registre du Devoir 1 et le NFT ERC-721 du Devoir 2."
            />
            <InfoCard
              title="Statut en direct"
              description="Un certificat révoqué reste lisible, mais affiche clairement le statut « révoqué »."
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InfoCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/40 p-4">
      <p className="text-[13px] font-medium">{title}</p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

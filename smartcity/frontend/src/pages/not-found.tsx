import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="page-shell flex min-h-[60vh] flex-col items-start justify-center py-12">
      <p className="mono text-primary">404</p>
      <h1 className="mt-3 text-[28px] font-semibold">Page introuvable</h1>
      <p className="meta mt-2 max-w-md">
        Cette adresse ne correspond à aucune vue de CityTrace. Revenez au registre des signalements.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Retour à l'accueil</Link>
      </Button>
    </div>
  );
}

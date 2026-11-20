import { BaseError, ContractFunctionRevertedError, InsufficientFundsError } from "viem";

const REVERT_MESSAGES: Record<string, string> = {
  IssueAlreadyExists: "Cet identifiant de signalement est déjà enregistré on-chain.",
  IssueNotFound: "Aucun signalement ne correspond à cet identifiant.",
  EmptyField: "Un champ obligatoire est vide.",
  StringTooLong: "Un champ dépasse la longueur maximale autorisée par le contrat.",
  TeamRequired: "Une équipe doit être affectée avant ce changement de statut.",
  InvalidStatusTransition: "Transition de statut impossible : la chaîne doit être respectée.",
  TeamChangeNotAllowed: "L'équipe ne peut plus être modifiée une fois le dossier résolu.",
  EmptyBatch: "Le lot de signalements est vide.",
  BatchTooLarge: "Le lot dépasse la taille maximale de 50 signalements.",
  EnforcedPause: "Le contrat est en pause : les écritures sont temporairement bloquées.",
  AccessControlUnauthorizedAccount: "Ce compte n'a pas le rôle municipal requis (AGENT_ROLE).",
  ExpectedPause: "Le contrat n'est pas en pause.",
};

export function getErrorMessage(error: unknown): string {
  if (!error) return "Erreur inconnue.";

  if (error instanceof Error && error.name === "ProviderNotFoundError") {
    return "Aucun wallet détecté. Installez MetaMask puis rechargez la page.";
  }

  if (error instanceof ContractFunctionRevertedError) return mapRevert(error);

  if (error instanceof BaseError) {
    const revert = error.walk((candidate) => candidate instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) return mapRevert(revert);

    const funds = error.walk((candidate) => candidate instanceof InsufficientFundsError);
    if (funds) return "Solde insuffisant pour payer le gas sur ce réseau.";

    if (/user rejected|denied transaction|rejected the request/i.test(error.message)) {
      return "Transaction annulée dans le wallet.";
    }
    if (/chain mismatch|does not match the target chain/i.test(error.message)) {
      return "Le wallet n'est pas sur le bon réseau. Changez de réseau puis réessayez.";
    }
    if (/connector not connected|not connected/i.test(error.message)) {
      return "Aucun wallet connecté.";
    }
    return error.shortMessage || error.message;
  }

  if (error instanceof Error) {
    if (/user rejected|denied transaction/i.test(error.message)) {
      return "Transaction annulée dans le wallet.";
    }
    return error.message;
  }

  return String(error);
}

function mapRevert(error: ContractFunctionRevertedError): string {
  const name = error.data?.errorName;
  if (!name || !REVERT_MESSAGES[name]) {
    return error.shortMessage || "La transaction a été rejetée par le contrat.";
  }

  const args = error.data?.args ?? [];
  if (name === "EmptyField" && args.length > 0) {
    return `Le champ « ${String(args[0])} » est obligatoire.`;
  }
  if (name === "IssueAlreadyExists" && args.length > 0) {
    return `L'identifiant ${String(args[0])} existe déjà on-chain.`;
  }
  if (name === "IssueNotFound" && args.length > 0) {
    return `Aucun signalement ${String(args[0])} n'existe on-chain.`;
  }
  if (name === "BatchTooLarge" && args.length > 1) {
    return `Le lot contient ${String(args[0])} lignes, maximum ${String(args[1])}.`;
  }
  if (name === "StringTooLong" && args.length > 1) {
    return `Le champ ${String(args[0])} dépasse ${String(args[1])} caractères.`;
  }
  if (name === "AccessControlUnauthorizedAccount" && args.length > 0) {
    return `Le compte ${shorten(String(args[0]))} n'a pas le rôle AGENT_ROLE.`;
  }
  return REVERT_MESSAGES[name];
}

function shorten(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

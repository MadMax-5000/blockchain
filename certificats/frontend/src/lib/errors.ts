import { BaseError, ContractFunctionRevertedError, InsufficientFundsError } from "viem";

const REVERT_MESSAGES: Record<string, string> = {
  NotAdmin: "Ce compte n'a pas le rôle administrateur sur ce contrat.",
  AccessControlUnauthorizedAccount:
    "Ce compte n'a pas le rôle requis. Demandez à un administrateur de vous accorder MINTER_ROLE.",
  OwnableUnauthorizedAccount: "Seul le owner du contrat peut effectuer cette action.",
  DuplicateStudentId: "Cet identifiant étudiant est déjà enregistré on-chain.",
  CertificateNotFound: "Aucun certificat ne correspond à cet identifiant.",
  CertificateNotFoundByStudentId: "Aucun certificat n'est associé à cet identifiant étudiant.",
  AlreadyRevoked: "Ce certificat est déjà révoqué.",
  ZeroAddress: "L'adresse destinataire est invalide (adresse nulle).",
  EmptyField: "Un champ obligatoire est vide.",
  EnforcedPause: "Le contrat est en pause : les émissions sont temporairement bloquées.",
  TransferNotAllowed: "Ce certificat est non transférable (soulbound).",
  ApprovalsDisabled: "Les approbations sont désactivées sur cette collection.",
  BatchTooLarge: "Le lot dépasse la taille maximale autorisée (50).",
  EmptyBatch: "Le lot est vide.",
  LengthMismatch: "Les tableaux du lot n'ont pas la même longueur.",
  ERC721NonexistentToken: "Ce token n'existe pas.",
};

export function getErrorMessage(error: unknown): string {
  if (!error) return "Erreur inconnue.";

  if (error instanceof ContractFunctionRevertedError) {
    return mapRevert(error);
  }

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
  if (name && REVERT_MESSAGES[name]) {
    const args = error.data?.args ?? [];
    if (name === "AccessControlUnauthorizedAccount" && args.length > 0) {
      return `Le compte ${shorten(String(args[0]))} n'a pas le rôle requis.`;
    }
    if (name === "EmptyField" && args.length > 0) {
      return `Le champ « ${String(args[0])} » est obligatoire.`;
    }
    if (name === "DuplicateStudentId" && args.length > 0) {
      return `L'identifiant étudiant ${String(args[0])} est déjà enregistré on-chain.`;
    }
    if (name === "BatchTooLarge" && args.length > 1) {
      return `Le lot contient ${String(args[0])} lignes, maximum ${String(args[1])}.`;
    }
    return REVERT_MESSAGES[name];
  }
  return error.shortMessage || "La transaction a été rejetée par le contrat.";
}

function shorten(value: string): string {
  return value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value;
}

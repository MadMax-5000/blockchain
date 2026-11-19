import type { ContractVersion } from "@/lib/contracts";

export type CertificateInput = {
  studentName: string;
  studentId: string;
  diplomaTitle: string;
  issueDate: string;
  recipientAddress: `0x${string}`;
  grade: string;
};

export type CertificateRecord = {
  version: ContractVersion;
  id: bigint;
  studentName: string;
  studentId: string;
  diplomaTitle: string;
  issueDate: string;
  grade: string;
  recipient: `0x${string}`;
  revoked: boolean;
  issuedAt?: bigint;
  tokenURI?: string;
};

export type RecentCertificate = CertificateRecord & {
  txHash?: string;
};

export type ParsedRow = Omit<CertificateInput, "recipientAddress"> & {
  recipientAddress: string;
  rowNumber: number;
  errors: string[];
  onChainDuplicate?: boolean;
  selected: boolean;
};

export type ParseResult = {
  rows: ParsedRow[];
  sheetName: string;
  fileName: string;
};

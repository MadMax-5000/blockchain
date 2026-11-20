export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function shortenHash(hash: string): string {
  if (!hash) return "";
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function formatNumber(value: bigint | number | undefined): string {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("fr-FR").format(Number(value));
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatTimestamp(seconds: bigint | number | undefined): string {
  if (seconds === undefined) return "—";
  const date = new Date(Number(seconds) * 1000);
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
}

export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

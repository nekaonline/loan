export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fa-IR").format(num) + " ریال";
}

export function formatNumber(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fa-IR").format(num);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fa-IR");
}

export function generateMemberCode(): string {
  const prefix = "M";
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}${timestamp}${random}`;
}

export function generateLoanCode(): string {
  const prefix = "L";
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `${prefix}${timestamp}${random}`;
}

export function calculateInstallments(
  principal: number,
  interestRate: number,
  installmentCount: number
): {
  installmentAmount: number;
  totalPayable: number;
  totalInterest: number;
} {
  if (interestRate === 0) {
    const installmentAmount = principal / installmentCount;
    return {
      installmentAmount: Math.ceil(installmentAmount),
      totalPayable: principal,
      totalInterest: 0,
    };
  }

  const monthlyRate = interestRate / 100 / 12;
  const installmentAmount =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, installmentCount)) /
    (Math.pow(1 + monthlyRate, installmentCount) - 1);

  const totalPayable = installmentAmount * installmentCount;
  const totalInterest = totalPayable - principal;

  return {
    installmentAmount: Math.ceil(installmentAmount),
    totalPayable: Math.ceil(totalPayable),
    totalInterest: Math.ceil(totalInterest),
  };
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function toJalali(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fa-IR");
}

export function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "QD",   label: "QD — Once daily" },
  { value: "BID",  label: "BID — Twice daily" },
  { value: "TID",  label: "TID — Three times daily" },
  { value: "QID",  label: "QID — Four times daily" },
  { value: "Q4H",  label: "Q4H — Every 4 hours" },
  { value: "Q6H",  label: "Q6H — Every 6 hours" },
  { value: "Q8H",  label: "Q8H — Every 8 hours" },
  { value: "Q12H", label: "Q12H — Every 12 hours" },
  { value: "QHS",  label: "QHS — At bedtime" },
  { value: "QAM",  label: "QAM — Every morning" },
  { value: "PRN",  label: "PRN — As needed" },
  { value: "STAT", label: "STAT — Immediately" },
  { value: "QOD",  label: "QOD — Every other day" },
  { value: "QW",   label: "QW — Once weekly" },
];

export function frequencyLabel(code: string): string {
  return FREQUENCY_OPTIONS.find((o) => o.value === code)?.label ?? code;
}

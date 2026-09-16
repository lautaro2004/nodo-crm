"use client";

import { useRouter } from "next/navigation";

import { Select } from "@/components/ui/primitives";

export function StatusSelect({
  apiPath,
  value,
  options,
}: {
  apiPath: string;
  value: string;
  options: { key: string; label: string }[];
}) {
  const router = useRouter();

  async function handleChange(next: string) {
    await fetch(apiPath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
  }

  return (
    <Select value={value} onChange={(e) => handleChange(e.target.value)} className="w-auto">
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

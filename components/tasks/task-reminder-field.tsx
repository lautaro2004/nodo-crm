import { Input, Label, Select } from "@/components/ui/primitives";
import { REMINDER_OFFSETS, computeRemindAt, type ReminderOffsetKey } from "@/components/tasks/reminder-offsets";

export interface ReminderState {
  offset: ReminderOffsetKey;
  custom: string;
}

export function TaskReminderField({
  dueAt,
  value,
  onChange,
}: {
  dueAt: string;
  value: ReminderState;
  onChange: (next: ReminderState) => void;
}) {
  const preview = value.offset !== "none" && value.offset !== "custom" ? computeRemindAt(dueAt, Number(value.offset)) : null;

  return (
    <div>
      <Label htmlFor="reminderOffset">Recordarme</Label>
      <Select
        id="reminderOffset"
        value={value.offset}
        disabled={!dueAt}
        onChange={(e) => onChange({ ...value, offset: e.target.value as ReminderOffsetKey })}
      >
        {REMINDER_OFFSETS.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </Select>
      {!dueAt && <p className="mt-1 text-xs text-slate-400">Elegí primero una fecha de vencimiento.</p>}
      {value.offset === "custom" && (
        <Input
          type="datetime-local"
          className="mt-2"
          value={value.custom}
          onChange={(e) => onChange({ ...value, custom: e.target.value })}
        />
      )}
      {preview && <p className="mt-1 text-xs text-slate-500">Te avisamos el {preview.replace("T", " a las ")}.</p>}
    </div>
  );
}

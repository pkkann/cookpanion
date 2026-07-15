import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import Badge from '@mui/material/Badge'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { PickerDay } from '@mui/x-date-pickers/PickerDay'
import type { PickerDayProps } from '@mui/x-date-pickers/PickerDay'

interface DateFieldProps {
  label: string
  /** ISO date-only string (`YYYY-MM-DD`) or `''` when empty. */
  value: string
  /** Called with an ISO `YYYY-MM-DD` string, or `''` when cleared/invalid. */
  onChange: (iso: string) => void
  fullWidth?: boolean
  required?: boolean
  size?: 'small' | 'medium'
  margin?: 'none' | 'dense' | 'normal'
  /** ISO `YYYY-MM-DD` dates to mark with a dot (e.g. days that already have a planned meal). */
  markedDates?: Set<string>
}

/**
 * A calendar day cell that shows a dot when its date is in `markedDates`. Days
 * stay fully selectable — the dot is purely informational. All standard day
 * props are forwarded to `PickerDay`, so selection/keyboard/click are intact.
 */
function MarkedDay(props: PickerDayProps & { markedDates?: Set<string> }) {
  const { markedDates, day, outsideCurrentMonth, ...other } = props
  const marked = !outsideCurrentMonth && !!markedDates?.has((day as Dayjs).format('YYYY-MM-DD'))
  return (
    <Badge
      overlap="circular"
      variant="dot"
      color="secondary"
      invisible={!marked}
      sx={{ '& .MuiBadge-badge': { top: '15%', right: '15%' } }}
    >
      <PickerDay day={day} outsideCurrentMonth={outsideCurrentMonth} {...other} />
    </Badge>
  )
}

/**
 * A MUI X `DatePicker` that speaks the app's ISO `YYYY-MM-DD` string contract,
 * so callers keep using plain strings (the same shape the API expects) while
 * getting the themed calendar UI. Centralizes the dayjs ↔ ISO conversion.
 */
export default function DateField({
  label,
  value,
  onChange,
  fullWidth,
  required,
  size,
  margin,
  markedDates,
}: DateFieldProps) {
  return (
    <DatePicker
      label={label}
      value={value ? dayjs(value) : null}
      onChange={(d) => onChange(d && d.isValid() ? d.format('YYYY-MM-DD') : '')}
      slots={markedDates ? { day: MarkedDay } : undefined}
      slotProps={{
        textField: { fullWidth, required, size, margin },
        // `markedDates` isn't part of PickerDayProps, so cast the extra prop through.
        ...(markedDates ? { day: { markedDates } as unknown as PickerDayProps } : {}),
      }}
    />
  )
}

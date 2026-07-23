import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import { UNIT_OPTIONS } from '../constants/units'
import { useT } from '../i18n/LanguageProvider'

interface UnitSelectProps {
  value: string
  onChange: (value: string) => void
  label: string
  required?: boolean
  size?: 'small' | 'medium'
  fullWidth?: boolean
  margin?: 'none' | 'dense' | 'normal'
  /** Render a blank "no unit" option (for optional fields). */
  includeEmpty?: boolean
  sx?: object
}

/**
 * A fixed-list unit picker backed by MUI's `TextField select`. Options come from
 * UNIT_OPTIONS. Any current value not in the list is preserved as an extra option
 * so editing legacy data never silently blanks the field.
 */
export default function UnitSelect({
  value,
  onChange,
  label,
  required,
  size,
  fullWidth,
  margin,
  includeEmpty,
  sx,
}: UnitSelectProps) {
  const t = useT()
  const options: string[] = [...UNIT_OPTIONS]
  if (value && !options.includes(value)) {
    options.unshift(value)
  }

  return (
    <TextField
      select
      label={label}
      required={required}
      size={size}
      fullWidth={fullWidth}
      margin={margin}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      sx={sx}
    >
      {includeEmpty && (
        <MenuItem value="">
          <em>{t('No unit')}</em>
        </MenuItem>
      )}
      {options.map((unit) => (
        <MenuItem key={unit} value={unit}>
          {unit}
        </MenuItem>
      ))}
    </TextField>
  )
}

import { useState } from 'react'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Tooltip from '@mui/material/Tooltip'
import LanguageIcon from '@mui/icons-material/Language'
import CheckIcon from '@mui/icons-material/Check'
import { useTranslation } from 'react-i18next'
import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES } from './config'
import type { Language } from './config'
import { useChangeLanguage } from './useChangeLanguage'

export default function LanguageSwitcher() {
  const { t } = useTranslation('common')
  const { language, changeLanguage } = useChangeLanguage()
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)

  const current: Language = SUPPORTED_LANGUAGES.includes(language)
    ? language
    : SUPPORTED_LANGUAGES[0]

  const handleSelect = (locale: Language) => {
    changeLanguage(locale)
    setAnchor(null)
  }

  return (
    <>
      <Tooltip title={t('language')}>
        <IconButton
          onClick={(e) => setAnchor(e.currentTarget)}
          size="small"
          aria-label={t('language')}
        >
          <LanguageIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {SUPPORTED_LANGUAGES.map((locale) => (
          <MenuItem
            key={locale}
            selected={locale === current}
            onClick={() => handleSelect(locale)}
          >
            <ListItemIcon>{locale === current && <CheckIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{LANGUAGE_LABELS[locale]}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

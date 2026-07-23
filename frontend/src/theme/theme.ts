import { createTheme } from '@mui/material/styles'

// "Fresh Herb" — basil-green led, warm-amber accent, on a soft cream ground.
// Page/section headings use the Fraunces variable serif (imported in main.tsx);
// body copy stays a clean system sans.
const HEADING_FONT = '"Fraunces Variable", Georgia, "Times New Roman", serif'
const BODY_FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#4f7a4d', light: '#6f9a6c', dark: '#3c5f3b', contrastText: '#ffffff' },
    secondary: { main: '#d98a3d', light: '#e6a662', dark: '#b96f27', contrastText: '#3b2a12' },
    background: { default: '#f6f7f2', paper: '#ffffff' },
    text: { primary: '#26302a', secondary: '#5b665e' },
    divider: 'rgba(38, 48, 42, 0.12)',
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: BODY_FONT,
    h1: { fontFamily: HEADING_FONT, fontWeight: 600, letterSpacing: '-0.01em' },
    h2: { fontFamily: HEADING_FONT, fontWeight: 600, letterSpacing: '-0.01em' },
    h3: { fontFamily: HEADING_FONT, fontWeight: 600, letterSpacing: '-0.01em' },
    h4: { fontFamily: HEADING_FONT, fontWeight: 600, letterSpacing: '-0.01em' },
    h5: { fontFamily: HEADING_FONT, fontWeight: 600 },
    h6: { fontFamily: HEADING_FONT, fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 10 } },
    },
    // A clean, light app bar with a hairline divider lets the green read as an
    // accent rather than painting the whole chrome green.
    MuiAppBar: {
      defaultProps: { color: 'default', elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
  },
})

export default theme

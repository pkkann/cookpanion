import { createTheme } from '@mui/material/styles'

// A warm, food-appropriate light palette: terracotta primary, olive/sage secondary.
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#c75d3c', // terracotta
      light: '#e07a56',
      dark: '#9c4325',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#5b7a4b', // sage/olive
      light: '#7a9b68',
      dark: '#3f5834',
      contrastText: '#ffffff',
    },
    background: {
      default: '#faf6f1', // warm off-white
      paper: '#ffffff',
    },
    text: {
      primary: '#2c2620',
      secondary: '#6b6155',
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily:
      '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 2px 12px rgba(44, 38, 32, 0.06)',
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
})

export default theme

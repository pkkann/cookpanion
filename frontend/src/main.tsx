import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/fraunces'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './App.tsx'
import theme from './theme/theme'
import { SnackbarProvider } from './components/SnackbarProvider'
import DateLocalizationProvider from './components/DateLocalizationProvider'
import { LanguageProvider } from './i18n/LanguageProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <DateLocalizationProvider>
            <SnackbarProvider>
              <App />
            </SnackbarProvider>
          </DateLocalizationProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </LanguageProvider>
  </StrictMode>,
)

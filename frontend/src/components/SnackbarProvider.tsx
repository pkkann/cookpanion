import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import type { AlertColor } from '@mui/material/Alert'

interface SnackState {
  open: boolean
  message: string
  severity: AlertColor
}

interface NotifyContextValue {
  notify: (message: string, severity?: AlertColor) => void
}

const NotifyContext = createContext<NotifyContextValue | undefined>(undefined)

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SnackState>({
    open: false,
    message: '',
    severity: 'info',
  })

  const notify = useCallback((message: string, severity: AlertColor = 'info') => {
    setState({ open: true, message, severity })
  }, [])

  const handleClose = useCallback(() => {
    setState((s) => ({ ...s, open: false }))
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <NotifyContext.Provider value={value}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleClose}
          severity={state.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {state.message}
        </Alert>
      </Snackbar>
    </NotifyContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotify(): (message: string, severity?: AlertColor) => void {
  const ctx = useContext(NotifyContext)
  if (!ctx) throw new Error('useNotify must be used within a SnackbarProvider')
  return ctx.notify
}

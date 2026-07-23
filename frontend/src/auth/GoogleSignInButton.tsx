import { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const GSI_SRC = 'https://accounts.google.com/gsi/client'
const SCRIPT_ID = 'google-gsi-client'

/** True when a Google client id is configured; pages use it to gate the button + divider. */
// eslint-disable-next-line react-refresh/only-export-components
export const googleSignInEnabled = Boolean(CLIENT_ID)

interface GoogleCredentialResponse {
  credential?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: GoogleCredentialResponse) => void
          }) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

// Load the Google Identity Services script exactly once, shared across mounts.
let scriptPromise: Promise<void> | null = null
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('gsi load failed')))
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('gsi load failed'))
    document.head.appendChild(script)
  })
  return scriptPromise
}

interface Props {
  /** Called with Google's ID token when the user picks an account. */
  onCredential: (credential: string) => void
}

/**
 * Renders Google's official "Sign in with Google" button using Google Identity
 * Services directly (no npm dependency). On success Google hands us a signed ID
 * token, which the caller forwards to the backend. Renders nothing when no
 * client id is configured, so the app is unchanged until Google sign-in is set up.
 */
export default function GoogleSignInButton({ onCredential }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  // Keep the callback fresh without re-initializing GIS on every render.
  const cbRef = useRef(onCredential)
  cbRef.current = onCredential

  useEffect(() => {
    if (!CLIENT_ID) return
    let cancelled = false
    loadGsi()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (res) => {
            if (res.credential) cbRef.current(res.credential)
          },
        })
        ref.current.innerHTML = ''
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'center',
          locale: 'en',
          width: Math.min(400, Math.max(200, ref.current.offsetWidth || 320)),
        })
      })
      .catch(() => {
        // Script/network failure — the button simply won't appear.
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!CLIENT_ID) return null

  return <Box ref={ref} sx={{ display: 'flex', justifyContent: 'center' }} />
}

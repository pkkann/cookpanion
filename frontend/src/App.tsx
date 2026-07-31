import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { useAiEnabled } from './api/config'
import ProtectedRoute from './auth/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Onboarding from './pages/Onboarding'
import JoinHousehold from './pages/JoinHousehold'
import Settings from './pages/Settings'
import Dashboard from './pages/Dashboard'
import Recipes from './pages/Recipes'
import RecipeDetail from './pages/RecipeDetail'
import AISuggestions from './pages/AISuggestions'
import ImportRecipe from './pages/ImportRecipe'
import Plan from './pages/Plan'

/** Redirects home when the server has no AI configured (pages stay unreachable). */
function RequireAi({ children }: { children: ReactNode }) {
  const aiEnabled = useAiEnabled()
  if (!aiEnabled) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/join/:code" element={<JoinHousehold />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/recipes" element={<Recipes />} />
              <Route path="/recipes/:id" element={<RecipeDetail />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/suggestions" element={<RequireAi><AISuggestions /></RequireAi>} />
              <Route path="/import" element={<RequireAi><ImportRecipe /></RequireAi>} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

import { useState } from 'react'
import { Link as RouterLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Fab from '@mui/material/Fab'
import SpeedDial from '@mui/material/SpeedDial'
import SpeedDialAction from '@mui/material/SpeedDialAction'
import SpeedDialIcon from '@mui/material/SpeedDialIcon'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import DashboardIcon from '@mui/icons-material/Dashboard'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import DownloadIcon from '@mui/icons-material/Download'
import AddIcon from '@mui/icons-material/Add'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import RecipeFormDialog from './RecipeFormDialog'
import { useAuth } from '../auth/AuthContext'
import { useAiEnabled } from '../api/config'
import { useT } from '../i18n/LanguageProvider'

const DRAWER_WIDTH = 248
const RAIL_WIDTH = 76
const BOTTOM_NAV_HEIGHT = 56
const RAIL_STORAGE_KEY = 'nav_rail_expanded'

/** Room for the bottom bar plus the floating action button above it. */
const MOBILE_BOTTOM_INSET = `calc(${BOTTOM_NAV_HEIGHT + 88}px + env(safe-area-inset-bottom))`

interface NavItem {
  title: string
  path: string
  icon: React.ReactNode
}

/**
 * The places you can be. Deliberately short and identical in every deployment —
 * things you *do* (import, ask the AI, write a recipe) live in the create menu
 * below, so the primary navigation stays a stable landmark.
 */
const NAV_ITEMS: NavItem[] = [
  { title: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { title: 'Recipes', path: '/recipes', icon: <RestaurantMenuIcon /> },
  { title: 'Meal plan', path: '/plan', icon: <CalendarMonthIcon /> },
]

interface CreateAction {
  title: string
  icon: React.ReactNode
  /** Where it goes; omitted for the action that opens the new-recipe dialog. */
  path?: string
  /** Entry is hidden when the server has no AI configured. */
  requiresAi?: boolean
}

const CREATE_ACTIONS: CreateAction[] = [
  { title: 'New recipe', icon: <AddIcon /> },
  { title: 'Import recipe', icon: <DownloadIcon />, path: '/import', requiresAi: true },
  { title: 'AI Suggestions', icon: <AutoAwesomeIcon />, path: '/suggestions', requiresAi: true },
]

function isActivePath(current: string, target: string): boolean {
  if (target === '/') return current === '/'
  return current === target || current.startsWith(`${target}/`)
}

function readStoredRail(): boolean {
  try {
    return localStorage.getItem(RAIL_STORAGE_KEY) === 'true'
  } catch {
    /* localStorage unavailable — start collapsed */
    return false
  }
}

export default function Layout() {
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const t = useT()
  const aiEnabled = useAiEnabled()
  const createActions = CREATE_ACTIONS.filter((action) => aiEnabled || !action.requiresAi)

  const [railExpanded, setRailExpanded] = useState(readStoredRail)
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [dialOpen, setDialOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const drawerWidth = railExpanded ? DRAWER_WIDTH : RAIL_WIDTH
  const railLabel = railExpanded ? t('Collapse navigation') : t('Expand navigation')
  const activePath = NAV_ITEMS.find((item) => isActivePath(location.pathname, item.path))?.path

  const widthTransition = theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  })

  const toggleRail = () => {
    const next = !railExpanded
    setRailExpanded(next)
    try {
      localStorage.setItem(RAIL_STORAGE_KEY, String(next))
    } catch {
      /* ignore persistence failures */
    }
  }

  const runCreateAction = (action: CreateAction) => {
    setDialOpen(false)
    if (action.path) navigate(action.path)
    else setCreateOpen(true)
  }

  const handleLogout = () => {
    setMenuAnchor(null)
    logout()
    navigate('/login')
  }

  const initials = (user?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  // Floating create button — clears the bottom bar on phones, corner-parked elsewhere.
  const fabPosition = {
    position: 'fixed',
    right: { xs: 16, md: 24 },
    bottom: {
      xs: `calc(${BOTTOM_NAV_HEIGHT + 16}px + env(safe-area-inset-bottom))`,
      md: 24,
    },
    zIndex: theme.zIndex.appBar,
  } as const

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        {railExpanded && (
          <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
            Cookpanion
          </Typography>
        )}
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1, px: 1 }}>
        {NAV_ITEMS.map((item) => {
          const label = t(item.title)
          const button = (
            <ListItemButton
              component={RouterLink}
              to={item.path}
              selected={isActivePath(location.pathname, item.path)}
              sx={{
                borderRadius: 2,
                minHeight: 48,
                justifyContent: railExpanded ? 'flex-start' : 'center',
                px: railExpanded ? 2 : 1,
              }}
            >
              <ListItemIcon
                sx={{ minWidth: 0, mr: railExpanded ? 2 : 0, justifyContent: 'center' }}
              >
                {item.icon}
              </ListItemIcon>
              {railExpanded && <ListItemText primary={label} />}
            </ListItemButton>
          )
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              {railExpanded ? (
                button
              ) : (
                <Tooltip title={label} placement="right">
                  {button}
                </Tooltip>
              )}
            </ListItem>
          )
        })}
      </List>
      {railExpanded && (
        <>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {t('Household')}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {user?.household?.name ?? '—'}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}
      >
        <Toolbar>
          {isDesktop && (
            <Tooltip title={railLabel}>
              <IconButton
                edge="start"
                color="inherit"
                aria-label={railLabel}
                onClick={toggleRail}
                sx={{ mr: 1 }}
              >
                {railExpanded ? <MenuOpenIcon /> : <MenuIcon />}
              </IconButton>
            </Tooltip>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
            <Typography
              variant="h6"
              sx={{ fontWeight: 700, display: { xs: 'block', md: 'none' } }}
            >
              Cookpanion
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                {user?.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.household?.name}
              </Typography>
            </Box>
            <Tooltip title={t('Account')}>
              <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)} size="small">
                <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
                  {initials}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="subtitle2">{user?.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.email}
                </Typography>
              </Box>
              <Divider />
              <MenuItem
                component={RouterLink}
                to="/settings"
                onClick={() => setMenuAnchor(null)}
              >
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                {t('Settings')}
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                {t('Log out')}
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Collapsible rail on desktop; phones get the bottom bar below instead */}
      {isDesktop && (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            transition: widthTransition,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              overflowX: 'hidden',
              borderRight: '1px solid',
              borderColor: 'divider',
              transition: widthTransition,
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      <Box component="main" sx={{ flexGrow: 1, width: 0 }}>
        <Toolbar />
        <Box
          sx={{
            p: { xs: 2, md: 4 },
            pb: { xs: MOBILE_BOTTOM_INSET, md: 4 },
            maxWidth: 1200,
            mx: 'auto',
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {!isDesktop && (
        <Paper
          elevation={0}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: theme.zIndex.appBar,
            borderRadius: 0,
            borderTop: '1px solid',
            borderColor: 'divider',
            pb: 'env(safe-area-inset-bottom)',
          }}
        >
          <BottomNavigation showLabels value={activePath ?? false} sx={{ height: BOTTOM_NAV_HEIGHT }}>
            {NAV_ITEMS.map((item) => (
              <BottomNavigationAction
                key={item.path}
                value={item.path}
                label={t(item.title)}
                icon={item.icon}
                component={RouterLink}
                to={item.path}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}

      {/* One create affordance everywhere; a lone action needs no menu around it */}
      {createActions.length === 1 ? (
        <Fab
          color="primary"
          aria-label={t(createActions[0].title)}
          onClick={() => runCreateAction(createActions[0])}
          sx={fabPosition}
        >
          <AddIcon />
        </Fab>
      ) : (
        <SpeedDial
          ariaLabel={t('Create')}
          icon={<SpeedDialIcon />}
          open={dialOpen}
          onOpen={() => setDialOpen(true)}
          onClose={() => setDialOpen(false)}
          sx={fabPosition}
        >
          {createActions.map((action) => (
            <SpeedDialAction
              key={action.title}
              icon={action.icon}
              slotProps={{ tooltip: { title: t(action.title), open: true } }}
              onClick={() => runCreateAction(action)}
            />
          ))}
        </SpeedDial>
      )}

      <RecipeFormDialog
        open={createOpen}
        recipe={null}
        onClose={() => setCreateOpen(false)}
        onSaved={(recipe) => navigate(`/recipes/${recipe.id}`)}
      />
    </Box>
  )
}

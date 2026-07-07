import { useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Skeleton from '@mui/material/Skeleton'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import KitchenIcon from '@mui/icons-material/Kitchen'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import LocalDiningIcon from '@mui/icons-material/LocalDining'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthContext'
import { useIngredients, usePlannedMeals, useRecipes, useStock } from '../api/hooks'
import { formatWeekdayDate, todayIso } from '../utils/date'
import { planShoppingList } from '../utils/planShoppingList'

interface StatCardProps {
  label: string
  value: number
  loading: boolean
  icon: React.ReactNode
  to: string
}

function StatCard({ label, value, loading, icon, to }: StatCardProps) {
  const navigate = useNavigate()
  return (
    <Card variant="outlined">
      <CardActionArea onClick={() => navigate(to)}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
            }}
          >
            {icon}
          </Box>
          <Box>
            {loading ? (
              <Skeleton variant="text" width={40} height={40} />
            ) : (
              <Typography variant="h4">{value}</Typography>
            )}
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

export default function Dashboard() {
  const { t, i18n } = useTranslation('dashboard')
  const navigate = useNavigate()
  const { user } = useAuth()
  const ingredients = useIngredients()
  const stock = useStock()
  const recipes = useRecipes()
  const plannedMeals = usePlannedMeals()

  const firstName = user?.name?.split(' ')[0] ?? t('fallbackName')

  // "The plan" is simply any upcoming planned meals — highlight it when present.
  const today = todayIso()
  const upcomingMeals = (plannedMeals.data ?? [])
    .filter((m) => m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
  const nextMeals = upcomingMeals.slice(0, 3)
  const buyCount = planShoppingList(plannedMeals.data ?? [], stock.data ?? []).toBuy.length

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('welcome', { name: firstName })}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {t('subtitle', { household: user?.household?.name ?? t('fallbackHousehold') })}
      </Typography>

      {/* Hero CTA */}
      <Paper
        sx={{
          p: { xs: 3, md: 4 },
          mb: 4,
          color: 'primary.contrastText',
          bgcolor: 'primary.main',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            {t('heroTitle')}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.92, maxWidth: 520 }}>
            {t('heroBody')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={<AutoAwesomeIcon />}
          onClick={() => navigate('/suggestions')}
          sx={{
            bgcolor: 'background.paper',
            color: 'primary.main',
            '&:hover': { bgcolor: 'grey.100' },
          }}
        >
          {t('getSuggestions')}
        </Button>
      </Paper>

      {/* Meal plan highlight — shown whenever there are upcoming planned meals */}
      {upcomingMeals.length > 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2.5, md: 3 },
            mb: 4,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: 'center',
            justifyContent: 'space-between',
            borderColor: 'primary.main',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarMonthIcon fontSize="small" color="primary" /> {t('planTitle')}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
              {nextMeals.map((m) => (
                <Chip
                  key={m.id}
                  size="small"
                  label={`${formatWeekdayDate(m.date, i18n.language)} · ${m.recipe.title}`}
                />
              ))}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {buyCount > 0 ? t('planToBuy', { count: buyCount }) : t('planAllStocked')}
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<CalendarMonthIcon />}
            onClick={() => navigate('/plan')}
          >
            {t('viewPlan')}
          </Button>
        </Paper>
      )}

      {/* Stats */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          mb: 4,
        }}
      >
        <StatCard
          label={t('statIngredients')}
          value={ingredients.data?.length ?? 0}
          loading={ingredients.isLoading}
          icon={<LocalDiningIcon />}
          to="/ingredients"
        />
        <StatCard
          label={t('statKitchen')}
          value={stock.data?.length ?? 0}
          loading={stock.isLoading}
          icon={<KitchenIcon />}
          to="/kitchen"
        />
        <StatCard
          label={t('statRecipes')}
          value={recipes.data?.length ?? 0}
          loading={recipes.isLoading}
          icon={<RestaurantMenuIcon />}
          to="/recipes"
        />
        <StatCard
          label={t('statPlanned')}
          value={upcomingMeals.length}
          loading={plannedMeals.isLoading}
          icon={<CalendarMonthIcon />}
          to="/plan"
        />
      </Box>

      {/* Quick links */}
      <Typography variant="h6" gutterBottom>
        {t('getStarted')}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        }}
      >
        {[
          {
            title: t('stockTitle'),
            body: t('stockBody'),
            to: '/kitchen',
          },
          {
            title: t('buildTitle'),
            body: t('buildBody'),
            to: '/recipes',
          },
        ].map((link) => (
          <Card key={link.to} variant="outlined">
            <CardActionArea onClick={() => navigate(link.to)}>
              <CardContent
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {link.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {link.body}
                  </Typography>
                </Box>
                <ArrowForwardIcon color="action" />
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  )
}

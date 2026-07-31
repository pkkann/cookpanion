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
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { useAuth } from '../auth/AuthContext'
import { useAiEnabled } from '../api/config'
import { useT } from '../i18n/LanguageProvider'
import { usePlannedMeals, useRecipes } from '../api/hooks'
import { todayIso } from '../utils/date'
import { usePlanDateLabel } from '../utils/usePlanDateLabel'

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
  const t = useT()
  const navigate = useNavigate()
  const aiEnabled = useAiEnabled()
  const dateLabel = usePlanDateLabel()
  const { user } = useAuth()
  const recipes = useRecipes()
  const plannedMeals = usePlannedMeals()

  const firstName = user?.name?.split(' ')[0] ?? t('there')

  // "The plan" is simply any upcoming planned meals — highlight it when present.
  const today = todayIso()
  const upcomingMeals = (plannedMeals.data ?? [])
    .filter((m) => m.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
  const nextMeals = upcomingMeals.slice(0, 3)
  // Something is planned for today → the user already knows what to cook, so
  // the hero shows that instead of the AI pitch.
  const todaysMeals = upcomingMeals.filter((m) => m.date === today)
  const todaysMeal = todaysMeals[0]

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        {t('Welcome back, {name}', { name: firstName })}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {t("Here's what's cooking in {household}.", {
          household: user?.household?.name ?? t('your household'),
        })}
      </Typography>

      {/* Hero — today's planned meal wins; the AI pitch is the fallback */}
      {todaysMeal ? (
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
            <Typography variant="overline" sx={{ opacity: 0.85, letterSpacing: 1 }}>
              {t("On today's menu")}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
              {todaysMeal.recipe.title}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.92 }}>
              {todaysMeal.servings === 1
                ? t('{count} serving', { count: todaysMeal.servings })
                : t('{count} servings', { count: todaysMeal.servings })}
              {todaysMeals.length > 1 &&
                ` · ${t('{count} more planned today', { count: todaysMeals.length - 1 })}`}
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<RestaurantMenuIcon />}
            onClick={() => navigate(`/recipes/${todaysMeal.recipe.id}?servings=${todaysMeal.servings}`)}
            sx={{
              bgcolor: 'background.paper',
              color: 'primary.main',
              '&:hover': { bgcolor: 'grey.100' },
            }}
          >
            {t('Open recipe')}
          </Button>
        </Paper>
      ) : aiEnabled && (
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
              {t('Not sure what to cook?')}
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.92, maxWidth: 520 }}>
              {t(
                "Get AI recipe ideas tuned to your household's taste — ready to save and plan.",
              )}
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
            {t('Get suggestions')}
          </Button>
        </Paper>
      )}

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
              <CalendarMonthIcon fontSize="small" color="primary" /> {t('Your meal plan')}
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1 }}>
              {nextMeals.map((m) => (
                <Chip
                  key={m.id}
                  size="small"
                  label={`${dateLabel(m.date)} · ${m.recipe.title}`}
                />
              ))}
            </Stack>
          </Box>
          <Button
            variant="contained"
            startIcon={<CalendarMonthIcon />}
            onClick={() => navigate('/plan')}
          >
            {t('View plan')}
          </Button>
        </Paper>
      )}

      {/* Stats */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          mb: 4,
        }}
      >
        <StatCard
          label={t('Recipes')}
          value={recipes.data?.length ?? 0}
          loading={recipes.isLoading}
          icon={<RestaurantMenuIcon />}
          to="/recipes"
        />
        <StatCard
          label={t('Planned meals')}
          value={upcomingMeals.length}
          loading={plannedMeals.isLoading}
          icon={<CalendarMonthIcon />}
          to="/plan"
        />
      </Box>

      {/* Quick links */}
      <Typography variant="h6" gutterBottom>
        {t('Get started')}
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
            title: t('Plan your meals'),
            body: t('Pick recipes for the days ahead so dinner is already decided.'),
            to: '/plan',
          },
          {
            title: t('Build a recipe'),
            body: t('Save your household favourites with ingredients and steps.'),
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

import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, ReactElement } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import Alert from '@mui/material/Alert'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import CircularProgress from '@mui/material/CircularProgress'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/DeleteOutlined'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import PeopleIcon from '@mui/icons-material/People'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import TranslateIcon from '@mui/icons-material/Translate'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CancelIcon from '@mui/icons-material/Cancel'
import HelpOutlinedIcon from '@mui/icons-material/HelpOutlined'
import ConfirmDialog from '../components/ConfirmDialog'
import RecipeFormDialog from '../components/RecipeFormDialog'
import CookDialog from '../components/CookDialog'
import type { CookRow } from '../components/CookDialog'
import { useNotify } from '../components/SnackbarProvider'
import {
  useCreateStock,
  useDeleteRecipe,
  useRecipe,
  useStock,
  useTranslateRecipe,
  useUpdateStock,
} from '../api/hooks'
import { errorMessage } from '../api/client'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { formatQuantity, scaleQuantity } from '../utils/quantity'
import { computeAvailability } from '../utils/availability'
import { addToStock } from '../utils/stock'
import { useIsMobile } from '../utils/useIsMobile'
import type { Availability } from '../utils/availability'
import type { RecipeIngredient, RecipeTranslation, StockItem } from '../api/types'
import { LANGUAGE_LABELS, type Language } from '../i18n/config'

interface IngredientAvailability extends Availability {
  ri: RecipeIngredient
  needed: number
}

interface StatusView {
  icon: ReactElement
  tooltip: string
  note: string | null
  noteColor?: string
}

/** Map an availability result to icon + tooltip + inline note. */
function statusView(
  a: IngredientAvailability,
  t: TFunction<['recipes', 'common', 'errors']>,
): StatusView {
  const neededLabel = `${formatQuantity(a.needed)} ${a.ri.unit}`.trim()
  const haveLabel = `${formatQuantity(a.have)} ${a.haveUnit}`.trim()
  switch (a.status) {
    case 'enough':
      return {
        icon: <CheckCircleIcon color="success" fontSize="small" />,
        tooltip: t('detail.status.enoughTooltip', { have: haveLabel }),
        note: null,
      }
    case 'partial': {
      const shortfallLabel = `${formatQuantity(a.shortfall)} ${a.ri.unit}`.trim()
      return {
        icon: <WarningAmberIcon color="warning" fontSize="small" />,
        tooltip: t('detail.status.partialTooltip', { have: haveLabel, shortfall: shortfallLabel }),
        note: t('detail.status.partialNote', { shortfall: shortfallLabel }),
        noteColor: 'warning.main',
      }
    }
    case 'none':
      return {
        icon: <CancelIcon color="error" fontSize="small" />,
        tooltip: t('detail.status.noneTooltip', { needed: neededLabel }),
        note: t('detail.status.noneNote', { needed: neededLabel }),
        noteColor: 'error.main',
      }
    case 'unknown':
      return {
        icon: <HelpOutlinedIcon color="disabled" fontSize="small" />,
        tooltip: t('detail.status.unknownTooltip', { have: haveLabel, needed: neededLabel }),
        note: t('detail.status.unknownNote'),
        noteColor: 'text.secondary',
      }
  }
}

export default function RecipeDetail() {
  const { t, i18n } = useTranslation(['recipes', 'common', 'errors'])
  const { id } = useParams<{ id: string }>()
  const recipeId = Number(id)
  const navigate = useNavigate()
  const notify = useNotify()
  const isMobile = useIsMobile()

  const { data: recipe, isLoading, isError, error } = useRecipe(recipeId)
  const { data: stock, isLoading: stockLoading, isError: stockError } = useStock()
  const deleteMut = useDeleteRecipe()

  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [cookOpen, setCookOpen] = useState(false)

  // "Show a translation" of the recipe in the current UI language. Loaded
  // translations are cached per locale here (and persisted server-side), and the
  // "translated" view is kept across UI-language changes.
  const locale: Language = i18n.language.startsWith('da') ? 'da' : 'en'
  const translateMut = useTranslateRecipe()
  const [loaded, setLoaded] = useState<Record<string, RecipeTranslation>>({})
  const [showTranslated, setShowTranslated] = useState(false)

  // Forget cached translations when the recipe changes — a different recipe, or
  // an edit (React Query hands back a new reference only when the data changes).
  useEffect(() => {
    setLoaded({})
    setShowTranslated(false)
  }, [recipe])

  const current = loaded[locale] ?? null

  const handleTranslate = async () => {
    if (!recipe) return
    try {
      const res = current ?? (await translateMut.mutateAsync({ id: recipe.id, locale }))
      setLoaded((prev) => ({ ...prev, [locale]: res }))
      setShowTranslated(true)
    } catch (err) {
      notify(errorMessage(err, t('detail.translateFailed')), 'error')
    }
  }

  // Keep the translated view when the UI language changes: fetch the new locale if
  // we don't have it yet (instant when the server already cached it).
  useEffect(() => {
    if (!showTranslated || !recipe || loaded[locale]) return
    translateMut
      .mutateAsync({ id: recipe.id, locale })
      .then((res) => setLoaded((prev) => ({ ...prev, [locale]: res })))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, showTranslated, recipe?.id])

  const tr = showTranslated ? current : null
  const ingredientName = (ri: RecipeIngredient) =>
    tr?.ingredientNames?.[String(ri.ingredient.id)] ?? ri.ingredient.name

  // Live, view-only servings scaling. Defaults to the recipe's stored servings.
  const baseServings = recipe?.servings ?? 0
  const canScale = baseServings > 0
  const defaultServings = canScale ? baseServings : 1
  const [chosenServings, setChosenServings] = useState(1)

  // Sync the chosen servings to the recipe once it loads / changes.
  useEffect(() => {
    setChosenServings(defaultServings)
  }, [recipe?.id, defaultServings])

  const isScaled = canScale && chosenServings !== baseServings

  const decrement = () => setChosenServings((n) => Math.max(1, n - 1))
  const increment = () => setChosenServings((n) => n + 1)
  const reset = () => setChosenServings(defaultServings)
  const onServingsInput = (e: ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10)
    setChosenServings(Number.isNaN(parsed) ? 1 : Math.max(1, parsed))
  }

  // Kitchen availability, cross-referenced by ingredient id and scaled live.
  const stockById = useMemo(() => {
    const m = new Map<number, StockItem>()
    for (const s of stock ?? []) m.set(s.ingredient.id, s)
    return m
  }, [stock])

  const availabilities = useMemo<IngredientAvailability[]>(() => {
    if (!recipe) return []
    return recipe.ingredients.map((ri) => {
      const needed = scaleQuantity(ri.quantity, baseServings, chosenServings)
      return { ri, needed, ...computeAvailability(needed, ri.unit, stockById.get(ri.ingredient.id)) }
    })
  }, [recipe, baseServings, chosenServings, stockById])

  const summary = useMemo(() => {
    const total = availabilities.length
    const missing = availabilities.filter((a) => a.status === 'none' || a.status === 'partial')
    const unknown = availabilities.filter((a) => a.status === 'unknown')
    const toBuy = missing.map((a) => ({
      ingredientId: a.ri.ingredient.id,
      name: a.ri.ingredient.name,
      shortfall: a.shortfall,
      unit: a.ri.unit,
    }))
    return {
      total,
      missingCount: missing.length,
      unknown,
      toBuy,
      allEnough: total > 0 && missing.length === 0 && unknown.length === 0,
    }
  }, [availabilities])

  const stockReady = !stockLoading && !stockError

  const cookRows = useMemo<CookRow[]>(
    () =>
      availabilities.map((a) => ({
        ingredientId: a.ri.ingredient.id,
        name: a.ri.ingredient.name,
        unit: a.ri.unit,
        needed: a.needed,
        have: a.have,
        haveUnit: a.haveUnit,
        status: a.status,
      })),
    [availabilities],
  )

  const createStock = useCreateStock()
  const updateStock = useUpdateStock()
  const stockBusy = createStock.isPending || updateStock.isPending

  // Add a bought ingredient to the kitchen so it counts as on-hand. When a stock
  // row already exists we top it up by the shortfall; otherwise we create one in
  // the recipe's unit.
  type ToBuy = (typeof summary.toBuy)[number]
  const addOne = (item: ToBuy) =>
    addToStock(
      { ingredientId: item.ingredientId, quantity: item.shortfall, unit: item.unit },
      stockById,
      { createStock: createStock.mutateAsync, updateStock: updateStock.mutateAsync },
    )

  const handleAddToKitchen = async (item: ToBuy) => {
    try {
      await addOne(item)
      notify(t('toast.addedToKitchen', { name: item.name }), 'success')
    } catch (err) {
      notify(errorMessage(err, t('errors:saveStock')), 'error')
    }
  }

  const handleAddAllToKitchen = async () => {
    try {
      for (const item of summary.toBuy) {
        await addOne(item)
      }
      notify(t('toast.addedAllToKitchen'), 'success')
    } catch (err) {
      notify(errorMessage(err, t('errors:saveStock')), 'error')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteMut.mutateAsync(recipeId)
      notify(t('toast.deleted'), 'success')
      navigate('/recipes')
    } catch (err) {
      notify(errorMessage(err, t('errors:deleteRecipe')), 'error')
    }
  }

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/recipes')} sx={{ mb: 2 }}>
        {t('detail.back')}
      </Button>

      {isError && (
        <Alert severity="error">{errorMessage(error, t('errors:loadRecipe'))}</Alert>
      )}

      {isLoading ? (
        <Stack spacing={2}>
          <Skeleton variant="text" width="50%" height={48} />
          <Skeleton variant="rounded" height={120} />
          <Skeleton variant="rounded" height={240} />
        </Stack>
      ) : recipe ? (
        <>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Box>
              <Typography variant="h4" component="h1">
                {tr?.title || recipe.title}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                <Chip
                  icon={<PeopleIcon />}
                  variant="outlined"
                  label={t('detail.servesByDefault', { count: recipe.servings })}
                />
                <Chip
                  variant="outlined"
                  label={t('detail.byAuthor', {
                    author: recipe.author?.name ?? t('detail.unknownAuthor'),
                  })}
                />
                {current ? (
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={showTranslated ? 'tr' : 'orig'}
                    onChange={(_e, v) => v !== null && setShowTranslated(v === 'tr')}
                  >
                    <ToggleButton value="orig">{t('detail.original')}</ToggleButton>
                    <ToggleButton value="tr">{LANGUAGE_LABELS[locale]}</ToggleButton>
                  </ToggleButtonGroup>
                ) : (
                  <Button
                    size="small"
                    startIcon={
                      translateMut.isPending ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <TranslateIcon fontSize="small" />
                      )
                    }
                    disabled={translateMut.isPending}
                    onClick={handleTranslate}
                  >
                    {translateMut.isPending
                      ? t('detail.translating')
                      : t('detail.translateTo', { lang: LANGUAGE_LABELS[locale] })}
                  </Button>
                )}
              </Stack>
            </Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              <Button
                variant="contained"
                fullWidth={isMobile}
                startIcon={<RestaurantIcon />}
                disabled={!stockReady || recipe.ingredients.length === 0}
                onClick={() => setCookOpen(true)}
              >
                {t('cook.button')}
              </Button>
              <Button
                variant="outlined"
                fullWidth={isMobile}
                startIcon={<EditIcon />}
                onClick={() => setEditOpen(true)}
              >
                {t('common:edit')}
              </Button>
              <Button
                variant="outlined"
                fullWidth={isMobile}
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => setConfirmOpen(true)}
              >
                {t('common:delete')}
              </Button>
            </Stack>
          </Box>

          {(tr?.description || recipe.description) && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {tr?.description || recipe.description}
            </Typography>
          )}

          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' },
              alignItems: 'start',
            }}
          >
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1,
                  mb: 1,
                }}
              >
                <Typography variant="h6">{t('detail.ingredients')}</Typography>
                {/* Servings stepper — recalculates quantities live */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    aria-label={t('detail.aria.decreaseServings')}
                    onClick={decrement}
                    disabled={chosenServings <= 1}
                  >
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                  <TextField
                    value={chosenServings}
                    onChange={onServingsInput}
                    type="number"
                    size="small"
                    aria-label={t('detail.aria.servings')}
                    slotProps={{
                      htmlInput: {
                        min: 1,
                        step: 1,
                        style: { textAlign: 'center', width: 40 },
                      },
                    }}
                  />
                  <IconButton
                    size="small"
                    aria-label={t('detail.aria.increaseServings')}
                    onClick={increment}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                    {t('detail.servingLabel', { count: chosenServings })}
                  </Typography>
                </Box>
              </Box>

              {/* Scaling hint / reset affordance */}
              {isScaled ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Chip
                    size="small"
                    color="primary"
                    variant="outlined"
                    label={t('detail.scaledFor', { count: chosenServings })}
                  />
                  <Button size="small" startIcon={<RestartAltIcon />} onClick={reset}>
                    {t('detail.reset')}
                  </Button>
                </Box>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  {canScale ? t('detail.scaleHint') : t('detail.noScaleHint')}
                </Typography>
              )}

              {/* Kitchen availability summary */}
              {recipe.ingredients.length > 0 &&
                (stockLoading ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                    {t('detail.checkingKitchen')}
                  </Typography>
                ) : stockError ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                    {t('detail.kitchenCheckFailed')}
                  </Typography>
                ) : summary.allEnough ? (
                  <Alert severity="success" sx={{ mb: 1.5, py: 0.25 }}>
                    {t('detail.haveEverything')}
                  </Alert>
                ) : (
                  <Box sx={{ mb: 1.5 }}>
                    {summary.missingCount > 0 && (
                      <Alert severity="warning" sx={{ mb: 1, py: 0.25 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {t('detail.missing', {
                            missing: summary.missingCount,
                            count: summary.total,
                          })}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {t('detail.shoppingList')}
                        </Typography>
                        <Stack spacing={0.25} sx={{ mt: 0.5 }}>
                          {summary.toBuy.map((b) => (
                            <Stack
                              key={b.ingredientId}
                              direction="row"
                              spacing={1}
                              sx={{ alignItems: 'center', justifyContent: 'space-between' }}
                            >
                              <Typography variant="body2">
                                {`${b.name} — ${formatQuantity(b.shortfall)} ${b.unit}`.trim()}
                              </Typography>
                              <Tooltip title={t('detail.addToKitchen')}>
                                <span>
                                  <IconButton
                                    size="small"
                                    color="inherit"
                                    disabled={stockBusy}
                                    aria-label={t('detail.addToKitchen')}
                                    onClick={() => handleAddToKitchen(b)}
                                  >
                                    <AddIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          ))}
                        </Stack>
                        {summary.toBuy.length > 1 && (
                          <Button
                            size="small"
                            color="inherit"
                            startIcon={<AddIcon />}
                            disabled={stockBusy}
                            onClick={handleAddAllToKitchen}
                            sx={{ mt: 0.5 }}
                          >
                            {t('detail.addAllToKitchen')}
                          </Button>
                        )}
                      </Alert>
                    )}
                    {summary.unknown.length > 0 && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {t('detail.checkManually', {
                          list: summary.unknown.map((a) => a.ri.ingredient.name).join(', '),
                        })}
                      </Typography>
                    )}
                  </Box>
                ))}

              {recipe.ingredients.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('detail.noIngredients')}
                </Typography>
              ) : (
                <List dense disablePadding>
                  {recipe.ingredients.map((ri, idx) => {
                    const a = availabilities[idx]
                    const view = stockReady && a ? statusView(a, t) : null
                    const qtyLabel = `${formatQuantity(a?.needed ?? ri.quantity)} ${ri.unit}`.trim()
                    return (
                      <ListItem
                        key={`${ri.ingredient.id}-${idx}`}
                        disableGutters
                        secondaryAction={
                          view ? (
                            <Tooltip title={view.tooltip}>
                              <Box component="span" sx={{ display: 'inline-flex' }}>
                                {view.icon}
                              </Box>
                            </Tooltip>
                          ) : undefined
                        }
                      >
                        <ListItemText
                          primary={ingredientName(ri)}
                          secondary={
                            <Box component="span">
                              <Typography component="span" variant="body2" color="text.secondary">
                                {qtyLabel}
                              </Typography>
                              {view?.note && (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  sx={{ display: 'block', color: view.noteColor }}
                                >
                                  {view.note}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    )
                  })}
                </List>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Typography variant="h6" gutterBottom>
                {t('detail.instructions')}
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {(tr?.instructions?.length ? tr.instructions : recipe.instructions).length > 0 ? (
                <Stack component="ol" spacing={1.5} sx={{ m: 0, pl: 3 }}>
                  {(tr?.instructions?.length ? tr.instructions : recipe.instructions).map((step, i) => (
                    <Typography key={i} component="li" variant="body1" sx={{ lineHeight: 1.6 }}>
                      {step}
                    </Typography>
                  ))}
                </Stack>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  {t('detail.noInstructions')}
                </Typography>
              )}
            </Paper>
          </Box>

          <RecipeFormDialog open={editOpen} recipe={recipe} onClose={() => setEditOpen(false)} />
          <CookDialog
            open={cookOpen}
            onClose={() => setCookOpen(false)}
            recipeId={recipe.id}
            recipeTitle={recipe.title}
            servings={chosenServings}
            rows={cookRows}
          />
          <ConfirmDialog
            open={confirmOpen}
            title={t('deleteTitle')}
            message={t('deleteMessage', { title: recipe.title })}
            confirmLabel={t('common:delete')}
            destructive
            loading={deleteMut.isPending}
            onConfirm={handleDelete}
            onCancel={() => setConfirmOpen(false)}
          />
        </>
      ) : (
        !isError && <Typography>{t('detail.notFound')}</Typography>
      )}
    </Box>
  )
}

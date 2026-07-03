<?php

namespace App\Controller;

use App\Entity\Recipe;
use App\Entity\RecipeIngredient;
use App\Entity\User;
use App\Repository\IngredientRepository;
use App\Repository\RecipeRepository;
use App\Repository\StockItemRepository;
use App\Service\EntityPresenter;
use App\Service\RecipeTranslator;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/recipes')]
class RecipeController extends AbstractApiController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly RecipeRepository $recipes,
        private readonly IngredientRepository $ingredients,
        private readonly StockItemRepository $stock,
        private readonly EntityPresenter $presenter,
        private readonly RecipeTranslator $translator,
    ) {
    }

    #[Route('', name: 'api_recipes_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $items = $this->recipes->findBy(['household' => $this->household()], ['createdAt' => 'DESC']);

        return $this->json(array_map($this->presenter->recipe(...), $items));
    }

    #[Route('', name: 'api_recipes_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $title = trim((string) ($data['title'] ?? ''));
        if ('' === $title) {
            return $this->json(['error' => 'Validation failed', 'details' => ['title' => 'Title is required.']], Response::HTTP_BAD_REQUEST);
        }

        /** @var User $user */
        $user = $this->getUser();

        $recipe = (new Recipe())
            ->setAuthor($user)
            ->setHousehold($this->household());

        $applied = $this->apply($recipe, $data);
        if ($applied instanceof JsonResponse) {
            return $applied;
        }

        $this->em->persist($recipe);
        $this->em->flush();

        return $this->json($this->presenter->recipe($recipe), Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'api_recipes_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function show(int $id): JsonResponse
    {
        $recipe = $this->find($id);
        if ($recipe instanceof JsonResponse) {
            return $recipe;
        }

        return $this->json($this->presenter->recipe($recipe));
    }

    #[Route('/{id}', name: 'api_recipes_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $recipe = $this->find($id);
        if ($recipe instanceof JsonResponse) {
            return $recipe;
        }

        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        if (\array_key_exists('title', $data) && '' === trim((string) $data['title'])) {
            return $this->json(['error' => 'Validation failed', 'details' => ['title' => 'Title is required.']], Response::HTTP_BAD_REQUEST);
        }

        $applied = $this->apply($recipe, $data);
        if ($applied instanceof JsonResponse) {
            return $applied;
        }

        // Content changed → drop any cached translations so they get regenerated.
        $recipe->setTranslations(null);

        $this->em->flush();

        return $this->json($this->presenter->recipe($recipe));
    }

    /**
     * Translates the recipe's human-readable content into the given locale (or the
     * current user's) and caches it on the recipe, keyed by locale. Returns the
     * cached translation when present. Display-only: ingredient identity is unchanged.
     */
    #[Route('/{id}/translate', name: 'api_recipes_translate', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function translate(int $id, Request $request): JsonResponse
    {
        $recipe = $this->find($id);
        if ($recipe instanceof JsonResponse) {
            return $recipe;
        }

        if (!$this->translator->isConfigured()) {
            return $this->json(['error' => 'AI is not configured. Add ANTHROPIC_API_KEY.'], Response::HTTP_SERVICE_UNAVAILABLE);
        }

        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        /** @var User $user */
        $user = $this->getUser();
        $locale = (string) ($data['locale'] ?? $user->getLocale());
        if (!\in_array($locale, ['en', 'da'], true)) {
            $locale = 'en';
        }

        // Serve a cached translation if we already have one for this locale.
        $translations = $recipe->getTranslations() ?? [];
        if (isset($translations[$locale])) {
            return $this->json($translations[$locale]);
        }

        $ingredients = [];
        foreach ($recipe->getRecipeIngredients() as $recipeIngredient) {
            $ingredient = $recipeIngredient->getIngredient();
            $ingredients[] = ['id' => $ingredient->getId(), 'name' => $ingredient->getName()];
        }

        $language = ['en' => 'English', 'da' => 'Danish'][$locale];
        $result = $this->translator->translate(
            $recipe->getTitle(),
            $recipe->getDescription(),
            $recipe->getInstructionSteps(),
            $ingredients,
            $language,
        );

        if (null === $result) {
            return $this->json(['error' => 'AI translation failed. Please try again later.'], Response::HTTP_BAD_GATEWAY);
        }

        $translations[$locale] = $result;
        $recipe->setTranslations($translations);
        $this->em->flush();

        return $this->json($result);
    }

    /**
     * Deducts the given amounts from the household's kitchen stock ("cooking" the
     * recipe). All deductions are applied in a single flush; quantities are floored
     * at zero (never negative) and stock rows that reach zero are kept. Ingredients
     * with no stock row are silently skipped. Returns the updated stock list.
     */
    #[Route('/{id}/cook', name: 'api_recipes_cook', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function cook(int $id, Request $request): JsonResponse
    {
        $recipe = $this->find($id);
        if ($recipe instanceof JsonResponse) {
            return $recipe;
        }

        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $items = $data['items'] ?? null;
        if (!\is_array($items)) {
            return $this->json(['error' => 'Validation failed', 'details' => ['items' => 'Must be an array.']], Response::HTTP_BAD_REQUEST);
        }

        $household = $this->household();

        foreach ($items as $index => $line) {
            if (!\is_array($line)) {
                return $this->json(['error' => 'Validation failed', 'details' => ["items[$index]" => 'Must be an object.']], Response::HTTP_BAD_REQUEST);
            }

            $ingredientId = (int) ($line['ingredientId'] ?? 0);
            $quantity = max(0.0, (float) ($line['quantity'] ?? 0));
            if ($ingredientId <= 0 || 0.0 === $quantity) {
                continue;
            }

            $ingredient = $this->ingredients->findOneBy(['id' => $ingredientId, 'household' => $household]);
            if (null === $ingredient) {
                continue;
            }

            $stock = $this->stock->findOneBy(['ingredient' => $ingredient, 'household' => $household]);
            if (null === $stock) {
                continue;
            }

            $stock->setQuantity(max(0.0, $stock->getQuantity() - $quantity));
        }

        $this->em->flush();

        $updated = $this->stock->findBy(['household' => $household]);

        return $this->json(array_map($this->presenter->stockItem(...), $updated));
    }

    #[Route('/{id}', name: 'api_recipes_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id): JsonResponse
    {
        $recipe = $this->find($id);
        if ($recipe instanceof JsonResponse) {
            return $recipe;
        }

        $this->em->remove($recipe);
        $this->em->flush();

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Applies scalar fields and, when an "ingredients" array is provided, replaces
     * the recipe's ingredient lines. Returns a JsonResponse on validation failure.
     *
     * @param array<string, mixed> $data
     */
    private function apply(Recipe $recipe, array $data): ?JsonResponse
    {
        if (\array_key_exists('title', $data)) {
            $recipe->setTitle(trim((string) $data['title']));
        }
        if (\array_key_exists('description', $data)) {
            $recipe->setDescription((string) $data['description']);
        }
        if (\array_key_exists('instructions', $data)) {
            $instructions = $data['instructions'];
            if (\is_array($instructions)) {
                $recipe->setInstructionSteps(array_map(static fn ($s): string => (string) $s, $instructions));
            } else {
                // Tolerate a legacy string body; it is split into steps on read.
                $recipe->setInstructions((string) $instructions);
            }
        }
        if (\array_key_exists('servings', $data)) {
            $recipe->setServings(max(1, (int) $data['servings']));
        }

        if (!\array_key_exists('ingredients', $data)) {
            return null;
        }

        if (!\is_array($data['ingredients'])) {
            return $this->json(['error' => 'Validation failed', 'details' => ['ingredients' => 'Must be an array.']], Response::HTTP_BAD_REQUEST);
        }

        // Replace the full set of ingredient lines (orphanRemoval cleans up the old ones).
        $recipe->clearRecipeIngredients();

        foreach ($data['ingredients'] as $index => $line) {
            if (!\is_array($line)) {
                return $this->json(['error' => 'Validation failed', 'details' => ["ingredients[$index]" => 'Must be an object.']], Response::HTTP_BAD_REQUEST);
            }

            $ingredientId = (int) ($line['ingredientId'] ?? 0);
            $ingredient = $ingredientId > 0
                ? $this->ingredients->findOneBy(['id' => $ingredientId, 'household' => $this->household()])
                : null;
            if (null === $ingredient) {
                return $this->json(['error' => 'Ingredient not found', 'details' => ["ingredients[$index].ingredientId" => $ingredientId]], Response::HTTP_BAD_REQUEST);
            }

            $recipeIngredient = (new RecipeIngredient())
                ->setIngredient($ingredient)
                ->setQuantity((float) ($line['quantity'] ?? 0))
                ->setUnit(trim((string) ($line['unit'] ?? ($ingredient->getDefaultUnit() ?? ''))));

            $recipe->addRecipeIngredient($recipeIngredient);
        }

        return null;
    }

    private function find(int $id): Recipe|JsonResponse
    {
        $recipe = $this->recipes->findOneBy(['id' => $id, 'household' => $this->household()]);
        if (null === $recipe) {
            return $this->json(['error' => 'Recipe not found'], Response::HTTP_NOT_FOUND);
        }

        return $recipe;
    }
}

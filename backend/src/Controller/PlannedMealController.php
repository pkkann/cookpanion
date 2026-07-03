<?php

namespace App\Controller;

use App\Entity\PlannedMeal;
use App\Repository\PlannedMealRepository;
use App\Repository\RecipeRepository;
use App\Service\EntityPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/**
 * CRUD for planned meals (a recipe assigned to a date). The collection of a
 * household's planned meals is "the plan"; there is no plan entity.
 */
#[Route('/api/planned-meals')]
class PlannedMealController extends AbstractApiController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly PlannedMealRepository $plannedMeals,
        private readonly RecipeRepository $recipes,
        private readonly EntityPresenter $presenter,
    ) {
    }

    #[Route('', name: 'api_planned_meals_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $items = $this->plannedMeals->findBy(['household' => $this->household()], ['date' => 'ASC', 'id' => 'ASC']);

        return $this->json(array_map($this->presenter->plannedMeal(...), $items));
    }

    #[Route('', name: 'api_planned_meals_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $recipeId = (int) ($data['recipeId'] ?? 0);
        $date = $this->parseDate($data['date'] ?? null);
        $errors = [];
        if ($recipeId <= 0) {
            $errors['recipeId'] = 'A valid recipeId is required.';
        }
        if (null === $date) {
            $errors['date'] = 'A valid date (YYYY-MM-DD) is required.';
        }
        if ($errors) {
            return $this->json(['error' => 'Validation failed', 'details' => $errors], Response::HTTP_BAD_REQUEST);
        }

        $recipe = $this->recipes->findOneBy(['id' => $recipeId, 'household' => $this->household()]);
        if (null === $recipe) {
            return $this->json(['error' => 'Recipe not found'], Response::HTTP_NOT_FOUND);
        }

        // Servings default to the recipe's own count when omitted.
        $servings = \array_key_exists('servings', $data)
            ? max(1, (int) $data['servings'])
            : max(1, $recipe->getServings());

        $meal = (new PlannedMeal())
            ->setRecipe($recipe)
            ->setDate($date)
            ->setServings($servings)
            ->setHousehold($this->household());

        $this->em->persist($meal);
        $this->em->flush();

        return $this->json($this->presenter->plannedMeal($meal), Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'api_planned_meals_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $meal = $this->find($id);
        if ($meal instanceof JsonResponse) {
            return $meal;
        }

        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        if (\array_key_exists('date', $data)) {
            $date = $this->parseDate($data['date']);
            if (null === $date) {
                return $this->json(['error' => 'Validation failed', 'details' => ['date' => 'A valid date (YYYY-MM-DD) is required.']], Response::HTTP_BAD_REQUEST);
            }
            $meal->setDate($date);
        }
        if (\array_key_exists('servings', $data)) {
            $meal->setServings(max(1, (int) $data['servings']));
        }

        $this->em->flush();

        return $this->json($this->presenter->plannedMeal($meal));
    }

    #[Route('/{id}', name: 'api_planned_meals_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id): JsonResponse
    {
        $meal = $this->find($id);
        if ($meal instanceof JsonResponse) {
            return $meal;
        }

        $this->em->remove($meal);
        $this->em->flush();

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Parses a strict `YYYY-MM-DD` date at midnight, or null when invalid.
     */
    private function parseDate(mixed $value): ?\DateTimeImmutable
    {
        if (!\is_string($value) || '' === trim($value)) {
            return null;
        }
        // The leading "!" resets time fields to midnight so the stored date has no time component.
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', trim($value));

        return false === $date ? null : $date;
    }

    private function find(int $id): PlannedMeal|JsonResponse
    {
        $meal = $this->plannedMeals->findOneBy(['id' => $id, 'household' => $this->household()]);
        if (null === $meal) {
            return $this->json(['error' => 'Planned meal not found'], Response::HTTP_NOT_FOUND);
        }

        return $meal;
    }
}

<?php

namespace App\Controller;

use App\Entity\Ingredient;
use App\Repository\IngredientRepository;
use App\Service\EntityPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/ingredients')]
class IngredientController extends AbstractApiController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly IngredientRepository $ingredients,
        private readonly EntityPresenter $presenter,
    ) {
    }

    #[Route('', name: 'api_ingredients_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $items = $this->ingredients->findBy(['household' => $this->household()], ['name' => 'ASC']);
        $usage = $this->ingredients->usageSets($this->household());

        return $this->json(array_map(
            fn (Ingredient $i) => $this->presentWithUsage(
                $i,
                isset($usage['stock'][$i->getId()]),
                isset($usage['recipe'][$i->getId()]),
            ),
            $items,
        ));
    }

    #[Route('', name: 'api_ingredients_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $name = trim((string) ($data['name'] ?? ''));
        if ('' === $name) {
            return $this->json(['error' => 'Validation failed', 'details' => ['name' => 'Name is required.']], Response::HTTP_BAD_REQUEST);
        }

        $ingredient = (new Ingredient())
            ->setName($name)
            ->setDefaultUnit($this->nullableString($data['defaultUnit'] ?? null))
            ->setAlwaysInStock((bool) ($data['alwaysInStock'] ?? false))
            ->setHousehold($this->household());

        $this->em->persist($ingredient);
        $this->em->flush();

        // A brand-new ingredient is never referenced yet.
        return $this->json($this->presentWithUsage($ingredient, false, false), Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'api_ingredients_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function show(int $id): JsonResponse
    {
        $ingredient = $this->find($id);
        if ($ingredient instanceof JsonResponse) {
            return $ingredient;
        }

        return $this->json($this->presentWithUsage(
            $ingredient,
            $this->ingredients->isInStock($ingredient),
            $this->ingredients->isUsedByRecipe($ingredient),
        ));
    }

    #[Route('/{id}', name: 'api_ingredients_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $ingredient = $this->find($id);
        if ($ingredient instanceof JsonResponse) {
            return $ingredient;
        }

        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        if (\array_key_exists('name', $data)) {
            $name = trim((string) $data['name']);
            if ('' === $name) {
                return $this->json(['error' => 'Validation failed', 'details' => ['name' => 'Name is required.']], Response::HTTP_BAD_REQUEST);
            }
            $ingredient->setName($name);
        }
        if (\array_key_exists('defaultUnit', $data)) {
            $ingredient->setDefaultUnit($this->nullableString($data['defaultUnit']));
        }
        if (\array_key_exists('alwaysInStock', $data)) {
            $ingredient->setAlwaysInStock((bool) $data['alwaysInStock']);
        }

        $this->em->flush();

        return $this->json($this->presentWithUsage(
            $ingredient,
            $this->ingredients->isInStock($ingredient),
            $this->ingredients->isUsedByRecipe($ingredient),
        ));
    }

    #[Route('/{id}', name: 'api_ingredients_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id): JsonResponse
    {
        $ingredient = $this->find($id);
        if ($ingredient instanceof JsonResponse) {
            return $ingredient;
        }

        // An ingredient referenced by stock or a recipe can't be removed (the FK
        // is non-nullable). Refuse cleanly with 409 instead of letting the flush
        // raise a foreign-key violation (500). The UI also hides delete via inUse,
        // but this guards direct API calls and the fetch→delete race.
        if ($this->ingredients->isInUse($ingredient)) {
            return $this->json(
                ['error' => 'This ingredient is used by a recipe or your kitchen stock, so it can\'t be deleted.'],
                Response::HTTP_CONFLICT,
            );
        }

        $this->em->remove($ingredient);
        $this->em->flush();

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }

    private function find(int $id): Ingredient|JsonResponse
    {
        $ingredient = $this->ingredients->findOneBy(['id' => $id, 'household' => $this->household()]);
        if (null === $ingredient) {
            return $this->json(['error' => 'Ingredient not found'], Response::HTTP_NOT_FOUND);
        }

        return $ingredient;
    }

    /**
     * Presents an ingredient with usage flags the UI uses to explain, and gate,
     * deletion: whether it's in kitchen stock and/or referenced by a recipe.
     *
     * @return array<string, mixed>
     */
    private function presentWithUsage(Ingredient $ingredient, bool $inKitchen, bool $inRecipes): array
    {
        return $this->presenter->ingredient($ingredient) + [
            'inUse' => $inKitchen || $inRecipes,
            'usedInKitchen' => $inKitchen,
            'usedInRecipes' => $inRecipes,
        ];
    }
}

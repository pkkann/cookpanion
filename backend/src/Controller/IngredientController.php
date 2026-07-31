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

/**
 * Ingredients exist only as the household's recipe-line vocabulary: the recipe
 * form's autocomplete lists them and creates missing ones on save. There is no
 * management UI — only list and create.
 */
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

        return $this->json(array_map($this->presenter->ingredient(...), $items));
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
            ->setHousehold($this->household());

        $this->em->persist($ingredient);
        $this->em->flush();

        return $this->json($this->presenter->ingredient($ingredient), Response::HTTP_CREATED);
    }
}

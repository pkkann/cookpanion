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
            ->setCategory($this->nullableString($data['category'] ?? null))
            ->setDefaultUnit($this->nullableString($data['defaultUnit'] ?? null))
            ->setHousehold($this->household());

        $this->em->persist($ingredient);
        $this->em->flush();

        return $this->json($this->presenter->ingredient($ingredient), Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'api_ingredients_show', methods: ['GET'], requirements: ['id' => '\d+'])]
    public function show(int $id): JsonResponse
    {
        $ingredient = $this->find($id);
        if ($ingredient instanceof JsonResponse) {
            return $ingredient;
        }

        return $this->json($this->presenter->ingredient($ingredient));
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
        if (\array_key_exists('category', $data)) {
            $ingredient->setCategory($this->nullableString($data['category']));
        }
        if (\array_key_exists('defaultUnit', $data)) {
            $ingredient->setDefaultUnit($this->nullableString($data['defaultUnit']));
        }

        $this->em->flush();

        return $this->json($this->presenter->ingredient($ingredient));
    }

    #[Route('/{id}', name: 'api_ingredients_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id): JsonResponse
    {
        $ingredient = $this->find($id);
        if ($ingredient instanceof JsonResponse) {
            return $ingredient;
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
}

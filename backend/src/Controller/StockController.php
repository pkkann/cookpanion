<?php

namespace App\Controller;

use App\Entity\StockItem;
use App\Repository\IngredientRepository;
use App\Repository\StockItemRepository;
use App\Service\EntityPresenter;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/stock')]
class StockController extends AbstractApiController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly StockItemRepository $stock,
        private readonly IngredientRepository $ingredients,
        private readonly EntityPresenter $presenter,
    ) {
    }

    #[Route('', name: 'api_stock_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $items = $this->stock->findBy(['household' => $this->household()], ['id' => 'ASC']);

        return $this->json(array_map($this->presenter->stockItem(...), $items));
    }

    #[Route('', name: 'api_stock_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $ingredientId = (int) ($data['ingredientId'] ?? 0);
        $unit = trim((string) ($data['unit'] ?? ''));
        $errors = [];
        if ($ingredientId <= 0) {
            $errors['ingredientId'] = 'A valid ingredientId is required.';
        }
        if ('' === $unit) {
            $errors['unit'] = 'Unit is required.';
        }
        if ($errors) {
            return $this->json(['error' => 'Validation failed', 'details' => $errors], Response::HTTP_BAD_REQUEST);
        }

        $ingredient = $this->ingredients->findOneBy(['id' => $ingredientId, 'household' => $this->household()]);
        if (null === $ingredient) {
            return $this->json(['error' => 'Ingredient not found'], Response::HTTP_NOT_FOUND);
        }

        // One stock row per ingredient (see API contract).
        if (null !== $this->stock->findOneBy(['ingredient' => $ingredient, 'household' => $this->household()])) {
            return $this->json(['error' => 'Stock item for this ingredient already exists'], Response::HTTP_CONFLICT);
        }

        $item = (new StockItem())
            ->setIngredient($ingredient)
            ->setQuantity((float) ($data['quantity'] ?? 0))
            ->setUnit($unit)
            ->setHousehold($this->household());

        $this->em->persist($item);
        $this->em->flush();

        return $this->json($this->presenter->stockItem($item), Response::HTTP_CREATED);
    }

    #[Route('/{id}', name: 'api_stock_update', methods: ['PUT'], requirements: ['id' => '\d+'])]
    public function update(int $id, Request $request): JsonResponse
    {
        $item = $this->find($id);
        if ($item instanceof JsonResponse) {
            return $item;
        }

        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        if (\array_key_exists('quantity', $data)) {
            $item->setQuantity((float) $data['quantity']);
        }
        if (\array_key_exists('unit', $data)) {
            $unit = trim((string) $data['unit']);
            if ('' === $unit) {
                return $this->json(['error' => 'Validation failed', 'details' => ['unit' => 'Unit is required.']], Response::HTTP_BAD_REQUEST);
            }
            $item->setUnit($unit);
        }

        // A stock row is never kept at zero: editing it down to 0 (or below)
        // removes it from the kitchen, the same as running it out by cooking.
        if ($item->getQuantity() <= 0) {
            $this->em->remove($item);
            $this->em->flush();

            return new JsonResponse(null, Response::HTTP_NO_CONTENT);
        }

        $this->em->flush();

        return $this->json($this->presenter->stockItem($item));
    }

    #[Route('/{id}', name: 'api_stock_delete', methods: ['DELETE'], requirements: ['id' => '\d+'])]
    public function delete(int $id): JsonResponse
    {
        $item = $this->find($id);
        if ($item instanceof JsonResponse) {
            return $item;
        }

        $this->em->remove($item);
        $this->em->flush();

        return new JsonResponse(null, Response::HTTP_NO_CONTENT);
    }

    private function find(int $id): StockItem|JsonResponse
    {
        $item = $this->stock->findOneBy(['id' => $id, 'household' => $this->household()]);
        if (null === $item) {
            return $this->json(['error' => 'Stock item not found'], Response::HTTP_NOT_FOUND);
        }

        return $item;
    }
}

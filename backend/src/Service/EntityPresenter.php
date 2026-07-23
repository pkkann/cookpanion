<?php

namespace App\Service;

use App\Entity\Ingredient;
use App\Entity\PlannedMeal;
use App\Entity\Recipe;
use App\Entity\StockItem;
use App\Entity\User;

/**
 * Maps domain entities to the exact JSON shapes defined in API_CONTRACT.md.
 *
 * Response building is done by hand (rather than via serializer groups) so the
 * payloads match the contract precisely and avoid entity-graph circular references.
 */
final class EntityPresenter
{
    /**
     * @return array{id: int|null, name: string, defaultUnit: string|null}
     */
    public function ingredient(Ingredient $ingredient): array
    {
        return [
            'id' => $ingredient->getId(),
            'name' => $ingredient->getName(),
            'defaultUnit' => $ingredient->getDefaultUnit(),
        ];
    }

    /**
     * @return array{id: int|null, ingredient: array, quantity: float, unit: string}
     */
    public function stockItem(StockItem $item): array
    {
        return [
            'id' => $item->getId(),
            'ingredient' => $this->ingredient($item->getIngredient()),
            'quantity' => $item->getQuantity(),
            'unit' => $item->getUnit(),
        ];
    }

    /**
     * The full user shape used by /register, /login and /me.
     *
     * @return array{id: int|null, email: string, name: string, household: array{id: int|null, name: string, inviteCode: string|null}}
     */
    public function user(User $user): array
    {
        $household = $user->getHousehold();

        return [
            'id' => $user->getId(),
            'email' => $user->getEmail(),
            'name' => $user->getName(),
            'household' => [
                'id' => $household?->getId(),
                'name' => $household?->getName() ?? '',
                'inviteCode' => $household?->getInviteCode(),
            ],
        ];
    }

    public function recipe(Recipe $recipe): array
    {
        $ingredients = [];
        foreach ($recipe->getRecipeIngredients() as $recipeIngredient) {
            $ingredients[] = [
                'ingredient' => $this->ingredient($recipeIngredient->getIngredient()),
                'quantity' => $recipeIngredient->getQuantity(),
                'unit' => $recipeIngredient->getUnit(),
            ];
        }

        $author = $recipe->getAuthor();

        $result = [
            'id' => $recipe->getId(),
            'title' => $recipe->getTitle(),
            'description' => $recipe->getDescription(),
            'instructions' => $recipe->getInstructionSteps(),
            'servings' => $recipe->getServings(),
            'author' => [
                'id' => $author?->getId(),
                'name' => $author?->getName() ?? '',
            ],
            'createdAt' => $recipe->getCreatedAt()->format(\DateTimeInterface::ATOM),
            'ingredients' => $ingredients,
        ];

        return $result;
    }

    /**
     * A planned meal embeds the full recipe so the SPA can aggregate a
     * shopping list across the plan client-side. `date` is date-only.
     */
    public function plannedMeal(PlannedMeal $meal): array
    {
        return [
            'id' => $meal->getId(),
            'date' => $meal->getDate()->format('Y-m-d'),
            'servings' => $meal->getServings(),
            'recipe' => $this->recipe($meal->getRecipe()),
            'createdAt' => $meal->getCreatedAt()->format(\DateTimeInterface::ATOM),
        ];
    }
}

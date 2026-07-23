<?php

namespace App\Repository;

use App\Entity\Household;
use App\Entity\Ingredient;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Ingredient>
 */
class IngredientRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Ingredient::class);
    }

    /**
     * Per-ingredient usage for the household, split by source: which ingredients
     * are in kitchen stock and which are referenced by a recipe. Two queries
     * total, so the ingredients list stays a fixed number of queries regardless
     * of size.
     *
     * @return array{stock: array<int, true>, recipe: array<int, true>} sets keyed by ingredient id
     */
    public function usageSets(Household $household): array
    {
        $em = $this->getEntityManager();

        $stockIds = $em->createQuery(
            'SELECT DISTINCT IDENTITY(s.ingredient) FROM App\Entity\StockItem s WHERE s.household = :h'
        )->setParameter('h', $household)->getSingleColumnResult();

        $recipeIds = $em->createQuery(
            'SELECT DISTINCT IDENTITY(ri.ingredient) FROM App\Entity\RecipeIngredient ri JOIN ri.recipe r WHERE r.household = :h'
        )->setParameter('h', $household)->getSingleColumnResult();

        $toSet = static function (array $ids): array {
            $set = [];
            foreach ($ids as $id) {
                $set[(int) $id] = true;
            }

            return $set;
        };

        return ['stock' => $toSet($stockIds), 'recipe' => $toSet($recipeIds)];
    }

    /** Whether an ingredient currently has a kitchen stock row. */
    public function isInStock(Ingredient $ingredient): bool
    {
        return (int) $this->getEntityManager()->createQuery(
            'SELECT COUNT(s.id) FROM App\Entity\StockItem s WHERE s.ingredient = :i'
        )->setParameter('i', $ingredient)->getSingleScalarResult() > 0;
    }

    /** Whether an ingredient is referenced by any recipe. */
    public function isUsedByRecipe(Ingredient $ingredient): bool
    {
        return (int) $this->getEntityManager()->createQuery(
            'SELECT COUNT(ri.id) FROM App\Entity\RecipeIngredient ri WHERE ri.ingredient = :i'
        )->setParameter('i', $ingredient)->getSingleScalarResult() > 0;
    }

    /** Whether a single ingredient is referenced by kitchen stock or a recipe. */
    public function isInUse(Ingredient $ingredient): bool
    {
        return $this->isInStock($ingredient) || $this->isUsedByRecipe($ingredient);
    }
}

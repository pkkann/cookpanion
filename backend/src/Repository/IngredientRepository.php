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
     * IDs of the household's ingredients that are referenced by kitchen stock
     * or by any recipe — i.e. those that cannot be deleted. One query each, so
     * the ingredients list stays a fixed number of queries regardless of size.
     *
     * @return array<int, true> set keyed by ingredient id for O(1) lookup
     */
    public function usedIdSet(Household $household): array
    {
        $em = $this->getEntityManager();

        $stockIds = $em->createQuery(
            'SELECT DISTINCT IDENTITY(s.ingredient) FROM App\Entity\StockItem s WHERE s.household = :h'
        )->setParameter('h', $household)->getSingleColumnResult();

        $recipeIds = $em->createQuery(
            'SELECT DISTINCT IDENTITY(ri.ingredient) FROM App\Entity\RecipeIngredient ri JOIN ri.recipe r WHERE r.household = :h'
        )->setParameter('h', $household)->getSingleColumnResult();

        $set = [];
        foreach ([...$stockIds, ...$recipeIds] as $id) {
            $set[(int) $id] = true;
        }

        return $set;
    }

    /** Whether a single ingredient is referenced by kitchen stock or a recipe. */
    public function isInUse(Ingredient $ingredient): bool
    {
        $em = $this->getEntityManager();

        $inStock = (int) $em->createQuery(
            'SELECT COUNT(s.id) FROM App\Entity\StockItem s WHERE s.ingredient = :i'
        )->setParameter('i', $ingredient)->getSingleScalarResult();
        if ($inStock > 0) {
            return true;
        }

        $inRecipe = (int) $em->createQuery(
            'SELECT COUNT(ri.id) FROM App\Entity\RecipeIngredient ri WHERE ri.ingredient = :i'
        )->setParameter('i', $ingredient)->getSingleScalarResult();

        return $inRecipe > 0;
    }
}

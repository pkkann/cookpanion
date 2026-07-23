<?php

namespace App\DataFixtures;

use App\Entity\Household;
use App\Entity\Ingredient;
use App\Entity\Recipe;
use App\Entity\RecipeIngredient;
use App\Entity\StockItem;
use App\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

class AppFixtures extends Fixture
{
    public function __construct(
        private readonly UserPasswordHasherInterface $passwordHasher,
    ) {
    }

    public function load(ObjectManager $manager): void
    {
        $household = (new Household())->setName('Demo Kitchen')->setInviteCode('demokitchen');
        $manager->persist($household);

        $user = (new User())
            ->setEmail('demo@recipe.ai')
            ->setName('Demo Cook')
            ->setHousehold($household);
        $user->setPassword($this->passwordHasher->hashPassword($user, 'demo1234'));
        $manager->persist($user);

        // ingredient name => defaultUnit
        $catalog = [
            'Eggs' => 'pcs',
            'Flour' => 'g',
            'Milk' => 'ml',
            'Butter' => 'g',
            'Tomato' => 'pcs',
            'Onion' => 'pcs',
            'Pasta' => 'g',
            'Chicken breast' => 'g',
            'Rice' => 'g',
            'Cheese' => 'g',
        ];

        /** @var array<string, Ingredient> $ingredients */
        $ingredients = [];
        foreach ($catalog as $name => $unit) {
            $ingredient = (new Ingredient())
                ->setName($name)
                ->setDefaultUnit($unit)
                ->setHousehold($household);
            $manager->persist($ingredient);
            $ingredients[$name] = $ingredient;
        }

        // Kitchen stock (a subset, with quantities).
        $stock = [
            'Eggs' => [6, 'pcs'],
            'Flour' => [1000, 'g'],
            'Milk' => [500, 'ml'],
            'Butter' => [250, 'g'],
            'Tomato' => [4, 'pcs'],
            'Onion' => [3, 'pcs'],
            'Pasta' => [500, 'g'],
            'Cheese' => [200, 'g'],
        ];
        foreach ($stock as $name => [$quantity, $unit]) {
            $item = (new StockItem())
                ->setIngredient($ingredients[$name])
                ->setQuantity((float) $quantity)
                ->setUnit($unit)
                ->setHousehold($household);
            $manager->persist($item);
        }

        $this->createRecipe(
            $manager,
            $household,
            $user,
            'Classic Pancakes',
            'Fluffy breakfast pancakes made from pantry staples.',
            "1. Whisk flour, eggs and milk into a smooth batter.\n2. Melt a little butter in a pan over medium heat.\n3. Pour in batter and cook until golden on both sides.\n4. Serve warm.",
            4,
            10,
            15,
            [
                ['Flour', 250, 'g'],
                ['Eggs', 2, 'pcs'],
                ['Milk', 300, 'ml'],
                ['Butter', 20, 'g'],
            ],
            $ingredients,
        );

        $this->createRecipe(
            $manager,
            $household,
            $user,
            'Tomato Pasta',
            'A quick weeknight pasta with a simple tomato and onion sauce.',
            "1. Cook the pasta in salted boiling water until al dente.\n2. Sauté chopped onion and tomato in butter.\n3. Toss the drained pasta with the sauce.\n4. Top with grated cheese and serve.",
            2,
            10,
            20,
            [
                ['Pasta', 200, 'g'],
                ['Tomato', 3, 'pcs'],
                ['Onion', 1, 'pcs'],
                ['Cheese', 50, 'g'],
            ],
            $ingredients,
        );

        $manager->flush();
    }

    /**
     * @param array<int, array{0: string, 1: int|float, 2: string}> $lines
     * @param array<string, Ingredient>                             $ingredients
     */
    private function createRecipe(
        ObjectManager $manager,
        Household $household,
        User $author,
        string $title,
        string $description,
        string $instructions,
        int $servings,
        int $prepTimeMinutes,
        int $cookTimeMinutes,
        array $lines,
        array $ingredients,
    ): void {
        $recipe = (new Recipe())
            ->setTitle($title)
            ->setDescription($description)
            ->setInstructions($instructions)
            ->setServings($servings)
            ->setPrepTimeMinutes($prepTimeMinutes)
            ->setCookTimeMinutes($cookTimeMinutes)
            ->setAuthor($author)
            ->setHousehold($household);

        foreach ($lines as [$name, $quantity, $unit]) {
            $recipeIngredient = (new RecipeIngredient())
                ->setIngredient($ingredients[$name])
                ->setQuantity((float) $quantity)
                ->setUnit($unit);
            $recipe->addRecipeIngredient($recipeIngredient);
        }

        $manager->persist($recipe);
    }
}

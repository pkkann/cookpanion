<?php

namespace App\Entity;

use App\Repository\RecipeRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: RecipeRepository::class)]
class Recipe
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private string $title;

    #[ORM\Column(type: 'text')]
    private string $description = '';

    #[ORM\Column(type: 'text')]
    private string $instructions = '';

    #[ORM\Column]
    private int $servings = 1;

    /**
     * Cached AI translations of the recipe's human-readable content, keyed by
     * locale: `{ "da": { title, description, instructions[], ingredientNames{id:name} } }`.
     * Cleared whenever the recipe is edited.
     *
     * @var array<string, array<string, mixed>>|null
     */
    #[ORM\Column(type: 'json', nullable: true)]
    private ?array $translations = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false)]
    private ?User $author = null;

    #[ORM\ManyToOne(targetEntity: Household::class)]
    #[ORM\JoinColumn(nullable: false)]
    private ?Household $household = null;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    /**
     * @var Collection<int, RecipeIngredient>
     */
    #[ORM\OneToMany(mappedBy: 'recipe', targetEntity: RecipeIngredient::class, cascade: ['persist', 'remove'], orphanRemoval: true)]
    private Collection $recipeIngredients;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->recipeIngredients = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function setTitle(string $title): static
    {
        $this->title = $title;

        return $this;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): static
    {
        $this->description = $description;

        return $this;
    }

    public function getInstructions(): string
    {
        return $this->instructions;
    }

    public function setInstructions(string $instructions): static
    {
        $this->instructions = $instructions;

        return $this;
    }

    /**
     * Instructions exposed as an ordered list of steps. Stored newline-joined in
     * the underlying text column.
     *
     * @return list<string>
     */
    public function getInstructionSteps(): array
    {
        return self::splitSteps($this->instructions);
    }

    /**
     * @param list<string> $steps
     */
    public function setInstructionSteps(array $steps): static
    {
        $clean = [];
        foreach ($steps as $step) {
            $step = trim((string) $step);
            if ('' !== $step) {
                $clean[] = $step;
            }
        }
        $this->instructions = implode("\n", $clean);

        return $this;
    }

    /**
     * Splits stored instructions into steps. Prefers explicit line breaks; falls
     * back to inline "1. " / "2) " numbering so legacy single-line recipes still
     * render as multiple steps. Any leading marker is stripped.
     *
     * @return list<string>
     */
    private static function splitSteps(string $text): array
    {
        $text = trim($text);
        if ('' === $text) {
            return [];
        }

        $byLines = array_values(array_filter(
            array_map(static fn (string $l): string => self::stripMarker(trim($l)), preg_split('/\r?\n+/', $text) ?: []),
            static fn (string $l): bool => '' !== $l,
        ));
        if (\count($byLines) > 1) {
            return $byLines;
        }

        $byNumbers = array_values(array_filter(
            array_map('trim', preg_split('/\s*\d+[.)]\s+/', $text) ?: []),
            static fn (string $s): bool => '' !== $s,
        ));
        if (\count($byNumbers) > 1) {
            return $byNumbers;
        }

        return [self::stripMarker($text)];
    }

    private static function stripMarker(string $line): string
    {
        return trim(preg_replace('/^\s*\d+[.)]\s+/', '', $line) ?? $line);
    }

    /**
     * @return array<string, array<string, mixed>>|null
     */
    public function getTranslations(): ?array
    {
        return $this->translations;
    }

    /**
     * @param array<string, array<string, mixed>>|null $translations
     */
    public function setTranslations(?array $translations): static
    {
        $this->translations = $translations;

        return $this;
    }

    public function getServings(): int
    {
        return $this->servings;
    }

    public function setServings(int $servings): static
    {
        $this->servings = $servings;

        return $this;
    }

    public function getAuthor(): ?User
    {
        return $this->author;
    }

    public function setAuthor(?User $author): static
    {
        $this->author = $author;

        return $this;
    }

    public function getHousehold(): ?Household
    {
        return $this->household;
    }

    public function setHousehold(?Household $household): static
    {
        $this->household = $household;

        return $this;
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function setCreatedAt(\DateTimeImmutable $createdAt): static
    {
        $this->createdAt = $createdAt;

        return $this;
    }

    /**
     * @return Collection<int, RecipeIngredient>
     */
    public function getRecipeIngredients(): Collection
    {
        return $this->recipeIngredients;
    }

    public function addRecipeIngredient(RecipeIngredient $recipeIngredient): static
    {
        if (!$this->recipeIngredients->contains($recipeIngredient)) {
            $this->recipeIngredients->add($recipeIngredient);
            $recipeIngredient->setRecipe($this);
        }

        return $this;
    }

    public function removeRecipeIngredient(RecipeIngredient $recipeIngredient): static
    {
        $this->recipeIngredients->removeElement($recipeIngredient);

        return $this;
    }

    public function clearRecipeIngredients(): void
    {
        $this->recipeIngredients->clear();
    }
}

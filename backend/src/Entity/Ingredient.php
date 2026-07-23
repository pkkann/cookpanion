<?php

namespace App\Entity;

use App\Repository\IngredientRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: IngredientRepository::class)]
class Ingredient
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    private string $name;

    #[ORM\Column(length: 32, nullable: true)]
    private ?string $defaultUnit = null;

    /**
     * A pantry staple the household treats as never running out (e.g. water,
     * salt). Such ingredients always count as available and are never added to
     * a shopping list or deducted when cooking.
     */
    #[ORM\Column(options: ['default' => false])]
    private bool $alwaysInStock = false;

    #[ORM\ManyToOne(targetEntity: Household::class)]
    #[ORM\JoinColumn(nullable: false)]
    private ?Household $household = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function getDefaultUnit(): ?string
    {
        return $this->defaultUnit;
    }

    public function setDefaultUnit(?string $defaultUnit): static
    {
        $this->defaultUnit = $defaultUnit;

        return $this;
    }

    public function isAlwaysInStock(): bool
    {
        return $this->alwaysInStock;
    }

    public function setAlwaysInStock(bool $alwaysInStock): static
    {
        $this->alwaysInStock = $alwaysInStock;

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
}

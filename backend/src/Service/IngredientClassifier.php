<?php

namespace App\Service;

use Psr\Log\LoggerInterface;
use Symfony\AI\Agent\AgentInterface;
use Symfony\AI\Platform\Message\Message;
use Symfony\AI\Platform\Message\MessageBag;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Uses the AI agent to assign an ingredient to one of a fixed set of categories.
 *
 * Classification is best-effort: it never throws. When the AI is not configured
 * or the call fails, {@see classify()} returns null and the ingredient is simply
 * left uncategorized.
 */
final class IngredientClassifier
{
    /**
     * The canonical set of categories the model must choose from. Kept in sync
     * with the seed data in AppFixtures.
     *
     * @var list<string>
     */
    private const CATEGORIES = [
        'Produce',
        'Dairy & Eggs',
        'Meat & Seafood',
        'Bakery',
        'Baking',
        'Pantry',
        'Spices & Herbs',
        'Condiments & Sauces',
        'Frozen',
        'Beverages',
        'Snacks',
        'Other',
    ];

    public function __construct(
        // The "recipe" agent configured in config/packages/ai.yaml.
        #[Autowire(service: 'ai.agent.recipe')]
        private readonly AgentInterface $recipeAgent,
        #[Autowire('%env(ANTHROPIC_API_KEY)%')]
        private readonly string $anthropicApiKey,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * Returns the best-matching category for the given ingredient name, or null
     * if the AI is unavailable, the call fails, or the response is unusable.
     */
    public function classify(string $name): ?string
    {
        $name = trim($name);
        if ('' === $name) {
            return null;
        }

        // Stay fully runnable without a key: never touch the platform.
        if ('' === trim($this->anthropicApiKey)) {
            return null;
        }

        try {
            $messages = new MessageBag(
                Message::forSystem('You classify grocery ingredients. Respond ONLY with a single valid JSON object of the form {"category": "..."}. No markdown, no code fences, no commentary.'),
                Message::ofUser($this->buildPrompt($name)),
            );

            $result = $this->recipeAgent->call($messages);
            $content = $result->getContent();
        } catch (\Throwable $e) {
            $this->logger->error('AI ingredient classification failed', ['exception' => $e]);

            return null;
        }

        return $this->parseCategory(\is_string($content) ? $content : '');
    }

    private function buildPrompt(string $name): string
    {
        $categories = implode("\n", array_map(static fn (string $c): string => '- '.$c, self::CATEGORIES));

        return <<<PROMPT
        Assign the ingredient below to the single best-matching category.

        Ingredient: {$name}

        Choose exactly one category from this list (use "Other" if none fit):
        {$categories}

        Return ONLY a JSON object exactly matching this schema (no extra keys, no prose, no markdown):
        {"category": "string"}
        PROMPT;
    }

    /**
     * Extracts the category from a model text response and validates it against
     * the allowed set. Returns null when the value is missing or unrecognized.
     */
    private function parseCategory(string $content): ?string
    {
        $json = $this->extractJsonObject(trim($content));
        if (null === $json) {
            return null;
        }

        try {
            $decoded = json_decode($json, true, 512, \JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }

        if (!\is_array($decoded) || !isset($decoded['category']) || !\is_string($decoded['category'])) {
            return null;
        }

        $category = trim($decoded['category']);

        return \in_array($category, self::CATEGORIES, true) ? $category : null;
    }

    /**
     * Extracts the outermost JSON object from a text response, tolerating code
     * fences or surrounding prose. Mirrors AiController's extraction.
     */
    private function extractJsonObject(string $content): ?string
    {
        if (str_starts_with($content, '```')) {
            $content = preg_replace('/^```(?:json)?\s*/i', '', $content) ?? $content;
            $content = preg_replace('/\s*```$/', '', $content) ?? $content;
        }

        $start = strpos($content, '{');
        $end = strrpos($content, '}');
        if (false === $start || false === $end || $end < $start) {
            return null;
        }

        return substr($content, $start, $end - $start + 1);
    }
}

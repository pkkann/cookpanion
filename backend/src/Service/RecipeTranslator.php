<?php

namespace App\Service;

use Psr\Log\LoggerInterface;
use Symfony\AI\Agent\AgentInterface;
use Symfony\AI\Platform\Message\Message;
use Symfony\AI\Platform\Message\MessageBag;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Translates a recipe's human-readable content into another language via the AI
 * agent. Display-only: ingredient identity/units are unaffected. Returns null on
 * failure so the caller can surface a clean error.
 */
final class RecipeTranslator
{
    public function __construct(
        // The "recipe" agent configured in config/packages/ai.yaml.
        #[Autowire(service: 'ai.agent.recipe')]
        private readonly AgentInterface $recipeAgent,
        #[Autowire('%env(ANTHROPIC_API_KEY)%')]
        private readonly string $anthropicApiKey,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function isConfigured(): bool
    {
        return '' !== trim($this->anthropicApiKey);
    }

    /**
     * @param list<string>                     $instructions
     * @param list<array{id: int, name: string}> $ingredients
     *
     * @return array{title: string, description: string, instructions: list<string>, ingredientNames: array<string, string>}|null
     */
    public function translate(string $title, string $description, array $instructions, array $ingredients, string $language): ?array
    {
        $source = json_encode(
            ['title' => $title, 'description' => $description, 'instructions' => $instructions, 'ingredients' => $ingredients],
            \JSON_UNESCAPED_UNICODE | \JSON_UNESCAPED_SLASHES,
        );

        try {
            $messages = new MessageBag(
                Message::forSystem('You are a translator. Respond ONLY with a single valid JSON object. No markdown, no code fences, no commentary.'),
                Message::ofUser($this->buildPrompt($source, $language)),
            );

            $result = $this->recipeAgent->call($messages, ['max_tokens' => 4096]);
            $content = $result->getContent();
        } catch (\Throwable $e) {
            $this->logger->error('AI recipe translation failed', ['exception' => $e]);

            return null;
        }

        return $this->parse(\is_string($content) ? $content : '');
    }

    private function buildPrompt(string $source, string $language): string
    {
        return <<<PROMPT
        Translate this recipe into {$language}. Translate every human-readable string: the title, the description, each instruction step, and each ingredient name. Keep the JSON structure and every ingredient "id" value exactly as given, and keep the same number of instruction steps.

        Recipe:
        {$source}

        Return ONLY a JSON object with exactly this shape (same ids), no markdown:
        {"title": "string", "description": "string", "instructions": ["string"], "ingredients": [ {"id": 0, "name": "string"} ]}
        PROMPT;
    }

    /**
     * @return array{title: string, description: string, instructions: list<string>, ingredientNames: array<string, string>}|null
     */
    private function parse(string $content): ?array
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

        if (!\is_array($decoded)) {
            return null;
        }

        $instructions = [];
        foreach ((array) ($decoded['instructions'] ?? []) as $step) {
            if (\is_string($step) && '' !== trim($step)) {
                $instructions[] = trim($step);
            }
        }

        $ingredientNames = [];
        foreach ((array) ($decoded['ingredients'] ?? []) as $ing) {
            if (\is_array($ing) && isset($ing['id']) && isset($ing['name'])) {
                $ingredientNames[(string) $ing['id']] = (string) $ing['name'];
            }
        }

        return [
            'title' => (string) ($decoded['title'] ?? ''),
            'description' => (string) ($decoded['description'] ?? ''),
            'instructions' => $instructions,
            'ingredientNames' => $ingredientNames,
        ];
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

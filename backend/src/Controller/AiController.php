<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\IngredientRepository;
use App\Repository\StockItemRepository;
use Psr\Log\LoggerInterface;
use Symfony\AI\Agent\AgentInterface;
use Symfony\AI\Platform\Message\Message;
use Symfony\AI\Platform\Message\MessageBag;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/ai')]
class AiController extends AbstractApiController
{
    public function __construct(
        private readonly StockItemRepository $stock,
        private readonly IngredientRepository $ingredients,
        // The "recipe" agent configured in config/packages/ai.yaml.
        #[Autowire(service: 'ai.agent.recipe')]
        private readonly AgentInterface $recipeAgent,
        #[Autowire('%env(ANTHROPIC_API_KEY)%')]
        private readonly string $anthropicApiKey,
        private readonly LoggerInterface $logger,
    ) {
    }

    #[Route('/suggest-recipes', name: 'api_ai_suggest_recipes', methods: ['POST'])]
    public function suggestRecipes(Request $request): JsonResponse
    {
        // Stay fully runnable without a key: short-circuit before touching the platform.
        if ('' === trim($this->anthropicApiKey)) {
            return $this->json(['error' => 'AI is not configured. Add ANTHROPIC_API_KEY.'], Response::HTTP_SERVICE_UNAVAILABLE);
        }

        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $mode = 'all' === ($data['mode'] ?? 'kitchen') ? 'all' : 'kitchen';
        $maxToBuy = max(0, (int) ($data['maxToBuy'] ?? 0));
        $preferences = trim((string) ($data['preferences'] ?? ''));

        $available = $this->availableIngredients($mode);
        if ([] === $available) {
            // Nothing to cook with; return an empty, contract-shaped result.
            return $this->json(['suggestions' => []]);
        }

        $userPrompt = $this->buildPrompt($mode, $available, $maxToBuy, $preferences);

        try {
            $messages = new MessageBag(
                Message::forSystem('Respond ONLY with a single valid JSON object. No markdown, no code fences, no commentary.'.$this->languageInstruction()),
                Message::ofUser($userPrompt),
            );

            // The platform defaults max_tokens to 1000, which truncates a 3-recipe
            // JSON response mid-object; raise it so the JSON can complete.
            $result = $this->recipeAgent->call($messages, ['max_tokens' => 4096]);
            $content = $result->getContent();
        } catch (\Throwable $e) {
            $this->logger->error('AI recipe suggestion failed', ['exception' => $e]);

            return $this->json(['error' => 'AI request failed. Please try again later.'], Response::HTTP_BAD_GATEWAY);
        }

        $suggestions = $this->parseSuggestions(\is_string($content) ? $content : '');
        if (null === $suggestions) {
            $this->logger->error('Could not parse AI response as JSON', ['content' => $content]);

            return $this->json(['error' => 'AI returned an unexpected response.'], Response::HTTP_BAD_GATEWAY);
        }

        return $this->json(['suggestions' => $suggestions]);
    }

    /**
     * A system-prompt addendum instructing the model to respond in the user's
     * chosen language. Empty for English (the schema/prompt are already English).
     */
    private function languageInstruction(): string
    {
        /** @var User $user */
        $user = $this->getUser();

        $languages = [
            'da' => 'Danish',
        ];

        $language = $languages[$user->getLocale()] ?? null;
        if (null === $language) {
            return '';
        }

        return \sprintf(
            ' Write every human-readable string value (title, description, instructions, and ingredient names) in %s. Keep all JSON keys exactly as specified in English.',
            $language,
        );
    }

    /**
     * @return list<array{name: string, quantity: float|null, unit: string|null}>
     */
    private function availableIngredients(string $mode): array
    {
        $household = $this->household();
        $list = [];

        if ('kitchen' === $mode) {
            foreach ($this->stock->findBy(['household' => $household]) as $item) {
                $list[] = [
                    'name' => $item->getIngredient()->getName(),
                    'quantity' => $item->getQuantity(),
                    'unit' => $item->getUnit(),
                ];
            }

            return $list;
        }

        foreach ($this->ingredients->findBy(['household' => $household], ['name' => 'ASC']) as $ingredient) {
            $list[] = [
                'name' => $ingredient->getName(),
                'quantity' => null,
                'unit' => $ingredient->getDefaultUnit(),
            ];
        }

        return $list;
    }

    /**
     * @param list<array{name: string, quantity: float|null, unit: string|null}> $available
     */
    private function buildPrompt(string $mode, array $available, int $maxToBuy, string $preferences): string
    {
        $modeText = 'kitchen' === $mode
            ? 'Only the ingredients currently in stock (with quantities) are listed below.'
            : 'All ingredients known to this household are listed below (quantities are not tracked).';

        $lines = [];
        foreach ($available as $entry) {
            $qty = null !== $entry['quantity'] ? rtrim(rtrim(number_format($entry['quantity'], 2, '.', ''), '0'), '.') : null;
            $unit = $entry['unit'] ?? '';
            $suffix = null !== $qty ? \sprintf(' (%s %s)', $qty, $unit) : ('' !== $unit ? \sprintf(' (unit: %s)', $unit) : '');
            $lines[] = '- '.$entry['name'].$suffix;
        }

        $schema = <<<'JSON'
        {
          "suggestions": [
            {
              "title": "string",
              "description": "string",
              "servings": 2,
              "instructions": "string",
              "usesIngredients": [ { "name": "string", "quantity": 0, "unit": "string" } ],
              "toBuy": [ { "name": "string", "quantity": 0, "unit": "string" } ]
            }
          ]
        }
        JSON;

        $prefText = '' !== $preferences ? $preferences : 'none';

        return <<<PROMPT
        Suggest 3 practical recipes.

        Mode: {$mode}. {$modeText}
        You may include AT MOST {$maxToBuy} extra ingredient(s) that are NOT in the list below; put those in each recipe's "toBuy". If maxToBuy is 0, every ingredient used must come from the list.
        Dietary preferences / constraints: {$prefText}.

        Available ingredients:
        {$this->joinLines($lines)}

        Return ONLY a JSON object exactly matching this schema (no extra keys, no prose, no markdown):
        {$schema}

        Rules:
        - "usesIngredients" lists ingredients taken from the available list, with realistic quantities and units.
        - "toBuy" lists any extra ingredients (respecting the maxToBuy limit).
        - "servings" is an integer.
        - "instructions" is a concise step-by-step string.
        PROMPT;
    }

    /**
     * @param list<string> $lines
     */
    private function joinLines(array $lines): string
    {
        return implode("\n", $lines);
    }

    /**
     * Extracts and validates the "suggestions" array from a model text response.
     * Tolerates code fences or surrounding prose by extracting the outermost JSON object.
     *
     * @return list<array<string, mixed>>|null
     */
    private function parseSuggestions(string $content): ?array
    {
        $content = trim($content);
        if ('' === $content) {
            return null;
        }

        $json = $this->extractJsonObject($content);
        if (null === $json) {
            return null;
        }

        try {
            $decoded = json_decode($json, true, 512, \JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }

        if (!\is_array($decoded) || !isset($decoded['suggestions']) || !\is_array($decoded['suggestions'])) {
            return null;
        }

        $out = [];
        foreach ($decoded['suggestions'] as $s) {
            if (!\is_array($s)) {
                continue;
            }
            $out[] = [
                'title' => (string) ($s['title'] ?? ''),
                'description' => (string) ($s['description'] ?? ''),
                'servings' => (int) ($s['servings'] ?? 1),
                'instructions' => (string) ($s['instructions'] ?? ''),
                'usesIngredients' => $this->normalizeLines($s['usesIngredients'] ?? []),
                'toBuy' => $this->normalizeLines($s['toBuy'] ?? []),
            ];
        }

        return $out;
    }

    /**
     * @return list<array{name: string, quantity: float, unit: string}>
     */
    private function normalizeLines(mixed $lines): array
    {
        if (!\is_array($lines)) {
            return [];
        }

        $out = [];
        foreach ($lines as $line) {
            if (!\is_array($line)) {
                continue;
            }
            $out[] = [
                'name' => (string) ($line['name'] ?? ''),
                'quantity' => (float) ($line['quantity'] ?? 0),
                'unit' => (string) ($line['unit'] ?? ''),
            ];
        }

        return $out;
    }

    private function extractJsonObject(string $content): ?string
    {
        // Strip a leading ```json / ``` fence and trailing ``` if present.
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

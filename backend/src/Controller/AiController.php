<?php

namespace App\Controller;

use App\Repository\IngredientRepository;
use App\Repository\StockItemRepository;
use Psr\Log\LoggerInterface;
use Symfony\AI\Agent\AgentInterface;
use Symfony\AI\Platform\Message\Content\Image;
use Symfony\AI\Platform\Message\Content\Text;
use Symfony\AI\Platform\Message\Message;
use Symfony\AI\Platform\Message\MessageBag;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

#[Route('/api/ai')]
class AiController extends AbstractApiController
{
    /** Cap on characters of source content sent to the model when importing. */
    private const IMPORT_MAX_CHARS = 12000;

    /** Cap on the length of an image data URL (base64), ~7 MB. */
    private const IMPORT_MAX_IMAGE_CHARS = 7_000_000;

    public function __construct(
        private readonly StockItemRepository $stock,
        private readonly IngredientRepository $ingredients,
        // The "recipe" agent configured in config/packages/ai.yaml.
        #[Autowire(service: 'ai.agent.recipe')]
        private readonly AgentInterface $recipeAgent,
        #[Autowire('%env(ANTHROPIC_API_KEY)%')]
        private readonly string $anthropicApiKey,
        private readonly LoggerInterface $logger,
        private readonly HttpClientInterface $httpClient,
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

        $requestedMode = (string) ($data['mode'] ?? 'kitchen');
        $mode = \in_array($requestedMode, ['kitchen', 'all', 'surprise'], true) ? $requestedMode : 'kitchen';
        $preferences = trim((string) ($data['preferences'] ?? ''));
        $count = max(1, min(8, (int) ($data['count'] ?? 3)));
        // Target servings every recipe should be sized for.
        $servings = max(1, min(20, (int) ($data['servings'] ?? 2)));
        // Upper bound on prep + cook time in minutes; 0 means no limit.
        $maxTimeMinutes = max(0, min(600, (int) ($data['maxTimeMinutes'] ?? 0)));

        if ('surprise' === $mode) {
            // Ignore the household entirely: propose recipes from scratch, sized to
            // a chosen ingredient count. No ingredient lookup, no empty short-circuit.
            $numIngredients = max(2, min(20, (int) ($data['numIngredients'] ?? 6)));
            $userPrompt = $this->buildSurprisePrompt($count, $numIngredients, $preferences, $servings, $maxTimeMinutes);
        } else {
            $maxToBuy = max(0, (int) ($data['maxToBuy'] ?? 0));

            $available = $this->availableIngredients($mode);
            if ([] === $available) {
                // Nothing to cook with; return an empty, contract-shaped result.
                return $this->json(['suggestions' => []]);
            }

            $userPrompt = $this->buildPrompt($mode, $available, $maxToBuy, $preferences, $count, $servings, $maxTimeMinutes);
        }

        try {
            $messages = new MessageBag(
                Message::forSystem('Respond ONLY with a single valid JSON object. No markdown, no code fences, no commentary.'),
                Message::ofUser($userPrompt),
            );

            // The platform defaults max_tokens to 1000, which truncates a multi-recipe
            // JSON response mid-object; scale the budget with the requested count so
            // the JSON can complete.
            $result = $this->recipeAgent->call($messages, ['max_tokens' => min(8192, max(4096, $count * 1400))]);
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
     * Builds a recipe from a pasted URL or block of text. Fetches and strips the
     * page when a URL is given, then asks the AI to extract a single structured
     * recipe. The result is always in English (translated when the source isn't).
     */
    #[Route('/import-recipe', name: 'api_ai_import_recipe', methods: ['POST'])]
    public function importRecipe(Request $request): JsonResponse
    {
        if ('' === trim($this->anthropicApiKey)) {
            return $this->json(['error' => 'AI is not configured. Add ANTHROPIC_API_KEY.'], Response::HTTP_SERVICE_UNAVAILABLE);
        }

        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $text = trim((string) ($data['text'] ?? ''));
        $url = trim((string) ($data['url'] ?? ''));
        $image = trim((string) ($data['image'] ?? ''));

        if ('' === $text && '' === $url && '' === $image) {
            return $this->json(
                ['error' => 'Validation failed', 'details' => ['source' => 'Provide a URL, text, or image to import from.']],
                Response::HTTP_BAD_REQUEST,
            );
        }

        // Precedence when several are present: pasted text, then image, then URL.
        if ('' !== $text) {
            $userMessage = Message::ofUser($this->buildImportPrompt(mb_substr($text, 0, self::IMPORT_MAX_CHARS)));
        } elseif ('' !== $image) {
            $imageContent = $this->imageFromDataUrl($image);
            if ($imageContent instanceof JsonResponse) {
                return $imageContent;
            }
            $userMessage = Message::ofUser(new Text($this->buildImagePrompt()), $imageContent);
        } else {
            $source = $this->fetchUrlText($url);
            if ($source instanceof JsonResponse) {
                return $source;
            }
            $userMessage = Message::ofUser($this->buildImportPrompt(mb_substr($source, 0, self::IMPORT_MAX_CHARS)));
        }

        try {
            $messages = new MessageBag(
                Message::forSystem('You extract a single recipe from the provided content and respond ONLY with a single valid JSON object. No markdown, no code fences, no commentary.'),
                $userMessage,
            );
            $result = $this->recipeAgent->call($messages, ['max_tokens' => 4096]);
            $content = $result->getContent();
        } catch (\Throwable $e) {
            $this->logger->error('AI recipe import failed', ['exception' => $e]);

            return $this->json(['error' => 'AI request failed. Please try again later.'], Response::HTTP_BAD_GATEWAY);
        }

        $recipe = $this->parseImportedRecipe(\is_string($content) ? $content : '');
        if (null === $recipe) {
            return $this->json(['error' => "Couldn't find a recipe in that content."], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return $this->json(['recipe' => $recipe]);
    }

    /**
     * Fetches a URL and reduces it to readable text, or returns an error response.
     */
    private function fetchUrlText(string $url): string|JsonResponse
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = (string) ($parts['host'] ?? '');
        if (!\in_array($scheme, ['http', 'https'], true) || '' === $host) {
            return $this->json(
                ['error' => 'Validation failed', 'details' => ['url' => 'Enter a valid http(s) URL.']],
                Response::HTTP_BAD_REQUEST,
            );
        }
        // Basic SSRF guard: never let the server fetch localhost or private/reserved IPs.
        if ($this->isBlockedHost($host)) {
            return $this->json(
                ['error' => 'Validation failed', 'details' => ['url' => 'That URL is not allowed.']],
                Response::HTTP_BAD_REQUEST,
            );
        }

        try {
            $response = $this->httpClient->request('GET', $url, [
                'timeout' => 10,
                'max_duration' => 15,
                'max_redirects' => 3,
                'headers' => ['User-Agent' => 'CookpanionRecipeImporter/1.0'],
            ]);
            if ($response->getStatusCode() >= 400) {
                return $this->json(['error' => 'Could not fetch that URL.'], Response::HTTP_BAD_GATEWAY);
            }
            $html = $response->getContent(false);
        } catch (\Throwable $e) {
            $this->logger->error('Recipe import URL fetch failed', ['exception' => $e, 'url' => $url]);

            return $this->json(['error' => 'Could not fetch that URL.'], Response::HTTP_BAD_GATEWAY);
        }

        $textContent = $this->htmlToText($html);
        if ('' === trim($textContent)) {
            return $this->json(['error' => "That page didn't contain any readable text."], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return $textContent;
    }

    /**
     * True for hosts the server must not fetch: localhost and any name that
     * resolves to a private or reserved IP range.
     */
    private function isBlockedHost(string $host): bool
    {
        $host = strtolower(trim($host, '[]')); // strip IPv6 brackets
        if ('localhost' === $host || str_ends_with($host, '.localhost')) {
            return true;
        }

        $ip = filter_var($host, \FILTER_VALIDATE_IP) ? $host : gethostbyname($host);

        // A valid PUBLIC (non-private, non-reserved) IP is allowed; anything else
        // — private/reserved ranges, or a name that failed to resolve — is blocked.
        return false === filter_var($ip, \FILTER_VALIDATE_IP, \FILTER_FLAG_NO_PRIV_RANGE | \FILTER_FLAG_NO_RES_RANGE);
    }

    /** Reduces an HTML document to readable plain text. */
    private function htmlToText(string $html): string
    {
        // Drop script/style/noscript blocks entirely, then strip remaining tags.
        $html = preg_replace('#<(script|style|noscript)\b[^>]*>.*?</\1>#is', ' ', $html) ?? $html;
        $text = strip_tags($html);
        $text = html_entity_decode($text, \ENT_QUOTES | \ENT_HTML5, 'UTF-8');
        $text = preg_replace('/[ \t\x{00A0}]+/u', ' ', $text) ?? $text;
        $text = preg_replace('/\s*\n\s*/', "\n", $text) ?? $text;

        return trim($text);
    }

    /** Prompt for extracting a recipe from a block of text (pasted or scraped from a URL). */
    private function buildImportPrompt(string $source): string
    {
        $schema = $this->importSchema();
        $rules = $this->importRules();

        return <<<PROMPT
        Extract a single recipe from the CONTENT below and return it as JSON.

        Always write every value in ENGLISH. If the content is in another language, translate the title, description, instructions and ingredient names into English.

        Return ONLY a JSON object exactly matching this schema (no extra keys, no prose, no markdown):
        {$schema}

        {$rules}

        CONTENT:
        {$source}
        PROMPT;
    }

    /** Prompt for extracting a recipe from an attached image (photo of a recipe). */
    private function buildImagePrompt(): string
    {
        $schema = $this->importSchema();
        $rules = $this->importRules();

        return <<<PROMPT
        Extract a single recipe from the attached image and return it as JSON. Read all visible text, including printed and handwritten text.

        Always write every value in ENGLISH. If the image is in another language, translate the title, description, instructions and ingredient names into English.

        Return ONLY a JSON object exactly matching this schema (no extra keys, no prose, no markdown):
        {$schema}

        {$rules}
        PROMPT;
    }

    private function importSchema(): string
    {
        return <<<'JSON'
        {
          "title": "string",
          "description": "string",
          "servings": 2,
          "prepTimeMinutes": 0,
          "cookTimeMinutes": 0,
          "instructions": ["string"],
          "ingredients": [ { "name": "string", "quantity": 0, "unit": "string" } ]
        }
        JSON;
    }

    private function importRules(): string
    {
        return <<<'RULES'
        Rules:
        - "servings" is an integer (make a sensible best guess if it is not stated).
        - "prepTimeMinutes" and "cookTimeMinutes" are whole-minute integers; use 0 when unknown.
        - "ingredients" lists every ingredient with a numeric "quantity" and a short "unit" (use "" when there is no unit). Convert written amounts to numbers (e.g. "two cups" -> quantity 2, unit "cup").
        - "instructions" is an ordered array of concise steps, one step per element.
        - If the content is NOT a recipe, return the schema with an empty "title".
        RULES;
    }

    /**
     * Validates a base64 image data URL and turns it into an Image content part,
     * or returns an error response.
     */
    private function imageFromDataUrl(string $dataUrl): Image|JsonResponse
    {
        if (!preg_match('#^data:image/(jpeg|jpg|png|webp|gif);base64,#i', $dataUrl)) {
            return $this->json(
                ['error' => 'Validation failed', 'details' => ['image' => 'Expected a base64 image (jpeg, png, webp or gif) data URL.']],
                Response::HTTP_BAD_REQUEST,
            );
        }
        if (\strlen($dataUrl) > self::IMPORT_MAX_IMAGE_CHARS) {
            return $this->json(
                ['error' => 'Validation failed', 'details' => ['image' => 'Image is too large.']],
                Response::HTTP_BAD_REQUEST,
            );
        }

        try {
            return Image::fromDataUrl($dataUrl);
        } catch (\Throwable) {
            return $this->json(
                ['error' => 'Validation failed', 'details' => ['image' => 'Invalid image data.']],
                Response::HTTP_BAD_REQUEST,
            );
        }
    }

    /**
     * Validates and normalizes the model's imported-recipe JSON. Returns null when
     * no recipe could be extracted (empty/invalid JSON or missing title).
     *
     * @return array<string, mixed>|null
     */
    private function parseImportedRecipe(string $content): ?array
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

        if (!\is_array($decoded)) {
            return null;
        }

        $title = trim((string) ($decoded['title'] ?? ''));
        if ('' === $title) {
            return null;
        }

        return [
            'title' => $title,
            'description' => (string) ($decoded['description'] ?? ''),
            'servings' => max(1, (int) ($decoded['servings'] ?? 1)),
            'prepTimeMinutes' => max(0, (int) ($decoded['prepTimeMinutes'] ?? 0)),
            'cookTimeMinutes' => max(0, (int) ($decoded['cookTimeMinutes'] ?? 0)),
            'instructions' => $this->normalizeSteps($decoded['instructions'] ?? []),
            'ingredients' => $this->normalizeLines($decoded['ingredients'] ?? []),
        ];
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
    private function buildPrompt(string $mode, array $available, int $maxToBuy, string $preferences, int $count, int $servings, int $maxTimeMinutes): string
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

        $schema = $this->suggestionSchema();
        $prefText = '' !== $preferences ? $preferences : 'none';
        $timeRule = $this->timeRule($maxTimeMinutes);

        return <<<PROMPT
        Suggest {$count} practical recipe(s).

        Mode: {$mode}. {$modeText}
        You may include AT MOST {$maxToBuy} extra ingredient(s) that are NOT in the list below; put those in each recipe's "toBuy". If maxToBuy is 0, every ingredient used must come from the list.
        Every recipe must serve exactly {$servings} people: set "servings" to {$servings} and size all ingredient quantities for that many servings.
        {$timeRule}
        Dietary preferences / constraints: {$prefText}.

        Available ingredients:
        {$this->joinLines($lines)}

        Return ONLY a JSON object exactly matching this schema (no extra keys, no prose, no markdown):
        {$schema}

        Rules:
        - "usesIngredients" lists ingredients taken from the available list, with realistic quantities and units.
        - "toBuy" lists any extra ingredients (respecting the maxToBuy limit).
        - "servings" is an integer and must equal {$servings}.
        - "prepTimeMinutes" and "cookTimeMinutes" are whole-minute integers: hands-on prep time and cooking time respectively.
        - "instructions" is an ordered array of steps, one concise step per element (do NOT put all steps in a single string).
        PROMPT;
    }

    /**
     * Builds the prompt for "Surprise me" mode: creative recipes with no regard to
     * what the household has, sized to roughly $numIngredients ingredients each.
     */
    private function buildSurprisePrompt(int $count, int $numIngredients, string $preferences, int $servings, int $maxTimeMinutes): string
    {
        $schema = $this->suggestionSchema();
        $prefText = '' !== $preferences ? $preferences : 'none';
        $timeRule = $this->timeRule($maxTimeMinutes);

        return <<<PROMPT
        Suggest {$count} creative, varied recipe(s) to surprise the user. Be adventurous — do NOT limit yourself to any particular pantry or set of ingredients. Vary the cuisines and styles across the suggestions.

        Each recipe should use AT MOST {$numIngredients} ingredient(s) — fewer is fine.
        Every recipe must serve exactly {$servings} people: set "servings" to {$servings} and size all ingredient quantities for that many servings.
        {$timeRule}
        Dietary preferences / constraints: {$prefText}.

        Return ONLY a JSON object exactly matching this schema (no extra keys, no prose, no markdown):
        {$schema}

        Rules:
        - List EVERY ingredient the recipe needs in "usesIngredients", with realistic quantities and units.
        - Leave "toBuy" as an empty array (the user is starting from scratch).
        - "servings" is an integer and must equal {$servings}.
        - "prepTimeMinutes" and "cookTimeMinutes" are whole-minute integers: hands-on prep time and cooking time respectively.
        - "instructions" is an ordered array of steps, one concise step per element (do NOT put all steps in a single string).
        PROMPT;
    }

    /** The JSON response schema shared by both suggestion prompts. */
    private function suggestionSchema(): string
    {
        return <<<'JSON'
        {
          "suggestions": [
            {
              "title": "string",
              "description": "string",
              "servings": 2,
              "prepTimeMinutes": 0,
              "cookTimeMinutes": 0,
              "instructions": ["string"],
              "usesIngredients": [ { "name": "string", "quantity": 0, "unit": "string" } ],
              "toBuy": [ { "name": "string", "quantity": 0, "unit": "string" } ]
            }
          ]
        }
        JSON;
    }

    /** Instruction line constraining total time, or asking for realistic times when unbounded. */
    private function timeRule(int $maxTimeMinutes): string
    {
        return $maxTimeMinutes > 0
            ? "Each recipe's total time (prepTimeMinutes + cookTimeMinutes) MUST be at most {$maxTimeMinutes} minutes."
            : 'Give realistic prepTimeMinutes and cookTimeMinutes for each recipe.';
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
                'prepTimeMinutes' => max(0, (int) ($s['prepTimeMinutes'] ?? 0)),
                'cookTimeMinutes' => max(0, (int) ($s['cookTimeMinutes'] ?? 0)),
                'instructions' => $this->normalizeSteps($s['instructions'] ?? []),
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

    /**
     * Normalizes the model's "instructions" into an ordered list of step strings.
     * Accepts either an array of steps (the requested schema) or a single string
     * fallback, splitting the latter on line breaks or inline "1." / "2)" markers.
     * Leading step markers are stripped and empty steps dropped.
     *
     * @return list<string>
     */
    private function normalizeSteps(mixed $instructions): array
    {
        if (\is_array($instructions)) {
            $steps = [];
            foreach ($instructions as $step) {
                if (\is_scalar($step)) {
                    $steps[] = (string) $step;
                }
            }
        } elseif (\is_string($instructions)) {
            $steps = $this->splitStepString($instructions);
        } else {
            return [];
        }

        $out = [];
        foreach ($steps as $step) {
            $clean = trim((string) preg_replace('/^\s*\d+[.)]\s+/', '', trim($step)));
            if ('' !== $clean) {
                $out[] = $clean;
            }
        }

        return $out;
    }

    /**
     * Splits a single free-text instruction string into steps: prefers explicit
     * line breaks, then falls back to inline "1. " / "2) " markers.
     *
     * @return list<string>
     */
    private function splitStepString(string $text): array
    {
        $text = trim($text);
        if ('' === $text) {
            return [];
        }

        $byLines = preg_split('/\r?\n+/', $text) ?: [];
        if (\count($byLines) > 1) {
            return array_values($byLines);
        }

        // The digit must be followed by a period/paren AND whitespace, so decimals
        // like "3.5 dl" and ranges like "10-15 min" stay intact.
        $byNumbers = preg_split('/\s*\d+[.)]\s+/', $text) ?: [];
        if (\count($byNumbers) > 1) {
            return array_values($byNumbers);
        }

        return [$text];
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

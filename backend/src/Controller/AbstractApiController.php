<?php

namespace App\Controller;

use App\Entity\Household;
use App\Entity\User;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Shared helpers for the household-scoped JSON API controllers.
 */
abstract class AbstractApiController extends AbstractController
{
    /**
     * The household of the authenticated user; all queries are scoped to it.
     */
    protected function household(): Household
    {
        /** @var User $user */
        $user = $this->getUser();

        return $user->getHousehold();
    }

    /**
     * Decodes a JSON request body into an array, or returns a 400 response.
     *
     * @return array<string, mixed>|JsonResponse
     */
    protected function decode(Request $request): array|JsonResponse
    {
        try {
            $data = json_decode($request->getContent(), true, 512, \JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return $this->json(['error' => 'Invalid JSON body'], Response::HTTP_BAD_REQUEST);
        }

        if (!\is_array($data)) {
            return $this->json(['error' => 'Invalid JSON body'], Response::HTTP_BAD_REQUEST);
        }

        return $data;
    }

    protected function nullableString(mixed $value): ?string
    {
        if (null === $value) {
            return null;
        }
        $value = trim((string) $value);

        return '' === $value ? null : $value;
    }
}

<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Public runtime configuration for the SPA. The frontend bundle is built once
 * (e.g. for the Home Assistant addon image), so anything that varies per
 * installation must be fetched at runtime instead of baked in by Vite.
 */
class ConfigController extends AbstractController
{
    public function __construct(
        #[Autowire('%env(GOOGLE_CLIENT_ID)%')]
        private readonly string $googleClientId,
    ) {
    }

    #[Route('/api/config', methods: ['GET'])]
    public function config(): JsonResponse
    {
        return $this->json([
            'googleClientId' => $this->googleClientId,
        ]);
    }
}

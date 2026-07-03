<?php

namespace App\Service;

use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Verifies a Google Identity Services ID token (the browser "credential") by
 * calling Google's public tokeninfo endpoint — no client secret and no local
 * crypto. Google validates the signature and expiry; we additionally require
 * that the token was minted for our client id (aud) and that the email is
 * verified. Returns the useful claims, or null on any failure so the caller can
 * surface a clean error.
 */
final class GoogleTokenVerifier
{
    private const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        #[Autowire('%env(GOOGLE_CLIENT_ID)%')]
        private readonly string $googleClientId,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function isConfigured(): bool
    {
        return '' !== trim($this->googleClientId);
    }

    /**
     * @return array{email: string, name: string, sub: string}|null
     */
    public function verify(string $credential): ?array
    {
        if (!$this->isConfigured() || '' === trim($credential)) {
            return null;
        }

        try {
            $response = $this->httpClient->request('GET', self::TOKENINFO_URL, [
                'query' => ['id_token' => $credential],
                'timeout' => 10,
            ]);
            if (200 !== $response->getStatusCode()) {
                return null;
            }
            // `false` → don't throw on non-2xx (already handled above).
            $claims = $response->toArray(false);
        } catch (\Throwable $e) {
            $this->logger->error('Google token verification failed', ['exception' => $e]);

            return null;
        }

        // The token must have been issued for THIS app (audience) ...
        if (($claims['aud'] ?? null) !== $this->googleClientId) {
            return null;
        }
        // ... and carry a verified email we can key the account on.
        $emailVerified = filter_var($claims['email_verified'] ?? false, \FILTER_VALIDATE_BOOL);
        $email = trim((string) ($claims['email'] ?? ''));
        if (!$emailVerified || '' === $email) {
            return null;
        }

        $name = trim((string) ($claims['name'] ?? ''));
        if ('' === $name) {
            // Fall back to the email local-part when Google gives no display name.
            $name = strstr($email, '@', true) ?: $email;
        }

        return ['email' => $email, 'name' => $name, 'sub' => (string) ($claims['sub'] ?? '')];
    }
}

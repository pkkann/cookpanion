<?php

namespace App\Controller;

use App\Entity\Household;
use App\Entity\User;
use App\Repository\UserRepository;
use App\Service\EntityPresenter;
use App\Service\GoogleTokenVerifier;
use Doctrine\ORM\EntityManagerInterface;
use Gesdinet\JWTRefreshTokenBundle\Generator\RefreshTokenGeneratorInterface;
use Gesdinet\JWTRefreshTokenBundle\Model\RefreshTokenManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api')]
class AuthController extends AbstractController
{
    /**
     * Locales the app ships translations for. Keep in sync with the frontend
     * SUPPORTED_LANGUAGES (frontend/src/i18n/config.ts).
     */
    private const SUPPORTED_LOCALES = ['en', 'da'];

    /** Refresh-token lifetime in seconds (30 days). Mirrors gesdinet_jwt_refresh_token.ttl. */
    private const REFRESH_TOKEN_TTL = 2592000;

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly UserRepository $users,
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly JWTTokenManagerInterface $jwtManager,
        private readonly EntityPresenter $presenter,
        private readonly GoogleTokenVerifier $googleVerifier,
        private readonly RefreshTokenGeneratorInterface $refreshTokenGenerator,
        private readonly RefreshTokenManagerInterface $refreshTokenManager,
    ) {
    }

    #[Route('/register', name: 'api_register', methods: ['POST'])]
    public function register(Request $request): JsonResponse
    {
        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $email = trim((string) ($data['email'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        $name = trim((string) ($data['name'] ?? ''));
        $householdName = trim((string) ($data['householdName'] ?? ''));

        $errors = [];
        if ('' === $email || !filter_var($email, \FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'A valid email is required.';
        }
        if (\strlen($password) < 6) {
            $errors['password'] = 'Password must be at least 6 characters.';
        }
        if ('' === $name) {
            $errors['name'] = 'Name is required.';
        }
        if ('' === $householdName) {
            $errors['householdName'] = 'Household name is required.';
        }
        if ($errors) {
            return $this->json(['error' => 'Validation failed', 'details' => $errors], Response::HTTP_BAD_REQUEST);
        }

        if (null !== $this->users->findOneBy(['email' => $email])) {
            return $this->json(['error' => 'Email already registered'], Response::HTTP_CONFLICT);
        }

        $household = (new Household())->setName($householdName);

        $user = (new User())
            ->setEmail($email)
            ->setName($name)
            ->setHousehold($household);
        $user->setPassword($this->passwordHasher->hashPassword($user, $password));

        $this->em->persist($household);
        $this->em->persist($user);
        $this->em->flush();

        return $this->authResponse($user, Response::HTTP_CREATED);
    }

    #[Route('/login', name: 'api_login', methods: ['POST'])]
    public function login(Request $request): JsonResponse
    {
        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $email = trim((string) ($data['email'] ?? ''));
        $password = (string) ($data['password'] ?? '');

        $user = '' !== $email ? $this->users->findOneBy(['email' => $email]) : null;
        if (null === $user || !$this->passwordHasher->isPasswordValid($user, $password)) {
            return $this->json(['error' => 'Invalid credentials'], Response::HTTP_UNAUTHORIZED);
        }

        return $this->authResponse($user);
    }

    /**
     * Signs in (or signs up) with a Google Identity Services ID token. The
     * browser obtains the token from the "Sign in with Google" button and posts
     * it here as `credential`; we verify it with Google, then mint our own JWT.
     * A verified Google email that matches an existing account logs into it
     * (link by email); otherwise a new user + household is created.
     */
    #[Route('/auth/google', name: 'api_auth_google', methods: ['POST'])]
    public function googleAuth(Request $request): JsonResponse
    {
        if (!$this->googleVerifier->isConfigured()) {
            return $this->json(['error' => 'Google sign-in is not configured.'], Response::HTTP_SERVICE_UNAVAILABLE);
        }

        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $credential = (string) ($data['credential'] ?? '');
        $claims = '' !== $credential ? $this->googleVerifier->verify($credential) : null;
        if (null === $claims) {
            return $this->json(['error' => 'Invalid Google credential'], Response::HTTP_UNAUTHORIZED);
        }

        // Link by verified email: an existing account is signed straight in.
        $existing = $this->users->findOneBy(['email' => $claims['email']]);
        if (null !== $existing) {
            return $this->authResponse($existing);
        }

        // First time we've seen this Google email → create a household + user.
        // The password column is non-nullable but unused for Google accounts, so
        // store an unguessable random hash.
        $household = (new Household())->setName($claims['name']);
        $user = (new User())
            ->setEmail($claims['email'])
            ->setName($claims['name'])
            ->setHousehold($household);
        $user->setPassword($this->passwordHasher->hashPassword($user, bin2hex(random_bytes(32))));

        $this->em->persist($household);
        $this->em->persist($user);
        $this->em->flush();

        return $this->authResponse($user, Response::HTTP_CREATED);
    }

    #[Route('/me', name: 'api_me', methods: ['GET'])]
    public function me(): JsonResponse
    {
        /** @var User $user */
        $user = $this->getUser();

        return $this->json($this->presenter->user($user));
    }

    #[Route('/me', name: 'api_me_update', methods: ['PATCH'])]
    public function updateMe(Request $request): JsonResponse
    {
        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        /** @var User $user */
        $user = $this->getUser();

        if (\array_key_exists('locale', $data)) {
            $locale = (string) $data['locale'];
            if (!\in_array($locale, self::SUPPORTED_LOCALES, true)) {
                return $this->json(
                    ['error' => 'Unsupported locale', 'details' => ['locale' => 'Must be one of: '.implode(', ', self::SUPPORTED_LOCALES)]],
                    Response::HTTP_BAD_REQUEST,
                );
            }
            $user->setLocale($locale);
        }

        $this->em->flush();

        return $this->json($this->presenter->user($user));
    }

    /**
     * Revokes the given refresh token so it can no longer mint access tokens.
     * The frontend calls this on sign-out; the short-lived access token is left
     * to expire on its own (stateless JWT). Always returns 204, even for an
     * unknown token, so logout is idempotent and leaks nothing.
     */
    /**
     * Route target for the refresh endpoint. It exists so routing doesn't 404
     * before the firewall runs — the refresh_jwt authenticator intercepts this
     * path during the firewall phase and returns { token, refresh_token }, so
     * this method body only runs if that authenticator didn't handle it.
     */
    #[Route('/token/refresh', name: 'api_token_refresh', methods: ['POST'])]
    public function tokenRefresh(): JsonResponse
    {
        return $this->json(['error' => 'Unable to refresh token'], Response::HTTP_UNAUTHORIZED);
    }

    #[Route('/logout', name: 'api_logout', methods: ['POST'])]
    public function logout(Request $request): JsonResponse
    {
        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        $refreshToken = (string) ($data['refresh_token'] ?? '');
        if ('' !== $refreshToken) {
            $stored = $this->refreshTokenManager->get($refreshToken);
            if (null !== $stored) {
                $this->refreshTokenManager->delete($stored);
            }
        }

        return $this->json(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Builds the standard auth response: a fresh access token, a persisted
     * refresh token, and the serialized user. Shared by register/login/google.
     */
    private function authResponse(User $user, int $status = Response::HTTP_OK): JsonResponse
    {
        $refreshToken = $this->refreshTokenGenerator->createForUserWithTtl($user, self::REFRESH_TOKEN_TTL);
        $this->refreshTokenManager->save($refreshToken);

        return $this->json([
            'token' => $this->jwtManager->create($user),
            'refresh_token' => $refreshToken->getRefreshToken(),
            'user' => $this->presenter->user($user),
        ], $status);
    }

    /**
     * @return array<string, mixed>|JsonResponse decoded body, or an error response
     */
    private function decode(Request $request): array|JsonResponse
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
}

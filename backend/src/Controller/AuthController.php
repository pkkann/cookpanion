<?php

namespace App\Controller;

use App\Entity\Household;
use App\Entity\Ingredient;
use App\Entity\PlannedMeal;
use App\Entity\Recipe;
use App\Entity\StockItem;
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
    /** Content languages the household can be set to. Keep in sync with the frontend. */
    private const SUPPORTED_LANGUAGES = ['en', 'da'];

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
        // The household is left unnamed on purpose: the frontend detects the empty
        // name and sends the new user through a one-time onboarding step to name it.
        // The password column is non-nullable but unused for Google accounts, so
        // store an unguessable random hash.
        $household = (new Household())
            ->setName('')
            ->setInviteCode($this->generateInviteCode());
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

        // Personal UI/display language.
        if (\array_key_exists('language', $data)) {
            $language = (string) $data['language'];
            if (!\in_array($language, self::SUPPORTED_LANGUAGES, true)) {
                return $this->json(
                    ['error' => 'Validation failed', 'details' => ['language' => 'Must be one of: '.implode(', ', self::SUPPORTED_LANGUAGES)]],
                    Response::HTTP_BAD_REQUEST,
                );
            }
            $user->setLanguage($language);
        }

        $this->em->flush();

        return $this->json($this->presenter->user($user));
    }

    #[Route('/household', name: 'api_household_update', methods: ['PATCH'])]
    public function updateHousehold(Request $request): JsonResponse
    {
        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        /** @var User $user */
        $user = $this->getUser();
        $household = $user->getHousehold();

        // Name update (when provided) must be non-empty.
        if (\array_key_exists('name', $data)) {
            $name = trim((string) $data['name']);
            if ('' === $name) {
                return $this->json(
                    ['error' => 'Validation failed', 'details' => ['name' => 'Household name is required.']],
                    Response::HTTP_BAD_REQUEST,
                );
            }
            $household?->setName($name);
        }

        // Content language: the language AI-generated / imported content is written in.
        if (\array_key_exists('language', $data)) {
            $language = (string) $data['language'];
            if (!\in_array($language, self::SUPPORTED_LANGUAGES, true)) {
                return $this->json(
                    ['error' => 'Validation failed', 'details' => ['language' => 'Must be one of: '.implode(', ', self::SUPPORTED_LANGUAGES)]],
                    Response::HTTP_BAD_REQUEST,
                );
            }
            $household?->setLanguage($language);
        }

        $this->em->flush();

        return $this->json($this->presenter->user($user));
    }

    /**
     * Joins the household identified by an invite code, so the user shares its
     * ingredients, stock, recipes and plan. The user's previous household is
     * deleted only when it's left empty (no other members and no data) — e.g. the
     * throwaway household auto-created at sign-up. Households that still hold data
     * are left intact.
     */
    #[Route('/household/join', name: 'api_household_join', methods: ['POST'])]
    public function joinHousehold(Request $request): JsonResponse
    {
        $data = $this->decode($request);
        if ($data instanceof JsonResponse) {
            return $data;
        }

        /** @var User $user */
        $user = $this->getUser();

        $code = trim((string) ($data['code'] ?? ''));
        if ('' === $code) {
            return $this->json(
                ['error' => 'Validation failed', 'details' => ['code' => 'An invite code is required.']],
                Response::HTTP_BAD_REQUEST,
            );
        }

        $target = $this->em->getRepository(Household::class)->findOneBy(['inviteCode' => $code]);
        if (null === $target) {
            return $this->json(['error' => 'No household found for that invite code.'], Response::HTTP_NOT_FOUND);
        }

        $old = $user->getHousehold();
        if ($old === $target) {
            // Already a member — nothing to do.
            return $this->json($this->presenter->user($user));
        }

        $user->setHousehold($target);
        $this->em->flush();

        if (null !== $old && $this->isHouseholdEmpty($old)) {
            $this->em->remove($old);
            $this->em->flush();
        }

        return $this->json($this->presenter->user($user));
    }

    /**
     * True when a household has no members and no data — safe to delete.
     */
    private function isHouseholdEmpty(Household $household): bool
    {
        if (\count($household->getMembers()) > 0) {
            return false;
        }

        foreach ([Ingredient::class, Recipe::class, StockItem::class, PlannedMeal::class] as $entity) {
            if ($this->em->getRepository($entity)->count(['household' => $household]) > 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * A short, unguessable, unique invite code for a new household.
     */
    private function generateInviteCode(): string
    {
        $repo = $this->em->getRepository(Household::class);
        do {
            $code = bin2hex(random_bytes(5)); // 10 hex chars
        } while (null !== $repo->findOneBy(['inviteCode' => $code]));

        return $code;
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

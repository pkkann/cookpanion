<?php

namespace App\Controller;

use App\Entity\Household;
use App\Entity\User;
use App\Repository\UserRepository;
use App\Service\EntityPresenter;
use Doctrine\ORM\EntityManagerInterface;
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

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly UserRepository $users,
        private readonly UserPasswordHasherInterface $passwordHasher,
        private readonly JWTTokenManagerInterface $jwtManager,
        private readonly EntityPresenter $presenter,
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

        return $this->json([
            'token' => $this->jwtManager->create($user),
            'user' => $this->presenter->user($user),
        ], Response::HTTP_CREATED);
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

        return $this->json([
            'token' => $this->jwtManager->create($user),
            'user' => $this->presenter->user($user),
        ]);
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

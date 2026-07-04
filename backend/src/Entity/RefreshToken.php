<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Gesdinet\JWTRefreshTokenBundle\Entity\RefreshToken as BaseRefreshToken;

/**
 * Persisted refresh token. In v2 of the bundle the base class is a mapped
 * superclass, so the application owns the concrete entity (and thus the
 * `refresh_tokens` table). Fields (id, refreshToken, username, valid) are
 * inherited from the base class.
 */
#[ORM\Entity]
#[ORM\Table(name: 'refresh_tokens')]
class RefreshToken extends BaseRefreshToken
{
}

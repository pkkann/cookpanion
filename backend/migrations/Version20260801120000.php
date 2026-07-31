<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Removes the kitchen-stock feature. Generated for SQLite (like the initial
 * migration) and not meant to run on MySQL/Postgres.
 */
final class Version20260801120000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Remove kitchen stock: drop stock_item table and ingredient.always_in_stock';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('DROP TABLE stock_item');
        $this->addSql('ALTER TABLE ingredient DROP COLUMN always_in_stock');
    }

    public function down(Schema $schema): void
    {
        $this->throwIrreversibleMigrationException('Kitchen stock data is destroyed by this migration.');
    }
}

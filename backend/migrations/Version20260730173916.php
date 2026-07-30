<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Initial schema. Generated against SQLite — the SQL is SQLite-flavored
 * (AUTOINCREMENT, CLOB, ...) and is not meant to run on MySQL/Postgres.
 */
final class Version20260730173916 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Initial schema (SQLite)';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE household (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name VARCHAR(255) NOT NULL, invite_code VARCHAR(16) NOT NULL, language VARCHAR(5) DEFAULT \'en\' NOT NULL)');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_54C32FC06F21F112 ON household (invite_code)');
        $this->addSql('CREATE TABLE ingredient (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, name VARCHAR(255) NOT NULL, default_unit VARCHAR(32) DEFAULT NULL, always_in_stock BOOLEAN DEFAULT 0 NOT NULL, household_id INTEGER NOT NULL, CONSTRAINT FK_6BAF7870E79FF843 FOREIGN KEY (household_id) REFERENCES household (id) NOT DEFERRABLE INITIALLY IMMEDIATE)');
        $this->addSql('CREATE INDEX IDX_6BAF7870E79FF843 ON ingredient (household_id)');
        $this->addSql('CREATE TABLE planned_meal (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, date DATE NOT NULL, servings INTEGER NOT NULL, created_at DATETIME NOT NULL, recipe_id INTEGER NOT NULL, household_id INTEGER NOT NULL, CONSTRAINT FK_25AEE30159D8A214 FOREIGN KEY (recipe_id) REFERENCES recipe (id) NOT DEFERRABLE INITIALLY IMMEDIATE, CONSTRAINT FK_25AEE301E79FF843 FOREIGN KEY (household_id) REFERENCES household (id) NOT DEFERRABLE INITIALLY IMMEDIATE)');
        $this->addSql('CREATE INDEX IDX_25AEE30159D8A214 ON planned_meal (recipe_id)');
        $this->addSql('CREATE INDEX IDX_25AEE301E79FF843 ON planned_meal (household_id)');
        $this->addSql('CREATE TABLE recipe (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, title VARCHAR(255) NOT NULL, description CLOB NOT NULL, instructions CLOB NOT NULL, servings INTEGER NOT NULL, prep_time_minutes INTEGER DEFAULT NULL, cook_time_minutes INTEGER DEFAULT NULL, created_at DATETIME NOT NULL, author_id INTEGER NOT NULL, household_id INTEGER NOT NULL, CONSTRAINT FK_DA88B137F675F31B FOREIGN KEY (author_id) REFERENCES user (id) NOT DEFERRABLE INITIALLY IMMEDIATE, CONSTRAINT FK_DA88B137E79FF843 FOREIGN KEY (household_id) REFERENCES household (id) NOT DEFERRABLE INITIALLY IMMEDIATE)');
        $this->addSql('CREATE INDEX IDX_DA88B137F675F31B ON recipe (author_id)');
        $this->addSql('CREATE INDEX IDX_DA88B137E79FF843 ON recipe (household_id)');
        $this->addSql('CREATE TABLE recipe_ingredient (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, quantity DOUBLE PRECISION NOT NULL, unit VARCHAR(32) NOT NULL, recipe_id INTEGER NOT NULL, ingredient_id INTEGER NOT NULL, CONSTRAINT FK_22D1FE1359D8A214 FOREIGN KEY (recipe_id) REFERENCES recipe (id) NOT DEFERRABLE INITIALLY IMMEDIATE, CONSTRAINT FK_22D1FE13933FE08C FOREIGN KEY (ingredient_id) REFERENCES ingredient (id) NOT DEFERRABLE INITIALLY IMMEDIATE)');
        $this->addSql('CREATE INDEX IDX_22D1FE1359D8A214 ON recipe_ingredient (recipe_id)');
        $this->addSql('CREATE INDEX IDX_22D1FE13933FE08C ON recipe_ingredient (ingredient_id)');
        $this->addSql('CREATE TABLE refresh_tokens (refresh_token VARCHAR(128) NOT NULL, username VARCHAR(255) NOT NULL, valid DATETIME NOT NULL, id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL)');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_9BACE7E1C74F2195 ON refresh_tokens (refresh_token)');
        $this->addSql('CREATE TABLE stock_item (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, quantity DOUBLE PRECISION NOT NULL, unit VARCHAR(32) NOT NULL, ingredient_id INTEGER NOT NULL, household_id INTEGER NOT NULL, CONSTRAINT FK_6017DDA933FE08C FOREIGN KEY (ingredient_id) REFERENCES ingredient (id) NOT DEFERRABLE INITIALLY IMMEDIATE, CONSTRAINT FK_6017DDAE79FF843 FOREIGN KEY (household_id) REFERENCES household (id) NOT DEFERRABLE INITIALLY IMMEDIATE)');
        $this->addSql('CREATE INDEX IDX_6017DDA933FE08C ON stock_item (ingredient_id)');
        $this->addSql('CREATE INDEX IDX_6017DDAE79FF843 ON stock_item (household_id)');
        $this->addSql('CREATE TABLE user (id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, email VARCHAR(180) NOT NULL, roles CLOB NOT NULL, password VARCHAR(255) NOT NULL, name VARCHAR(255) NOT NULL, language VARCHAR(5) DEFAULT \'en\' NOT NULL, household_id INTEGER NOT NULL, CONSTRAINT FK_8D93D649E79FF843 FOREIGN KEY (household_id) REFERENCES household (id) NOT DEFERRABLE INITIALLY IMMEDIATE)');
        $this->addSql('CREATE INDEX IDX_8D93D649E79FF843 ON user (household_id)');
        $this->addSql('CREATE UNIQUE INDEX uniq_user_email ON user (email)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP TABLE household');
        $this->addSql('DROP TABLE ingredient');
        $this->addSql('DROP TABLE planned_meal');
        $this->addSql('DROP TABLE recipe');
        $this->addSql('DROP TABLE recipe_ingredient');
        $this->addSql('DROP TABLE refresh_tokens');
        $this->addSql('DROP TABLE stock_item');
        $this->addSql('DROP TABLE user');
    }
}

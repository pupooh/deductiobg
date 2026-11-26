<?php

declare(strict_types=1);

namespace Bga\Games\deductiobg\Tests;

use PHPUnit\Framework\TestCase;
use Bga\Games\deductiobg\Material;

final class MaterialTest extends TestCase
{
    public function testAll35ClueDefinitionsExist(): void
    {
        $this->assertCount(35, Material::CLUE_DEFINITIONS);
        for ($id = Material::CLUE_TYPE_MIN; $id <= Material::CLUE_TYPE_MAX; $id++) {
            $def = Material::getClueDefinition($id);
            $this->assertArrayHasKey('category', $def);
            $this->assertArrayHasKey('label', $def);
            $this->assertArrayHasKey('ability', $def);
        }
    }

    public function testDoubleExclusions(): void
    {
        $this->assertFalse(Material::isClueTrueForNumber(1, 10, []));
        $this->assertFalse(Material::isClueTrueForNumber(1, 20, []));
        $this->assertTrue(Material::isClueTrueForNumber(1, 1, []));

        $this->assertFalse(Material::isClueTrueForNumber(10, 9, []));
        $this->assertFalse(Material::isClueTrueForNumber(10, 19, []));
        $this->assertTrue(Material::isClueTrueForNumber(10, 18, []));
    }

    public function testFiveNumberAndRangeExclusions(): void
    {
        $this->assertFalse(Material::isClueTrueForNumber(11, 14, []));
        $this->assertTrue(Material::isClueTrueForNumber(11, 15, []));

        $this->assertFalse(Material::isClueTrueForNumber(15, 1, []));
        $this->assertFalse(Material::isClueTrueForNumber(15, 4, []));
        $this->assertTrue(Material::isClueTrueForNumber(15, 5, []));

        $this->assertFalse(Material::isClueTrueForNumber(19, 20, []));
        $this->assertTrue(Material::isClueTrueForNumber(19, 16, []));
    }

    public function testInequalitiesAndRanges(): void
    {
        $this->assertFalse(Material::isClueTrueForNumber(20, 5, []));
        $this->assertTrue(Material::isClueTrueForNumber(20, 6, []));

        $this->assertTrue(Material::isClueTrueForNumber(23, 13, []));
        $this->assertFalse(Material::isClueTrueForNumber(23, 14, []));

        $this->assertTrue(Material::isClueTrueForNumber(32, 1, []));
        $this->assertTrue(Material::isClueTrueForNumber(32, 5, []));
        $this->assertFalse(Material::isClueTrueForNumber(32, 6, []));
    }

    public function testParityAndDigitsWithFreeGuess(): void
    {
        $this->assertSame(Material::ABILITY_FREE_GUESS, Material::getAbility(26));
        $this->assertTrue(Material::isClueTrueForNumber(26, 2, []));
        $this->assertFalse(Material::isClueTrueForNumber(26, 3, []));

        $this->assertSame(Material::ABILITY_FREE_GUESS, Material::getAbility(27));
        $this->assertTrue(Material::isClueTrueForNumber(27, 19, []));
        $this->assertFalse(Material::isClueTrueForNumber(27, 20, []));

        $this->assertSame(Material::ABILITY_FREE_GUESS, Material::getAbility(28));
        $this->assertTrue(Material::isClueTrueForNumber(28, 9, []));
        $this->assertFalse(Material::isClueTrueForNumber(28, 10, []));

        $this->assertSame(Material::ABILITY_FREE_GUESS, Material::getAbility(29));
        $this->assertFalse(Material::isClueTrueForNumber(29, 9, []));
        $this->assertTrue(Material::isClueTrueForNumber(29, 10, []));
    }

    public function testAdjacentToRevealedSecrets(): void
    {
        $this->assertTrue(Material::isAdjacentToRevealedClue(30));
        $this->assertTrue(Material::isAdjacentToRevealedClue(31));
        $this->assertFalse(Material::isAdjacentToRevealedClue(29));

        $this->assertFalse(Material::isClueTrueForNumber(30, 12, []));
        $this->assertTrue(Material::isClueTrueForNumber(30, 12, [11]));
        $this->assertFalse(Material::isClueTrueForNumber(30, 10, [11]));

        $this->assertTrue(Material::isClueTrueForNumber(31, 10, [11]));
        $this->assertFalse(Material::isClueTrueForNumber(31, 12, [11]));
    }

    public function testWinningSecretCount(): void
    {
        $this->assertSame(3, Material::getWinningSecretCount(2));
        $this->assertSame(2, Material::getWinningSecretCount(3));
        $this->assertSame(2, Material::getWinningSecretCount(4));
    }
}

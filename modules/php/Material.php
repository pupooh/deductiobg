<?php

declare(strict_types=1);

namespace SuaVEStudio\BrainGames\Deductio;

/**
 * Static card definitions and truth-evaluation logic for Deductio.
 */
final class Material
{
    public const int SECRET_CARD_MIN = 1;
    public const int SECRET_CARD_MAX = 20;

    public const int CLUE_TYPE_MIN = 1;
    public const int CLUE_TYPE_MAX = 35;
    public const int REVEAL_CLUE_TYPE_ID = 36;

    public const int REVEAL_CARDS_STANDARD = 7;
    public const int REVEAL_CARDS_4P = 5;

    public const ?string ABILITY_NONE = null;
    public const string ABILITY_FREE_GUESS = 'free_guess';
    public const string ABILITY_LOOK_1 = 'look_1';
    public const string ABILITY_LOOK_2 = 'look_2';

    /**
     * All 35 regular Clue card definitions keyed by clueTypeId (1..35).
     * Index in img/clue_cards.webp is (clueTypeId - 1), and Reveal card is index 35.
     *
     * @var array<int, array{
     *     category: string,
     *     label: string,
     *     ability: ?string,
     *     values?: int[],
     *     min?: int,
     *     max?: int,
     *     parity?: string,
     *     digits?: string,
     *     offset?: int
     * }>
     */
    public const array CLUE_DEFINITIONS = [
        // 1..10: Double-number exclusions
        1  => ['category' => 'not_in_set', 'label' => '≠ 10, 20', 'ability' => self::ABILITY_NONE, 'values' => [10, 20]],
        2  => ['category' => 'not_in_set', 'label' => '≠ 1, 11',  'ability' => self::ABILITY_NONE, 'values' => [1, 11]],
        3  => ['category' => 'not_in_set', 'label' => '≠ 2, 12',  'ability' => self::ABILITY_NONE, 'values' => [2, 12]],
        4  => ['category' => 'not_in_set', 'label' => '≠ 3, 13',  'ability' => self::ABILITY_NONE, 'values' => [3, 13]],
        5  => ['category' => 'not_in_set', 'label' => '≠ 4, 14',  'ability' => self::ABILITY_NONE, 'values' => [4, 14]],
        6  => ['category' => 'not_in_set', 'label' => '≠ 5, 15',  'ability' => self::ABILITY_NONE, 'values' => [5, 15]],
        7  => ['category' => 'not_in_set', 'label' => '≠ 6, 16',  'ability' => self::ABILITY_NONE, 'values' => [6, 16]],
        8  => ['category' => 'not_in_set', 'label' => '≠ 7, 17',  'ability' => self::ABILITY_NONE, 'values' => [7, 17]],
        9  => ['category' => 'not_in_set', 'label' => '≠ 8, 18',  'ability' => self::ABILITY_NONE, 'values' => [8, 18]],
        10 => ['category' => 'not_in_set', 'label' => '≠ 9, 19',  'ability' => self::ABILITY_NONE, 'values' => [9, 19]],

        // 11..14: 5-number exclusions
        11 => ['category' => 'not_in_set', 'label' => '≠ 1, 6, 9, 14, 17',  'ability' => self::ABILITY_NONE, 'values' => [1, 6, 9, 14, 17]],
        12 => ['category' => 'not_in_set', 'label' => '≠ 2, 5, 10, 13, 18', 'ability' => self::ABILITY_NONE, 'values' => [2, 5, 10, 13, 18]],
        13 => ['category' => 'not_in_set', 'label' => '≠ 3, 8, 11, 16, 19', 'ability' => self::ABILITY_NONE, 'values' => [3, 8, 11, 16, 19]],
        14 => ['category' => 'not_in_set', 'label' => '≠ 4, 7, 12, 15, 20', 'ability' => self::ABILITY_NONE, 'values' => [4, 7, 12, 15, 20]],

        // 15..19: Range exclusions
        15 => ['category' => 'not_in_set', 'label' => '≠ 1–4',   'ability' => self::ABILITY_NONE, 'values' => [1, 2, 3, 4]],
        16 => ['category' => 'not_in_set', 'label' => '≠ 5–8',   'ability' => self::ABILITY_NONE, 'values' => [5, 6, 7, 8]],
        17 => ['category' => 'not_in_set', 'label' => '≠ 9–12',  'ability' => self::ABILITY_NONE, 'values' => [9, 10, 11, 12]],
        18 => ['category' => 'not_in_set', 'label' => '≠ 13–16', 'ability' => self::ABILITY_NONE, 'values' => [13, 14, 15, 16]],
        19 => ['category' => 'not_in_set', 'label' => '≠ 17–20', 'ability' => self::ABILITY_NONE, 'values' => [17, 18, 19, 20]],

        // 20..22: Lower bounds
        20 => ['category' => 'gte', 'label' => '≥ 6', 'ability' => self::ABILITY_NONE, 'min' => 6],
        21 => ['category' => 'gte', 'label' => '≥ 7', 'ability' => self::ABILITY_NONE, 'min' => 7],
        22 => ['category' => 'gte', 'label' => '≥ 8', 'ability' => self::ABILITY_NONE, 'min' => 8],

        // 23..25: Upper bounds
        23 => ['category' => 'lte', 'label' => '≤ 13', 'ability' => self::ABILITY_NONE, 'max' => 13],
        24 => ['category' => 'lte', 'label' => '≤ 14', 'ability' => self::ABILITY_NONE, 'max' => 14],
        25 => ['category' => 'lte', 'label' => '≤ 15', 'ability' => self::ABILITY_NONE, 'max' => 15],

        // 26..29: Parity / digit count + Free Guess
        26 => ['category' => 'parity', 'label' => 'Even (2, 4, 6...)',      'ability' => self::ABILITY_FREE_GUESS, 'parity' => 'even'],
        27 => ['category' => 'parity', 'label' => 'Odd (1, 3, 5...)',       'ability' => self::ABILITY_FREE_GUESS, 'parity' => 'odd'],
        28 => ['category' => 'digits', 'label' => 'Single digit (1–9)',     'ability' => self::ABILITY_FREE_GUESS, 'digits' => 'single'],
        29 => ['category' => 'digits', 'label' => 'Double digit (10–20)',   'ability' => self::ABILITY_FREE_GUESS, 'digits' => 'double'],

        // 30..31: Adjacent to face-up Secret Number + Look at 1 Card
        30 => ['category' => 'offset_from_revealed', 'label' => '+1 from face-up Secret Number', 'ability' => self::ABILITY_LOOK_1, 'offset' => 1],
        31 => ['category' => 'offset_from_revealed', 'label' => '-1 from face-up Secret Number', 'ability' => self::ABILITY_LOOK_1, 'offset' => -1],

        // 32..35: Range + Look at 2 Cards
        32 => ['category' => 'range', 'label' => '= 1–5',   'ability' => self::ABILITY_LOOK_2, 'min' => 1,  'max' => 5],
        33 => ['category' => 'range', 'label' => '= 6–10',  'ability' => self::ABILITY_LOOK_2, 'min' => 6,  'max' => 10],
        34 => ['category' => 'range', 'label' => '= 11–15', 'ability' => self::ABILITY_LOOK_2, 'min' => 11, 'max' => 15],
        35 => ['category' => 'range', 'label' => '= 16–20', 'ability' => self::ABILITY_LOOK_2, 'min' => 16, 'max' => 20],
    ];

    /**
     * @return array<string, mixed>
     */
    public static function getClueDefinition(int $clueTypeId): array
    {
        if (!isset(self::CLUE_DEFINITIONS[$clueTypeId])) {
            throw new \InvalidArgumentException("Unknown clue type ID: {$clueTypeId}");
        }
        return self::CLUE_DEFINITIONS[$clueTypeId];
    }

    public static function getAbility(int $clueTypeId): ?string
    {
        return self::getClueDefinition($clueTypeId)['ability'];
    }

    public static function isAdjacentToRevealedClue(int $clueTypeId): bool
    {
        return self::getClueDefinition($clueTypeId)['category'] === 'offset_from_revealed';
    }

    /**
     * Evaluate whether a Clue card truthfully describes the given Secret Number.
     *
     * @param int[] $faceUpSecrets Numbers on face-up Secret Number cards in the center of the table.
     */
    public static function isClueTrueForNumber(int $clueTypeId, int $secretNumber, array $faceUpSecrets): bool
    {
        $def = self::getClueDefinition($clueTypeId);

        return match ($def['category']) {
            'not_in_set' => !in_array($secretNumber, $def['values'], true),
            'gte' => $secretNumber >= $def['min'],
            'lte' => $secretNumber <= $def['max'],
            'range' => $secretNumber >= $def['min'] && $secretNumber <= $def['max'],
            'parity' => ($secretNumber % 2 === 0) === ($def['parity'] === 'even'),
            'digits' => ($secretNumber >= 10) === ($def['digits'] === 'double'),
            'offset_from_revealed' => in_array($secretNumber - $def['offset'], $faceUpSecrets, true),
            default => false,
        };
    }

    /**
     * Number of guessed Secret Number cards required to win for a given player count.
     */
    public static function getWinningSecretCount(int $playerCount): int
    {
        return $playerCount <= 2 ? 3 : 2;
    }
}

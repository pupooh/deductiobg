<?php

declare(strict_types=1);

namespace Bga\Games\deductiobg\Cards;

/**
 * Location constants used by SecretCardManager and ClueCardManager.
 */
final class CardLocation
{
    public const string DECK = 'deck';
    public const string HAND = 'hand';
    public const string REVEALED = 'revealed';
    public const string GUESSED = 'guessed';
    public const string ROW = 'row';
    public const string DISCARD = 'discard';
    public const string BOX = 'box';
    public const string TABLEAU = 'tableau';
}

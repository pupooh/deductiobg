<?php

declare(strict_types=1);

namespace Bga\Games\DeductioBG\Cards;

use Bga\GameFramework\Components\ItemManager\Item;
use Bga\GameFramework\Components\ItemManager\ItemField;
use Bga\GameFramework\Components\ItemManager\ItemFieldKind;

#[Item(tableName: 'clue_card')]
class ClueCard
{
    public const string ORIENTATION_VERTICAL = 'vertical';
    public const string ORIENTATION_HORIZONTAL = 'horizontal';

    #[ItemField(kind: ItemFieldKind::ID)]
    public int $id;

    #[ItemField(kind: ItemFieldKind::LOCATION, locationIndex: 0)]
    public string $location;

    // NB: int|null on purpose, NOT int|string|null. ItemManager infers the
    // locationArg storage/validation type from this property type, and a
    // union containing string makes the framework expect string values.
    // Every locationArg we ever store is an int (a player id or a row slot)
    // or null, so ?int is the exact type — this matches the Hearts tutorial.
    #[ItemField(kind: ItemFieldKind::LOCATION, locationIndex: 1)]
    public ?int $locationArg = null;

    #[ItemField(kind: ItemFieldKind::ORDER)]
    public int $order;

    #[ItemField]
    public int $clueTypeId;

    #[ItemField]
    public bool $isReveal;

    #[ItemField]
    public string $orientation = self::ORIENTATION_VERTICAL;
}

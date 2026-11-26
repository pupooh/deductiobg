<?php

declare(strict_types=1);

namespace SuaVEStudio\BrainGames\Deductio\Cards;

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

    /** @var array<int, string|int>|string */
    #[ItemField(kind: ItemFieldKind::LOCATION)]
    public array|string $location;

    #[ItemField(kind: ItemFieldKind::ORDER)]
    public int $order;

    #[ItemField]
    public int $clueTypeId;

    #[ItemField]
    public bool $isReveal;

    #[ItemField]
    public string $orientation = self::ORIENTATION_VERTICAL;
}

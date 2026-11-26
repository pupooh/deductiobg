<?php

declare(strict_types=1);

namespace Bga\Games\deductiobg\Cards;

use Bga\GameFramework\Components\ItemManager\Item;
use Bga\GameFramework\Components\ItemManager\ItemField;
use Bga\GameFramework\Components\ItemManager\ItemFieldKind;

#[Item(tableName: 'secret_card')]
class SecretCard
{
    #[ItemField(kind: ItemFieldKind::ID)]
    public int $id;

    /** @var array<int, string|int>|string */
    #[ItemField(kind: ItemFieldKind::LOCATION)]
    public array|string $location;

    #[ItemField(kind: ItemFieldKind::ORDER)]
    public int $order;

    #[ItemField]
    public int $number;
}

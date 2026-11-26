<?php

declare(strict_types=1);

namespace {
    if (!function_exists('clienttranslate')) {
        function clienttranslate(string $text): string
        {
            return $text;
        }
    }
}

namespace Bga\GameFramework {
    class UserException extends \RuntimeException {}

    enum StateType: string
    {
        case GAME = 'game';
        case ACTIVE_PLAYER = 'activeplayer';
        case MULTIPLE_ACTIVE_PLAYER = 'multipleactiveplayer';
        case PRIVATE = 'private';
    }

    class Notify
    {
        /** @var array<int, callable> */
        private array $decorators = [];

        /** @var array<int, array{scope: string, playerId: ?int, name: string, message: string, args: array}> */
        public array $sent = [];

        public function addDecorator(callable $fn): void
        {
            $this->decorators[] = $fn;
        }

        public function all(string $name, string $message = '', array $args = []): void
        {
            foreach ($this->decorators as $fn) {
                $args = $fn($message, $args);
            }
            $this->sent[] = ['scope' => 'all', 'playerId' => null, 'name' => $name, 'message' => $message, 'args' => $args];
        }

        public function player(int $playerId, string $name, string $message = '', array $args = []): void
        {
            foreach ($this->decorators as $fn) {
                $args = $fn($message, $args);
            }
            $this->sent[] = ['scope' => 'player', 'playerId' => $playerId, 'name' => $name, 'message' => $message, 'args' => $args];
        }
    }

    class TableStats
    {
        /** @var array<string, int|float|bool> */
        public array $stats = [];

        public function init(string|array $nameOrNames, int|float|bool $value): void
        {
            foreach ((array) $nameOrNames as $name) {
                $this->stats[$name] = $value;
            }
        }

        public function set(string $name, int|float|bool $value): void
        {
            $this->stats[$name] = $value;
        }

        public function inc(string $name, int|float $delta = 1): void
        {
            $this->stats[$name] = ($this->stats[$name] ?? 0) + $delta;
        }

        public function get(string $name): int|float|bool
        {
            return $this->stats[$name] ?? 0;
        }
    }

    class PlayerStats
    {
        /** @var array<int, array<string, int|float|bool>> */
        public array $stats = [];

        public function init(string|array $nameOrNames, int|float|bool $value, bool $updateTable = false): void
        {
            // Initialized lazily per player on inc/set
        }

        public function set(string $name, int|float|bool $value, int $playerId): void
        {
            $this->stats[$playerId][$name] = $value;
        }

        public function inc(string $name, int|float $delta, int $playerId): void
        {
            $this->stats[$playerId][$name] = ($this->stats[$playerId][$name] ?? 0) + $delta;
        }

        public function get(string $name, int $playerId): int|float|bool
        {
            return $this->stats[$playerId][$name] ?? 0;
        }
    }

    class Globals
    {
        /** @var array<string, mixed> */
        private array $values = [];

        public function get(string $name, mixed $defaultValue = null, ?string $class = null): mixed
        {
            return $this->values[$name] ?? $defaultValue;
        }

        public function set(string $name, mixed $value): void
        {
            $this->values[$name] = $value;
        }

        public function delete(string ...$names): void
        {
            foreach ($names as $name) {
                unset($this->values[$name]);
            }
        }
    }

    class InMemoryPlayerScore
    {
        /** @var array<int, int> */
        public array $scores = [];

        public function get(int $playerId): int
        {
            return $this->scores[$playerId] ?? 0;
        }

        public function set(int $playerId, int $value, mixed $message = null): int
        {
            $this->scores[$playerId] = $value;
            return $value;
        }

        public function inc(int $playerId, int $delta, mixed $message = null): int
        {
            $this->scores[$playerId] = ($this->scores[$playerId] ?? 0) + $delta;
            return $this->scores[$playerId];
        }
    }

    class BgaContainer
    {
        public Notify $notify;
        public TableStats $tableStats;
        public PlayerStats $playerStats;
        public InMemoryPlayerScore $playerScore;
        public Components\ItemManagerFactory $itemManagerFactory;

        public function __construct()
        {
            $this->notify = new Notify();
            $this->tableStats = new TableStats();
            $this->playerStats = new PlayerStats();
            $this->playerScore = new InMemoryPlayerScore();
            $this->itemManagerFactory = new Components\ItemManagerFactory();
        }
    }

    class GameStateManager
    {
        public int $currentStateId = 10;

        public function getCurrentMainStateId(): ?int
        {
            return $this->currentStateId;
        }

        public function jumpToState(int $stateId): void
        {
            $this->currentStateId = $stateId;
        }
    }

    class Table
    {
        public BgaContainer $bga;
        public Globals $globals;
        public GameStateManager $gamestate;

        /** @var array<int, array{player_name: string, player_color?: string}> */
        public array $testPlayers = [];
        public int $activePlayerId = 0;

        /** @var array<int, string> */
        public static array $executedQueries = [];

        public function __construct()
        {
            $this->bga = new BgaContainer();
            $this->globals = new Globals();
            $this->gamestate = new GameStateManager();
        }

        public function getGameinfos(): array
        {
            return [
                'player_colors' => ['ff0000', '008000', '0000ff', 'ffa500'],
            ];
        }

        public static function DbQuery(string $sql): void
        {
            self::$executedQueries[] = $sql;
        }

        public function getCollectionFromDb(string $sql): array
        {
            $rows = [];
            foreach ($this->testPlayers as $pid => $info) {
                $rows[$pid] = [
                    'id' => (string) $pid,
                    'score' => (string) $this->bga->playerScore->get((int) $pid),
                ];
            }
            return $rows;
        }

        public function reattributeColorsBasedOnPreferences(array $players, array $colors): void {}

        public function reloadPlayersBasicInfos(): void {}

        public function loadPlayersBasicInfos(): array
        {
            return $this->testPlayers;
        }

        public function getPlayerNameById(int $playerId): string
        {
            return $this->testPlayers[$playerId]['player_name'] ?? "Player{$playerId}";
        }

        public function activeNextPlayer(): int
        {
            $ids = array_keys($this->testPlayers);
            if ($ids === []) {
                return 0;
            }
            $idx = array_search($this->activePlayerId, $ids, true);
            $nextIdx = $idx === false ? 0 : ($idx + 1) % count($ids);
            $this->activePlayerId = (int) $ids[$nextIdx];
            return $this->activePlayerId;
        }

        public function getActivePlayerId(): int|string
        {
            return $this->activePlayerId;
        }

        public function giveExtraTime(int $playerId): void {}

        public function startTestGame(array $players): string
        {
            $this->testPlayers = [];
            foreach ($players as $pid => $info) {
                $this->testPlayers[(int) $pid] = $info;
                $this->bga->playerScore->set((int) $pid, 0);
            }
            return $this->setupNewGame($players, []);
        }
    }
}

namespace Bga\GameFramework\States {
    use Bga\GameFramework\StateType;
    use Bga\GameFramework\Table;

    #[\Attribute(\Attribute::TARGET_METHOD)]
    class PossibleAction {}

    abstract class GameState
    {
        public \Bga\GameFramework\BgaContainer $bga;

        public function __construct(
            Table $game,
            public int $id,
            public StateType $type,
            public bool $updateGameProgression = false,
        ) {
            $this->bga = $game->bga;
        }

        /**
         * @template T
         * @param T[] $choices
         * @return T
         */
        public function getRandomZombieChoice(array $choices): mixed
        {
            return $choices[0];
        }
    }
}

namespace Bga\GameFramework\Helpers {
    class Collection implements \Countable, \IteratorAggregate
    {
        /** @var array<int|string, mixed> */
        private array $items;

        public function __construct(array $items = [])
        {
            $this->items = $items;
        }

        public function first(): mixed
        {
            return $this->items === [] ? null : reset($this->items);
        }

        public function values(): array
        {
            return array_values($this->items);
        }

        public function count(): int
        {
            return count($this->items);
        }

        public function getIterator(): \Traversable
        {
            return new \ArrayIterator($this->items);
        }
    }
}

namespace Bga\GameFramework\Components {
    class ItemManagerFactory
    {
        public function createItemManager(
            string $className,
            ?callable $classNameResolver = null,
            array $locations = [],
            ?callable $dbUpdateCallback = null,
            ?callable $countChangeCallback = null,
        ): ItemManager\ItemManager {
            return new ItemManager\ItemManager($className, $locations);
        }
    }
}

namespace Bga\GameFramework\Components\ItemManager {
    use Bga\GameFramework\Helpers\Collection;

    #[\Attribute(\Attribute::TARGET_CLASS)]
    class Item
    {
        public function __construct(public ?string $tableName = null) {}
    }

    enum ItemFieldKind: string
    {
        case ID = 'id';
        case LOCATION = 'location';
        case ORDER = 'order';
    }

    #[\Attribute(\Attribute::TARGET_PROPERTY)]
    class ItemField
    {
        public function __construct(
            public ?ItemFieldKind $kind = null,
            ?string $type = null,
            ?string $dbField = null,
            public bool $serialize = false,
            public int $locationIndex = 0,
        ) {}
    }

    class ItemLocation
    {
        public function __construct(
            public string|int $name,
            public bool $randomPick = false,
            public string|int|ItemLocation|null $autoReshuffleFrom = null,
            public mixed $autoReshuffleCallback = null,
        ) {}
    }

    class ItemManager
    {
        /** @var array<int, object> */
        private array $items = [];
        private int $nextId = 1;
        private bool $initialized = false;

        /** @param ItemLocation[] $locations */
        public function __construct(
            private string $className,
            private array $locations = [],
        ) {}

        public function initDb(): void
        {
            $this->initialized = true;
            $this->items = [];
            $this->nextId = 1;
        }

        public function createItems(array $itemsData): void
        {
            foreach ($itemsData as $data) {
                $cls = $this->className;
                $obj = new $cls();
                $obj->id = $this->nextId++;
                $loc = $data['location'] ?? 'deck';
                $obj->location = $loc;
                $obj->order = $this->getMaxOrderInLocation($loc) + 1;
                foreach ($data as $key => $val) {
                    if ($key !== 'location' && $key !== 'order') {
                        $obj->$key = $val;
                    }
                }
                $this->items[$obj->id] = $obj;
            }
        }

        public function shuffle(array|string|int $location): void
        {
            $matching = $this->getItemsInLocation($location)->values();
            shuffle($matching);
            foreach ($matching as $index => $item) {
                $item->order = $index;
            }
        }

        public function pickItem(array|string|int $from, array|string|int $to): ?object
        {
            $top = $this->getItemOnTop($from);
            if ($top === null && is_string($from)) {
                foreach ($this->locations as $locDef) {
                    if ($locDef->name === $from && $locDef->autoReshuffleFrom !== null) {
                        $discardCount = $this->countItemsInLocation($locDef->autoReshuffleFrom);
                        if ($discardCount > 0) {
                            $this->moveAllItemsInLocation($locDef->autoReshuffleFrom, $from);
                            $this->shuffle($from);
                            $top = $this->getItemOnTop($from);
                        }
                        break;
                    }
                }
            }
            if ($top === null) {
                return null;
            }
            $this->moveItem($top, $to);
            return $top;
        }

        public function moveAllItemsInLocation(array|string|int $from, array|string|int $to): void
        {
            foreach ($this->getItemsInLocation($from)->values() as $item) {
                $this->moveItem($item, $to);
            }
        }

        public function setItemOrder(object|int $itemOrId, int $order): void
        {
            $item = is_int($itemOrId) ? ($this->items[$itemOrId] ?? null) : $itemOrId;
            if ($item !== null) {
                $item->order = $order;
            }
        }

        public function moveItem(object|int $itemOrId, array|string|int $to, ?int $order = null): void
        {
            $item = is_int($itemOrId) ? ($this->items[$itemOrId] ?? null) : $itemOrId;
            if ($item === null) {
                return;
            }
            $newOrder = $order ?? ($this->getMaxOrderInLocation($to) + 1);
            $item->location = $to;
            $item->order = $newOrder;
        }

        public function updateItem(object $item, array|string|null $fields = null): void {}

        public function getItemById(int $id): ?object
        {
            return $this->items[$id] ?? null;
        }

        public function getItemsByIds(array $ids): Collection
        {
            $res = [];
            foreach ($ids as $id) {
                if (isset($this->items[$id])) {
                    $res[$id] = $this->items[$id];
                }
            }
            return new Collection($res);
        }

        public function countItemsInLocation(array|string|int $location): int
        {
            return $this->getItemsInLocation($location)->count();
        }

        public function getMaxOrderInLocation(array|string|int $location): int
        {
            $items = $this->getItemsInLocation($location)->values();
            if ($items === []) {
                return -1;
            }
            return max(array_map(static fn($i): int => $i->order, $items));
        }

        public function getItemsInLocation(array|string|int $location, bool $reversed = false, ?int $limit = null): Collection
        {
            $matched = array_filter(
                $this->items,
                fn(object $item): bool => $this->locationMatches($item->location, $location)
            );
            usort($matched, static fn($a, $b): int => $reversed ? ($b->order <=> $a->order) : ($a->order <=> $b->order));
            if ($limit !== null) {
                $matched = array_slice($matched, 0, $limit);
            }
            return new Collection($matched);
        }

        public function getItemOnTop(array|string|int $location): ?object
        {
            return $this->getItemsInLocation($location, reversed: true, limit: 1)->first();
        }

        public function getItemsOnTop(int $number, array|string|int $location): Collection
        {
            return $this->getItemsInLocation($location, reversed: true, limit: $number);
        }

        private function locationMatches(array|string|int $actual, array|string|int $filter): bool
        {
            $a = (array) $actual;
            $f = (array) $filter;
            if (count($a) !== count($f)) {
                return false;
            }
            foreach ($f as $idx => $part) {
                if ($part === null) {
                    continue;
                }
                if ((string) $a[$idx] !== (string) $part) {
                    return false;
                }
            }
            return true;
        }
    }
}

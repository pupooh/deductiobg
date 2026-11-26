# Deductio — BGA Studio Implementation Plan

This document outlines the recommended architecture and implementation plan for building **Deductio** (2–4 players, BGG ID `397227`) on the Board Game Arena (BGA) framework using the modern PHP 8+ & ESM JavaScript/TypeScript template already initialized in this repository.

---

## 1. Repository & Build Setup

The project is initialized with the modern BGA Studio template:
- **Backend**: PHP 8+ (`modules/php/Game.php`, `modules/php/States/*.php`) using `Bga\GameFramework\Table`, `Bga\GameFramework\States\GameState`, `#[PossibleAction]`, and `$this->bga->notify` / `$this->bga->playerScore`.
- **Frontend**: `modules/js/Game.js` (ESM) with optional TypeScript + SCSS pipeline in `src-disabled/` (`package.json`, `rollup.config.mjs`, `tsconfig.json`).
- **Recommendation**:
  - Enable the TypeScript + SCSS pipeline by renaming `src-disabled/` to `src/` and running `npm install` + `npm run build` (or keep plain `modules/js/Game.js` + `deductiobg.css` if avoiding a build step). TypeScript is recommended because `bga-framework.d.ts` is already present and provides type safety for `BgaCards`, `BgaAnimations`, state args, and notifications.
  - Use BGA's built-in ESM libraries via `globalThis.importEsmLib`:
    - `bga-animations` (`1.x`) for smooth card movement and flip animations.
    - `bga-cards` (`1.x`) for managing decks, the 3-card Clue row, face-up Secret Numbers, and per-player Clue tableaux (including vertical vs. horizontal orientation).

---

## 2. Configuration Files

### `gameinfos.jsonc`
- Set `"game_name": "Deductio"`.
- `"bgg_id": 397227` (already set).
- `"players": [2, 3, 4]`.
- `"estimated_duration": 20`.
- `"losers_not_ranked": true` (or `false` if ranking losers by number of correctly guessed Secret Number cards — recommended `false` so 2nd/3rd place in 3–4P games can be ranked by `player_score` = guessed Secret Numbers).
- `"language_dependency": false` (cards are purely symbolic).
- `"game_interface_width": { "min": 740 }`.

### `gameoptions.jsonc` & `gamepreferences.jsonc`
- **Game Options (`gameoptions.jsonc`)**: None required for standard rules; optionally add a variant later if desired.
- **User Preferences (`gamepreferences.jsonc`)**:
  - `100`: **Deduction Notepad Auto-Mark** (`0`: Manual only, `1`: Auto-cross-out publicly revealed numbers 1–20 [default]).

### `stats.jsonc`
Track meaningful table and player statistics:
- **Table stats**:
  - `turns_number` (int): Total turns played.
  - `reveal_cards_triggered` (int): Number of "Reveal a Secret Number" cards drawn.
- **Player stats**:
  - `turns_number` (int): Turns taken.
  - `clues_played_vertical` (int): Truthful single Clue cards played.
  - `clues_played_horizontal` (int): All-3-false horizontal Clue sets taken.
  - `abilities_triggered` (int): Clue abilities used.
  - `guesses_correct` (int): Correct Secret Number guesses.
  - `guesses_incorrect` (int): Incorrect Secret Number guesses (including free guesses).
  - `times_guessed` (int): Times this player's Secret Number was guessed.

---

## 3. Card Data & Material Definitions

Create `modules/php/Material.php` (or static data on `Game.php` / `ClueCards.php`) defining all **62 cards** from the rulebook and `assets/Deductio_ASIA_cards_front_print_2024_03.pdf`:

### A. Secret Number Cards (20 cards: `1`–`20`)
Each Secret Number `n` (`1..20`) has derived properties:
- `parity`: `'odd'` (`|`) or `'even'` (`||`)
- `digits`: `'single'` (`#`, 1–9) or `'double'` (`##`, 10–20)

### B. Clue Cards (35 regular + 7 Reveal = 42 cards)
Define each Clue card type with an `id`, `category`, `params`, `ability` (`null | 'free_guess' | 'look_1' | 'look_2'`), and a server-side evaluator:

| Count | Clue Condition | Ability |
|---:|---|---|
| 10 | `≠ X, X+10` for `X` in `1..10` (`≠ 1, 11`, ..., `≠ 10, 20`) | None |
| 4 | `≠ {1,6,9,14,17}`, `≠ {2,5,10,13,18}`, `≠ {3,8,11,16,19}`, `≠ {4,7,12,15,20}` | None |
| 5 | `≠ 1–4`, `≠ 5–8`, `≠ 9–12`, `≠ 13–16`, `≠ 17–20` | None |
| 3 | `≥ 6`, `≥ 7`, `≥ 8` | None |
| 3 | `≤ 13`, `≤ 14`, `≤ 15` | None |
| 4 | `Even (2,4,6...)`, `Odd (1,3,5...)`, `Single digit (#)`, `Double digit (##)` | **Free Guess** |
| 2 | `+1` from any face-up Secret Number, `-1` from any face-up Secret Number | **Look at 1 Card** |
| 4 | `= 1–5`, `= 6–10`, `= 11–15`, `= 16–20` | **Look at 2 Cards** |
| 7 | **Reveal a Secret Number** (all 7 in 2–3P; 5 in 4P) | Immediate event |

### Truth Evaluation Helper
Implement a pure PHP function `isClueTrueForNumber(array $clueDef, int $secretNumber, array $faceUpSecrets): bool`:
- `not_in_set`: `!in_array($secretNumber, $clueDef['values'], true)`
- `gte`: `$secretNumber >= $clueDef['min']`
- `lte`: `$secretNumber <= $clueDef['max']`
- `range`: `$secretNumber >= $clueDef['min'] && $secretNumber <= $clueDef['max']`
- `parity`: `($secretNumber % 2 === 0) === ($clueDef['parity'] === 'even')`
- `digits`: `($secretNumber >= 10) === ($clueDef['digits'] === 'double')`
- `offset_from_revealed` (`+1` / `-1`): checks whether `in_array($secretNumber - $offset, $faceUpSecrets, true)` (i.e., Secret Number is `faceUp + 1` or `faceUp - 1`).

---

## 4. Data Model & Persistence (`ItemManager`)

Instead of defining card tables manually in `dbmodel.sql`, use BGA's **`ItemManager`** (`Bga\GameFramework\Components\ItemManager\ItemManager`) via `$this->bga->itemManagerFactory->createItemManager(...)`. Each item class uses `#[Item]` and `#[ItemField]` attributes, and `ItemManager::initDb()` creates the database tables automatically at the start of `Game::setupNewGame()`.

### Item, Location & Manager Classes (`modules/php/Cards/`)

Define a central **`CardLocation.php`** class with constants for every location used across `SecretCard` and `ClueCard` (avoiding magic strings throughout managers, states, and `Game.php`):
- `CardLocation::DECK = 'deck'` (shared by both Secret and Clue decks)
- `CardLocation::HAND = 'hand'` (`[CardLocation::HAND, $playerId]` — Secret card)
- `CardLocation::REVEALED = 'revealed'` (face-up Secret cards in the center)
- `CardLocation::GUESSED = 'guessed'` (`[CardLocation::GUESSED, $playerId]` — correctly guessed Secret cards)
- `CardLocation::ROW = 'row'` (`[CardLocation::ROW, $slot]` for `$slot` in `0..2` — face-up Clue row)
- `CardLocation::DISCARD = 'discard'` (Clue discard pile)
- `CardLocation::BOX = 'box'` (removed-from-game Reveal cards)
- `CardLocation::TABLEAU = 'tableau'` (`[CardLocation::TABLEAU, $playerId]` — played Clue cards in front of a player)

Each card item class lives under `modules/php/Cards/` and is coupled with a dedicated `ItemManager` class (e.g., extending `ItemManager` or wrapping an `ItemManager` created via `$bga->itemManagerFactory->createItemManager(...)` to provide card-specific queries and state transitions):

1. **`SecretCard.php` + `SecretCardManager.php`** (`#[Item(tableName: 'secret_card')]`):
   - `SecretCard` fields:
     - `#[ItemField(kind: ItemFieldKind::ID)] public int $id;`
     - `#[ItemField(kind: ItemFieldKind::LOCATION)] public array|string $location;`
       - Locations: `CardLocation::DECK`, `[CardLocation::HAND, $playerId]`, `CardLocation::REVEALED`, `[CardLocation::GUESSED, $playerId]`.
     - `#[ItemField(kind: ItemFieldKind::ORDER)] public int $order;`
     - `#[ItemField] public int $number;` (`1..20`)
   - `SecretCardManager` (`ItemManager<SecretCard>`):
     - Encapsulates `setupCards()`, `dealToPlayer(int $playerId)`, `revealTopCard()`, `getPlayerSecretNumber(int $playerId)`, `peekTopCards(int $count)`, and `returnPeekedCardsToBottom(array $orderedCardIds)`.

2. **`ClueCard.php` + `ClueCardManager.php`** (`#[Item(tableName: 'clue_card')]`):
   - `ClueCard` fields:
     - `#[ItemField(kind: ItemFieldKind::ID)] public int $id;`
     - `#[ItemField(kind: ItemFieldKind::LOCATION)] public array|string $location;`
       - Locations: `CardLocation::DECK`, `[CardLocation::ROW, $slot]` (`$slot` in `0..2`), `CardLocation::DISCARD`, `CardLocation::BOX`, `[CardLocation::TABLEAU, $playerId]`.
     - `#[ItemField(kind: ItemFieldKind::ORDER)] public int $order;`
     - `#[ItemField] public int $clueTypeId;` (`1..35` for regular Clue cards, `0` or `99` for Reveal cards)
     - `#[ItemField] public bool $isReveal;` (`true` for the 7 "Reveal a Secret Number" cards)
     - `#[ItemField] public string $orientation = 'vertical';` (`'vertical' | 'horizontal'`)
   - `ClueCardManager` (`ItemManager<ClueCard>`):
     - Encapsulates `setupCards(int $playerCount)`, `getRowCards()`, `playVertical(ClueCard $card, int $playerId)`, `playAllHorizontal(int $playerId)`, `discardPlayerTableau(int $playerId)`, and `discardHorizontalAdjacentClues()`.

### Manager Initialization & `ItemLocation` Setup
In `Game::__construct()`:
- Instantiate `$this->secretCards = new SecretCardManager($this->bga->itemManagerFactory, ...)` and `$this->clueCards = new ClueCardManager($this->bga->itemManagerFactory, ...)` (each coupling the item class with its `ItemManager` configured via `$itemManagerFactory->createItemManager(...)`).
- Configure `ItemLocation(CardLocation::DECK, autoReshuffleFrom: CardLocation::DISCARD, autoReshuffleCallback: ...)` inside `ClueCardManager` so picking from an empty `CardLocation::DECK` automatically reshuffles `CardLocation::DISCARD` into `CardLocation::DECK` (and never touches `CardLocation::BOX`, where Reveal cards are placed).
- In `Game::setupNewGame()`, call `$this->secretCards->initDb()` and `$this->clueCards->initDb()` before creating items with `createItems(...)` and shuffling `CardLocation::DECK`.
- Use `changeIdsForLocation(CardLocation::DECK)` on reshuffle (or when cards become hidden) if you want to prevent ID-tracking across shuffles.

### `dbmodel.sql` & Deduction Notes
- `dbmodel.sql` requires **no custom card tables**.
- Store per-player Deduction Notepad state either client-side in `localStorage` (keyed by table + player ID) or in `$this->globals` (per-player key) if cross-device persistence is desired, keeping `dbmodel.sql` completely clean.

### Game Globals (`$this->globals`)
Use `$this->globals` (JSON-capable BGA globals) for turn sub-state:
- `penaltyRemaining` (`int`, `0..2`): Remaining forced "Play a Clue card" actions after an incorrect guess.
- `isPenaltyTurn` (`bool`): Tracks whether abilities are suppressed during the current Clue play.
- `peekedCardIds` (`int[]`): Temporarily holds the 1 or 2 `SecretCard::$id` values currently being viewed by the active player during `LookAtCards`, validated before putting them on the bottom of the deck.

---

## 5. Server-Side State Machine (`modules/php/States/`)

Design clean, single-responsibility `GameState` classes:

```
setupNewGame()
   └──> PlayerTurn (10)
          ├── actPlayClue(cardId)
          │     ├── [normal turn & Free Guess] ──> FreeGuess (20) ──> NextPlayer (90)
          │     ├── [normal turn & Look 1/2]   ──> LookAtCards (25) ──> NextPlayer (90)
          │     ├── [penaltyRemaining > 0]     ──> PlayerTurn (10)  [same player, penalty mode]
          │     └── [otherwise]                ──> NextPlayer (90)
          ├── actPlayAllHorizontal()
          │     ├── [penaltyRemaining > 0]     ──> PlayerTurn (10)  [same player, penalty mode]
          │     └── [otherwise]                ──> NextPlayer (90)
          └── actGuess(targetPlayerId, guessedNumber)
                ├── [correct & score >= targetWin] ──> EndScore (98) ──> ST_END_GAME (99)
                ├── [correct & not won yet]        ──> NextPlayer (90)
                └── [incorrect]                    ──> PlayerTurn (10) [penaltyRemaining = 2]
```

### State Details
1. **`PlayerTurn` (`id: 10`, `ACTIVE_PLAYER`)**:
   - `getArgs(int $activePlayerId)`:
     - Reads `penaltyRemaining` from `$this->globals`.
     - Reads active player's Secret Number (`secret_card` in `'hand'` for `$activePlayerId`), the 3 Clue cards in `'row'`, and the `'revealed'` Secret Numbers.
     - Computes `truthfulClueIds: int[]` (ONLY sent to the active player via private args or filtered in `getArgs`? **Important**: in BGA, `getArgs()` is visible to ALL players! Never return `truthfulClueIds` in public `getArgs()` because that would leak which clues match the active player's Secret Number! Instead:
       - Send `penaltyRemaining` and `canGuess` (`$penaltyRemaining === 0`) in `getArgs()`.
       - The active player's client already knows their own Secret Number from `getAllDatas` / private notification and can highlight truthful clues locally; `actPlayClue` and `actPlayAllHorizontal` strictly validate truth on the server!).
   - `#[PossibleAction] actPlayClue(int $cardId, int $activePlayerId)`:
     - Verify `$cardId` is in `'row'` and `isClueTrueForNumber(...) === true`.
     - Move card to `'tableau'` for `$activePlayerId` with `card_orientation = 'vertical'`.
     - Replenish Clue row (handling any `"Reveal a Secret Number"` cards + reshuffling discard if needed).
     - Check ability if `penaltyRemaining === 0`:
       - `'free_guess'` -> return `FreeGuess::class`
       - `'look_1'` or `'look_2'` -> draw top 1 or 2 cards from `secret_card` deck into `peekedCardIds`, notify active player privately, return `LookAtCards::class` (if deck has 0 cards, skip directly to `NextPlayer::class`).
     - If `penaltyRemaining > 0`, decrement `penaltyRemaining` and return `PlayerTurn::class`; else return `NextPlayer::class`.
   - `#[PossibleAction] actPlayAllHorizontal(int $activePlayerId)`:
     - Verify **none** of the cards in `'row'` are truthful for `$activePlayerId`'s Secret Number.
     - Move all cards in `'row'` to `'tableau'` for `$activePlayerId` with `card_orientation = 'horizontal'`. No abilities trigger.
     - Replenish Clue row.
     - If `penaltyRemaining > 0`, decrement `penaltyRemaining` and return `PlayerTurn::class`; else return `NextPlayer::class`.
   - `#[PossibleAction] actGuess(int $targetPlayerId, int $number, int $activePlayerId)`:
     - Verify `penaltyRemaining === 0`, `$targetPlayerId !== $activePlayerId`, `$targetPlayerId` is a valid player, `$number` is `1..20`.
     - Look up `$targetPlayerId`'s Secret Number.
     - **If correct**:
       - Move `$targetPlayerId`'s Secret Number card to `'guessed'` for `$activePlayerId`.
       - Increment `$this->bga->playerScore->inc($activePlayerId, 1)`.
       - Check win threshold (`3` for 2P, `2` for 3–4P). If met -> notify & return `EndScore::class`.
       - Otherwise, discard all Clue cards in `$targetPlayerId`'s `'tableau'` to `'discard'`, draw a new Secret Number from `secret_card` `'deck'` to `'hand'` for `$targetPlayerId`, and send a private notification to `$targetPlayerId` with their new Secret Number.
       - Return `NextPlayer::class`.
     - **If incorrect**:
       - Set `penaltyRemaining = 2` in `$this->globals`.
       - Notify all players of the incorrect guess (without revealing `$targetPlayerId`'s number).
       - Return `PlayerTurn::class`.
   - `zombie(int $playerId)`:
     - If `truthfulClueIds` is non-empty, call `actPlayClue` with a random truthful card; otherwise call `actPlayAllHorizontal`.

2. **`FreeGuess` (`id: 20`, `ACTIVE_PLAYER`)**:
   - `#[PossibleAction] actFreeGuess(int $targetPlayerId, int $number, int $activePlayerId)`:
     - Same resolution as `actGuess`, except on an **incorrect** guess there is **no penalty** (`penaltyRemaining` stays `0`) and it transitions to `NextPlayer::class`.
   - `#[PossibleAction] actSkipFreeGuess(int $activePlayerId)`:
     - Player declines the optional free guess -> `NextPlayer::class`.

3. **`LookAtCards` (`id: 25`, `ACTIVE_PLAYER`)**:
   - Entered when `look_1` or `look_2` is triggered and at least 1 card exists in `secret_card` `'deck'`.
   - `getArgs()`: Do **not** expose the peeked numbers in `getArgs()` (public); send them via `$this->bga->notify->player($activePlayerId, 'peekSecretCards', ...)` when entering the state (and include them in `getAllDatas($currentPlayerId)` only when `$currentPlayerId === $activePlayerId` so F5 refresh works).
   - `#[PossibleAction] actReturnPeekedCards(array $orderedCardIds, int $activePlayerId)`:
     - Validate `$orderedCardIds` is a permutation of `peekedCardIds`.
     - Place cards on the **bottom** of the `secret_card` `'deck'` in the specified order using `ItemManager` (e.g., `moveItem($card, 'deck', order: 0)` or `setItemOrder($card, ...)` relative to existing deck items so the peeked cards sit at the bottom).
     - Clear `peekedCardIds` and return `NextPlayer::class`.

4. **`NextPlayer` (`id: 90`, `GAME`)**:
   - Give extra time, call `$this->game->activeNextPlayer()`, transition to `PlayerTurn::class`.

5. **`EndScore` (`id: 98`, `GAME`)**:
   - Reveal all remaining players' hidden Secret Number cards via public notification so everyone can see the final numbers, then transition to `ST_END_GAME` (`99`).

---

## 6. Clue Row Replenishment & "Reveal a Secret Number" Edge Cases

Centralize replenishment in `Game::replenishClueRow()`:
1. Loop over open slots (`0..2`) in `[CardLocation::ROW, $slot]`:
   - Pick the top card from `CardLocation::DECK` via `$this->clueCards->pickItem(CardLocation::DECK, [CardLocation::ROW, $slot])` (with `autoReshuffleFrom: CardLocation::DISCARD`, `ItemManager` automatically reshuffles `CardLocation::DISCARD` into `CardLocation::DECK` if `CardLocation::DECK` is empty, and returns `null` if both are empty).
   - If `$card->isReveal` is `true`:
     - Move it to `CardLocation::BOX` (removed from game).
     - Pick the top card from `$this->secretCards` `CardLocation::DECK` (if non-empty) and move to `CardLocation::REVEALED`.
     - Query `$this->clueCards->getItemsInLocation([CardLocation::TABLEAU, null])` (wildcard across all players) for cards with `orientation === 'horizontal'` and `clueTypeId` matching `+1` or `-1` -> move them to `CardLocation::DISCARD` and notify all players.
     - Notify all players of the revealed Secret Number.
   - Else (regular Clue card):
     - Ensure it is in `[CardLocation::ROW, $slot]` and continue to the next open slot.
2. Note: During `setupNewGame`, draw the 3 initial `[CardLocation::ROW, $slot]` Clue cards **before** creating/shuffling the `'reveal'` cards into `CardLocation::DECK` (matching official setup steps 3–5).

---

## 7. Security & Hidden Information Checklist

- **`getAllDatas(int $currentPlayerId)`**:
  - Never send opponents' `'hand'` cards from `secret_card`.
  - Send `$currentPlayerId`'s own Secret Number card (or `null` if spectator).
  - Send `peekedCards` only if `$currentPlayerId === activePlayerId` and state is `LookAtCards`.
  - Never send `secret_card` `'deck'` or `clue_card` `'deck'` card contents/order — only send deck **counts**.
- **`getArgs()`**:
  - Never include `truthfulClueIds` or `peekedCards` in `getArgs()` since BGA broadcasts `getArgs()` to all connected clients.

---

## 8. Frontend UI/UX & Asset Pipeline

### Asset Extraction (`assets/` -> `img/`)
- Convert pages of `assets/Deductio_ASIA_cards_front_print_2024_03.pdf` (cropping print bleed/crop marks) into clean spritesheets:
  - `img/clue_cards.webp` (or `.png`): 35 Clue cards + 1 Reveal card + Clue card back.
  - `img/secret_cards.webp` (or `.png`): 20 Secret Number cards + Secret Number card back.
- Extract box art from `assets/Deductio_INTL_box_top_print_2024_03_no_die-cut.pdf` for BGA game banner/thumbnail.

### Table Layout (`modules/js/Game.js` + `deductiobg.css`)
1. **Center Table Area**:
   - **Secret Number Zone**: Secret Number deck (with remaining count badge) + row of face-up **Revealed Secret Numbers** (numbers nobody can have).
   - **Clue Zone**: Clue deck (with remaining count) + discard pile + **3-card Clue Row**.
     - On your turn, truthful Clue cards are highlighted as clickable; if none are truthful, show a prominent **"Take All 3 (Horizontal)"** action button in the status bar.
2. **Player Tableaux**:
   - Each player's area displays:
     - Their current hidden Secret Number card (face-up to you, card-back to opponents) + **Guessed Secret Numbers** collected face-up.
     - Their **Clue Tableau**: vertical cards (true clues) clearly separated or visually upright, and horizontal cards (false clues) rotated 90° (`transform: rotate(90deg)` or compact rotated slot) so the orientation is immediately readable.
   - Clicking an opponent's Secret Number card (or a **"Guess"** button on their panel) opens a clean **1–20 Number Picker** modal/inline bar (auto-dimming numbers already publicly revealed or guessed!).
3. **Interactive Deduction Notepad**:
   - Collapsible/dockable **1–20 Grid** per opponent right in the player's HUD/table area, allowing players to click numbers to mark them eliminated/possible, with optional auto-elimination of publicly revealed/guessed Secret Numbers (controlled by user preference `100`).
4. **Private Peek Dialog (`LookAtCards`)**:
   - Modal/overlay showing the 1 or 2 peeked Secret Number cards; for `Look at 2 Cards`, allow clicking/swapping order before clicking **"Put on Bottom of Deck"**.

---

## 9. Recommended Implementation Phases

1. **Phase 1 — Foundation & Assets**:
   - Crop and build card spritesheets in `img/`.
   - Update `gameinfos.jsonc`, `stats.jsonc`, and `gamepreferences.jsonc`.
   - Create `SecretCard`, `SecretCardManager`, `ClueCard`, and `ClueCardManager` under `modules/php/Cards/`, plus `Material.php` with all 62 card definitions and `isClueTrueForNumber()`.
2. **Phase 2 — Core Server Logic**:
   - Implement `setupNewGame`, `getAllDatas`, `replenishClueRow`, `PlayerTurn`, `FreeGuess`, `LookAtCards`, `NextPlayer`, and `EndScore`.
   - Add PHPUnit or BGA Studio debug helpers (`debug_*` methods) to test edge cases (all-3 horizontal, `+1`/`-1` horizontal discard on Reveal, penalty 2-clue turn without abilities, 2P vs 3P vs 4P win thresholds, empty deck guards).
3. **Phase 3 — Frontend & Animations**:
   - Integrate `bga-cards` and `bga-animations` for all card zones and transitions.
   - Build the Guess 1–20 picker, Look-at-2 ordering UI, and interactive Deduction Notepad.
4. **Phase 4 — Polish, Modernization Audit & BGA Checklist**:
   - Verify hidden information (open a second incognito/player session in BGA Studio and inspect network/gamedatas).
   - Test F5 page reload in every state (`PlayerTurn`, `FreeGuess`, `LookAtCards`, penalty turn).
   - Test Zombie mode and mobile/responsive layout (`min: 740`).
   - Run targeted `modernize-bga-game-project` skill workflows (see Section 10) to audit PHP 8.4, ESM/TypeScript, and BGA API compliance.

---

## 10. Using `modernize-bga-game-project` Skills

Although this project starts from a modern BGA Studio template, use the **`modernize-bga-game-project`** skill as a structured audit and cleanup pass during/after implementation:

1. **Refresh Framework Helpers First**:
   - Before running any workflow, download the latest `_ide_helper.php` and `bga-framework.d.ts` from BGA Studio so API signatures and types are current.
2. **Applicable Workflows to Run Explicitly (in skill table order)**:
   - `bga-jsonc-files` & `bga-gameinfos-cleanup`: Verify `gameinfos.jsonc`, `gameoptions.jsonc`, `gamepreferences.jsonc`, and `stats.jsonc` contain no deprecated keys or legacy `.inc.php` remnants.
   - `bga-autoload` & `bga-strict-types`: Confirm `declare(strict_types=1);` and PSR-4 namespace-to-file autoloading across `modules/php/Cards/`, `modules/php/States/`, and `modules/php/Game.php`.
   - `bga-new-apis` & `bga-server-translations`: Verify all notifications use `$this->bga->notify` with `clienttranslate()` / `NotificationMessage`, and stats/counters/scores use the modern `$this->bga` services.
   - `bga-php8-code`: Apply PHP 8.4 idioms (constructor property promotion, native helpers, typed properties/return types) across new `Cards/` and `States/` classes.
   - `bga-autowired-actions`, `bga-game-state-classes`, & `bga-active-player-state-classes`: Audit `#[PossibleAction]` signatures and state transitions.
   - `bga-js`, `bga-replace-dojo`, & `bga-es6`: Ensure all UI code uses native DOM + `this.bga.*` APIs (no Dojo) in `src/` TypeScript sources, then regenerate `modules/js/Game.js` with `npm run build`.
   - `bga-zombie-random-move`: Verify `zombie()` in `PlayerTurn`, `FreeGuess`, and `LookAtCards` performs a legal move via the state's action rather than skipping.
3. **Skill Guardrails to Follow**:
   - Do not introduce new PHP traits during implementation or modernization.
   - Always edit `src/` TypeScript files (when `src/` is enabled) and rebuild `modules/js/Game.js` via `npm run build` rather than patching generated JS directly.
   - Invoke workflows explicitly by name (e.g., *"Use modernize-bga-game-project for bga-php8-code and bga-zombie-random-move"*) rather than running unrequested migrations.

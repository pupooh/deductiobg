/*
To use the BGA libs, add `import { BgaAnimations, BgaCards } from "./libs";` in the files using them.

To get the latest typing files (that you would save at the root of your game), read the lib doc and see the demo, go to:
https://doc.studio.boardgamearena.com/framework-documentation/front-end/libs/bga-animations/
https://doc.studio.boardgamearena.com/framework-documentation/front-end/libs/bga-cards/
*/

/*
 * Studio loads bga-cards / bga-animations from BGA's CDN
 * (x.boardgamearena.net/data/game-libs/ - 1.x dist UMD builds), NOT from
 * GitHub thoun/bga-cards. The CDN build exports the manager as `Manager`
 * (settings-only constructor); the GitHub 1.1.2 code exports `CardManager`
 * (game, settings) — a different lineage. Trust the CDN dist .d.ts files
 * at the repo root, never the GitHub tags or doc pages.
 */
const BgaAnimations: typeof globalThis.BgaAnimations = await globalThis.importEsmLib('bga-animations', '1.x');
const BgaCards: typeof globalThis.BgaCards = await globalThis.importEsmLib('bga-cards', '1.x');

export { BgaAnimations, BgaCards };

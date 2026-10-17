# Aion 2 stat calculators

English/Korean extension of [Bongbong's calculator](https://github.com/bongbong99999-debug/aion2ssow), with its original layout, formulas, efficiency bars, saved comparisons, and Combat Speed thresholds. A separate NotMeter mode has its own inputs, engine, and saved comparisons.

`index.html` is the original upstream file. Edit `extension/` and `build.py`; generated files live in `dist/` and are not committed. Build with `python build.py`, run model checks with `npm test`, and preview with `python -m http.server 8790 --directory dist`.

For browser checks, run `npm ci`, `npx playwright install chromium`, then `npm run test:browser`. An installed Chrome can be selected with `STATS_BROWSER_CHANNEL=chrome` (set `$env:STATS_BROWSER_CHANNEL='chrome'` in PowerShell). The checks serve the generated page locally, compare upstream calculations, exercise imports/languages/saves, and save desktop/mobile review images under `dist/`.

## Localization

`extension/translations.txt` maps Korean display text to English. The runtime translates text nodes and messages, preserving original select values and calculation identifiers. Switching language preserves inputs. Confirmed terminology comes from NotMeter's paired Korean/English catalogs, including [client terms](https://notmeter.com/assets/client-terms.js?v=20261009-orbit) and [stat page labels](https://notmeter.com/assets/stat-efficiency.js?v=20261013-hard-hit). Compact field/chart labels use DPH, Crit, Front/Back Boost, and Multi-hit Chance to preserve the original row geometry. Speed research notes identify provisional skill translations; verbose translation qualifications are kept out of controls. Combat Speed is a threshold reference and does not estimate DPS.

The build checks required integration anchors and reports missing static translations. Browser checks exercise dynamic labels across classes and comparison/save actions. The generated page disables the author's live Apps Script comment endpoint; attribution, donation details, and research links remain.

## Shared NotMeter import

One paste populates both models from `NOTMETER_STATS_V4:` followed by Base64 UTF-8 JSON with schema `notmeter-stat-efficiency-profile-v4`. Parsing, validation, calculation, and persistence are local to the browser.

Character stats and unbuffed Combat Speed start empty. Imported, manually entered, and explicitly saved values persist; inherited example values from earlier visits are cleared. Reset clears Bongbong character stats. Results wait for character inputs instead of displaying calculations from examples. Target presets and combat scenario settings remain available.

The confirmed consumer contract is NotMeter's public `stat-efficiency.js`. Its documented fields include divine points, attack components, Perfect/Double Chance, and damage boosts. Public repositories and web scripts were inspected; the desktop copy producer's implementation was not publicly available. Therefore no unconfirmed aliases for penetration, critical rating, Multi-hit, or speed are guessed. Unknown producer fields are preserved in the canonical profile and listed in the import report, allowing future mapping after a real sample confirms their meaning.

Bongbong Attack is reconstructed as `(attack + additionalAttack + (minimumAttack + maximumAttack) / 2) * (1 + attackIncreasePercent / 100)`. This excludes Perfect Chance and Weapon Damage Boost. If any component is missing, the existing Attack remains. Matching boosts and Double Chance map directly. Missing fields retain actual prior values or stay empty and are visibly marked. Target presets and buffs remain scenario settings. Subsequent edits in one mode do not modify the other mode.

## NotMeter model

`extension/models.js` independently implements the public [NotMeter calculation reference](https://notmeter.com/assets/stat-efficiency-calculator.js?v=20261013-hard-hit), observed 2026-10-16. Golden numeric fixtures were recorded from that reference; the original implementation is not bundled. The interface follows its stat page's request assumptions (race boost, combat Attack Increase, party Damage Boost, and boss Damage Tolerance are fixed to zero there). Defense, penetration, Multi-hit, and Bongbong tolerances are not mixed into this engine.

Divine stats are already reflected in imported percentages. Only changes from the imported divine baseline become option changes. Critical chance and other combat assumptions remain manual. Damage is a relative comparison, without skill rotation or cooldown modeling. A real desktop export is still needed to confirm producer compatibility.

Boss Double Resist defaults to 0% at the site owner's request. Earlier inherited 30% values are migrated to zero; explicitly edited scenario values are retained. This is a configurable assumption, not a measured boss value.

## Pulling upstream updates

1. `git fetch upstream` then `git merge upstream/main` on a feature branch.
2. Run `python build.py`. Review new text and changed integration points; update the translation catalog and adapters.
3. Run `npm test` and the browser compatibility checks from the hosting project. Review both languages and all classes.
4. Commit and push the fork, then use its full commit SHA with the hosting project's `update-stats.py --revision SHA`.

The crafting host vendors only the generated runtime files plus a revision/hash manifest. Scheduled market updates require no network access to this repository and cannot remove `/stats/`. The root upstream file stays untouched, making future merges straightforward.

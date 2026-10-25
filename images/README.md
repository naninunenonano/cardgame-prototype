# Optional PNG artwork

Character: `images/characters/<internal-character-key>/lv0.png` through `lv4.png`.
Example: `images/characters/piruluk/lv0.png`.
Regular card: `images/cards/<internal-card-key>.png` (e.g. `images/cards/life.png`).

Use `key` from CardCatalog, never a localized display name or runtime instance `id`. Images are optional, loaded only when rendered; failed loads leave text in place. Prefer 2:3 PNG. Case-sensitive on GitHub Pages.

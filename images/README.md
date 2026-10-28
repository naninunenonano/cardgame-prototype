# Optional PNG artwork

Character: `images/characters/<internal-character-key>/lv0.png` through `lv4.png`.
Example: `images/characters/almar/lv0.png`.
Regular card: `images/cards/<internal-card-key>.png` (e.g. `images/cards/life.png`).

Use `key` from CardCatalog, never a localized display name or runtime instance `id`. Images are optional, loaded only when rendered; failed loads leave text in place. Prefer 2:3 PNG. Case-sensitive on GitHub Pages.

## アルマーとアストレアの登録先

アルマーは `images/characters/almar/lv0.png`、`lv1.png`、`lv2.png`、`lv3.png`、`lv4.png`。旧フォルダの既存5画像は内容を変えず移動済みです。

白銀の戦乙女 アストレアの内部IDは旧名称由来ではない既存の `r1` を維持します。PNGは **`images/cards/r1.png`**。`astrea.png` ではありません。1024×1536px（2:3）のPNGを推奨します。

GitHubの対象フォルダで **Add file → Upload files** を選び、上記の名前のPNGをアップロードしてコミットしてください。Pagesのデプロイ完了後にゲームを再読み込みすると、コード変更なしで表示されます。同名の画像を置き換えた後に古い画像が残る場合は、ブラウザのキャッシュを更新して再読み込みしてください。ファイル名は大文字・小文字を区別します。

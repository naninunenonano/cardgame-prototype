# PNG画像の登録先（Ver.0.33以降）

| 種類 | 登録先 |
|---|---|
| キャラクター | images/characters/キャラクターID/lv0.png〜lv4.png |
| 一般カード・トークン | images/cards/内部ID.png |
| キャラクター専用カード | images/characters/キャラクターID/cards/キャラクター接頭辞を除いた内部ID.png |
| 複数面 | 上記の内部IDに-1、-2、-3などの面番号を含める |

例：`almar_sbbu1-2` → `images/characters/almar/cards/sbbu1-2.png`。

アルマーは従来どおり `images/characters/almar/lv0.png`、`lv1.png`、`lv2.png`、`lv3.png`、`lv4.png` です。

アストレアは **images/cards/rl1.png**、オーレリアは **images/cards/bl1.png** です。旧ファイル名r1.png・b1.pngは使用しません。

通常の1面カードには枝番号を付けません。トークンはt1〜t6。カードリストのID、または [全カードの対応表](../docs/id-migration.csv) を確認してください。台帳・採番方法は [説明](../docs/id-unification-status.md) を参照してください。

推奨PNG：1024×1536px（2:3）。GitHubの登録先で **Add file → Upload files** を選び、正しい名前でアップロードしてコミットします。Pagesデプロイ完了後に再読み込みするとコード変更なしで表示されます。未登録・読み込みエラー時は文字表示に戻ります。ファイル名は大文字・小文字を区別します。

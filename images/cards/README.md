# カードPNG（Ver.0.33以降）

一般カードは、新内部IDをファイル名にします。旧IDのファイル名は使用しません。画像未登録の場合は文字表示になります。

| カード | 内部ID | PNG登録先 |
|---|---|---|
| 白銀の戦乙女 アストレア | rl1 | images/cards/rl1.png |
| ロイヤルセイバー・オーレリア | bl1 | images/cards/bl1.png |
| フェアリー・ライフ | gn1 | images/cards/gn1.png |
| 偽りの月 インターステラ（UR） | almar_sbbu2 | images/characters/almar/cards/sbbu2.png |

トークンは `images/cards/t1.png` など。専用カードはこのフォルダではなく、所有キャラクターの `cards/` フォルダへ登録します。複数面は基本IDではなく `-1` / `-2` などの面IDを使用します。

全カードの旧ID・新ID・画像パスは [対応表](../../docs/id-migration.csv) を参照してください。既存のアストレア画像はr1.pngからrl1.pngへ内容不変で移動しました。

推奨：PNG、1024×1536px、縦横比2:3。GitHubの **Add file → Upload files** から、正しい登録先へ上記の名前でアップロードしコミットしてください。Pagesデプロイ完了後にゲームを再読み込みすると、追加コード変更なしで表示されます。同名画像の差し替え後に古い画像が残る場合はキャッシュを更新してください。

# 初心者Botの通常カード勝敗別使用率

PR #57マージ時点のデッキで異色6対面を各200戦実施。前回と同じシード1〜100を再実行し、101〜200を追加した。各対面で先攻は100戦ずつ。シード1〜100は前回の勝者・先攻・決着ターン・最終ライフと照合する。

## 使用の定義

初期手札と山札にあった各Botの40枚をカード実体IDで追跡する。呪文は使用宣言、クリーチャーは登場成立、設置物は場への設置を数える。打ち消された呪文は使用済みとし、登場を置換されたクリーチャーは数えない。効果による登場やトラッシュからの再使用は集計する。ドロー、チャージ、手札への追加、攻撃、場の中だけでの移動は集計対象外。

カードIDごとの使用試合数は各試合で最大1。使用実体数は同じ物理カードを1試合で1回だけ数え、イベント数は再使用も数える。試合明細では `ID:実体数:イベント数` をスペース区切りで保存する。決着ターンは両プレイヤーのターンを通算した番号。

前回の決定打回数はPR #57の600戦から転記し、前回の対象外だったカードは区別した。使用と勝率の関係には先後・対面・試合時間・盤面の影響がある。使用機会不足の目安は該当範囲の5%未満。入れ替え候補表は5%以上で使用時勝率が未使用時より低いカードを抽出した比較用の一覧。

## CSV

- [通常カード全種類の集計](beginner-bot-card-usage-summary.csv)
- [対面別](beginner-bot-card-usage-by-matchup.csv)
- [先攻・後攻別](beginner-bot-card-usage-by-turn-order.csv)
- [指標別ランキング](beginner-bot-card-usage-ranking.csv)
- [試合明細](beginner-bot-card-usage-games.csv)

## 再実行

```sh
node beginner-matchup-test.cjs 200 --usage > /tmp/beginner-usage.json
node beginner-card-usage-report.cjs reports/beginner-card-usage /tmp/beginner-usage.json
node beginner-card-usage-test.cjs
```

`BOT_PAIR=blueBeginner:redBeginner` のように対面別に実行した場合は、集計コマンドの末尾に6個のJSONを指定する。

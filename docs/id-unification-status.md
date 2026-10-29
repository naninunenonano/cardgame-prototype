# レアリティ・ID統一

基準main: e220f6d914ad29ca78d2a7c07f80148a052c65cc。全164定義の旧値は pre-migration-catalog.json に固定保存。id-unification-audit.* は初回調査の履歴です。確定対応表は **id-migration.json / id-migration.csv** です。

旧SSR13件→UR、旧UR28件→LEGEND。別管理の覚醒後5形態もSSR→UR。効果・数値は旧定義との正規化比較で照合しています。インターステラはアルマー専用青サイドボードのUR、基本ID almar_sbbu2。

ユーザー指定：ガンヴィート／アレグル／時空ボルシャック／モルトNEXT／ドラヴィタの5組すべてに枝番号。所有・採用はbaseId、表示・画像はfaceId。通常の単面カードに枝番号なし。形態は複数面に拡張でき、番号は不変です。

キャラクターは almar / celestia を維持し、旧大文字を含む4IDは最終指示の小文字規則に従って小文字へ移行。旧IDも保存データ読み込み時に解決します。生成専用呪文は通常カード区分で採番し、既存のgeneratedフラグと収集不可を維持。トークンは独立してt1〜t6。

## 新カードの採番

id-registry.js が永続台帳です。旧ID別名、基本ID、面ID、旧/新レアリティ、所属、専用先、使用済み最大連番、廃止済みIDを保持します。項目・使用済み番号を削除しないでください。

例： `node id-allocation.cjs '{"name":"新カード","rarity":"UR","color":"青","section":"main"}'`。新IDを出力して台帳へ予約します。そのIDでカード定義を追加してください。専用はownerCharacterId、トークンはtoken:true。色配列は白青黒赤緑へ正規化。4色は禁止。exf/exs/exx/exl/exg予約のみで新召喚処理はありません。廃止はretire APIで記録し、台帳から削除しません。

旧実装の定義構築後、identity.js が台帳に基づいて一度だけ公開カタログへ正規化します。既存の効果ラベル・能力名をカードIDと混同せず、key/tokenKey/chargerKey/requiredCharacterと形態参照を更新します。新カードは台帳へ追加せず定義だけ追加しないでください。

## 保存データ

実際の保存先 cardgame-prototype.collection.v1 と cardgame-prototype.decks.v1 を維持。所持キー、各プロフィール、デッキ内参照、キャラクターを正規化。素材・通貨・ミッション・履歴は再計算しません。未知IDは保持し、プロフィールのmigrationUnknownIdsにも記録します。同一IDの旧名と新名が並存する場合は最大所持数を維持し、再実行で加算しません。既存の競合・容量失敗保護を維持します。

## 画像

既存 images/cards/r1.png は **images/cards/rl1.png** へ内容不変で移動。アルマーLv0〜4は従来パスを維持。一般はimages/cards/<faceId>.png、専用はimages/characters/<owner>/cards/<ownerを除いたfaceId>.png。欠損画像の文字代替を維持。対応表のパスを確認して登録してください。

## 検証状況

実装途中のチェックポイント。全回帰・ブラウザ検証が完了するまでマージしません。新エクストラカード・盤面・召喚処理は対象外です。

# LinkOra 実装計画

企画: [pixapps_strategy#25 — LinkOra: 国境を越えた関心と情報格差を可視化するデータプロダクト企画](https://github.com/yosuke1024/pixapps_strategy/issues/25)

本ドキュメントは、上記企画の MVP（Phase 1: Internal validation）を実装するための計画。スコア式やデータソースの詳細は検証しながら変えるため、ここでは**アーキテクチャの骨格・データモデル・マイルストーン**を固定し、個々のシグナルの算出方法は差し替え可能な形で定義する。

---

## 1. ゴールと非ゴール

### Phase 1 のゴール（企画書の成功条件に対応）

1. 対象 10 か国の Directed Interest Graph（最大 90 edge）を生成できる
2. 主要 signal の出所と制約（利用規約・粒度・更新頻度）を説明できる
3. 同じ入力から同じ結果を再計算できる（再現性）
4. Trend を時系列で保存できる
5. Loka の初期 edge 選定に使えるランキングを出力できる

### 非ゴール（このリポジトリでやらないこと）

- 全世界対応、B2B SaaS UI、Billing、Enterprise API、OSS 公開
- 「好感度」の推定、単一の絶対スコアの提示
- raw third-party data の再配布・再販売
- Media Foundry 全体の実装

---

## 2. 全体アーキテクチャ

固定費を増やさないため、**サーバーレスの定期バッチ + 静的成果物**で構成する。常駐サーバー・マネージド DB は持たない。

```text
┌────────────── GitHub Actions (cron, 週次) ──────────────┐
│                                                          │
│  Stage 1: fetch      各 provider から raw data を取得     │
│  Stage 2: normalize  共通スキーマ（signal record）へ正規化 │
│  Stage 3: score      edge 単位で集約・スコア算出           │
│  Stage 4: export     JSON / CSV / dashboard 用データ出力  │
│                                                          │
└──────────────┬───────────────────────────────────────────┘
               │
       Cloudflare R2 (object storage)
       ├── raw/        取得した生データ（再計算用・非公開）
       ├── normalized/ 正規化済み signal（Parquet/JSON）
       └── exports/    edges.json / edges.csv / topics.json
               │
       内部 Dashboard（静的 SPA、Cloudflare Pages・アクセス制限付き）
```

設計上の要点:

- **fetch と score の分離**: raw data を必ず保存してから派生スコアを計算する。スコア式を変更しても、過去の raw data から全期間を再計算できる（再現性の担保）。
- **provider は交換可能**: すべてのデータソースは共通インターフェース（後述）を実装する。単一 provider（特に Google Trends）への依存で全体が止まらない構成にする。
- **AI API は必須にしない**: パイプライン本体は AI なしで動く。Topic 分類など AI が明確に価値を出す箇所のみ、オプションのステージとして追加する。

### 技術スタック

| 項目 | 選定 | 理由 |
|---|---|---|
| 言語 | TypeScript (Node.js 22) | PixApps 既存リポジトリの構成と揃える。型でスキーマを固定しやすい |
| 実行基盤 | GitHub Actions (cron) | 固定費ゼロ。手動 re-run で再計算も容易 |
| ストレージ | Cloudflare R2 | egress 無料・低コスト。raw / normalized / exports を層で分離 |
| ローカル集計 | DuckDB | Parquet/CSV を SQL で集計でき、サーバー不要。trend 算出に使う |
| Dashboard | 静的 SPA（Vite + 任意の軽量グラフ描画） | Cloudflare Pages に配置。exports/ の JSON を読むだけ |
| 検証 | Vitest | 正規化・スコア算出はすべて pure function にしてユニットテストする |

---

## 3. データモデル

企画書の「LinkOra Score の考え方」をそのまま保持する。**複合スコアを出す場合も元シグナルを必ず併記する。**

### 3.1 Signal record（Stage 2 の出力、provider 共通形式）

```jsonc
{
  "source": "TH",            // 関心を持つ側 (ISO 3166-1 alpha-2)
  "target": "JP",            // 関心を向けられる側
  "signal": "knowledge",     // search | knowledge | travel | structural | supply
  "provider": "wikimedia-pageviews",
  "topic": null,             // Topic 別の場合のみ設定（後述の taxonomy）
  "value": 0.78,             // provider 内で正規化した相対値 [0,1]
  "rawRef": "raw/wikimedia/2026-08/...", // 再計算用の raw data 参照
  "period": "2026-08",       // 観測期間（月次）
  "observedAt": "2026-08-16T00:00:00Z"
}
```

### 3.2 Edge record（Stage 3 の出力、公開・利用単位）

```jsonc
{
  "source": "TH",
  "target": "JP",
  "interestScore": 87,        // signals から合成（式は versioned）
  "informationSupply": 61,
  "informationGap": 26,       // Interest - Supply（定義は scoring version に従う）
  "trend12m": 0.14,
  "signals": { "search": 91, "knowledge": 78, "travel": 74, "structural": 52 },
  "topics": [ { "topic": "travel", "score": 94 }, { "topic": "food", "score": 89 } ],
  "confidence": "medium",     // 利用できた signal 数と鮮度から機械的に決定
  "scoringVersion": "v0.1.0", // スコア式のバージョン。式変更時は必ず上げる
  "period": "2026-08",
  "observedAt": "2026-08-16T00:00:00Z"
}
```

設計ルール:

- スコア式は `scoringVersion` で管理し、式の変更履歴をリポジトリ内（`docs/scoring/`）に残す。過去の period も新しい式で全再計算できる。
- `confidence` は主観でなく、「利用できた signal の種類数 × データ鮮度」から機械的に算出する。
- 時系列は period（月次）単位で normalized/ と exports/ に蓄積し、trend は DuckDB で後段計算する。

### 3.3 Topic taxonomy

企画書の例（Travel / Food / Anime / Culture / Shopping / Technology / Politics）を初期セットとし、`config/topics.ts` に固定リストとして定義する。provider ごとのカテゴリ（例: Wikipedia のカテゴリ体系）からこの taxonomy へのマッピングを設定ファイルで持つ。AI による Topic 分類はこのマッピングで不足する場合にのみ導入する。

---

## 4. データソース計画

**実装順は「規約が明確で安定しているものから」**。各 provider の実装前に、利用規約・商用利用・保存・derived data 提供条件を確認し、結果を `docs/data-sources/<provider>.md` に記録してから着手する（このドキュメント自体が Phase 1 成功条件 2 の成果物になる）。

### Wave 1: Knowledge — Wikimedia（最初に実装）

- **API**: Wikimedia Pageviews / Analytics API（国別・記事別の閲覧統計。CC ライセンスで規約が明確、無償、レート制限が明文化）
- **算出方針**: 「国 A の閲覧のうち、国 B に関連する記事群への閲覧比率」を knowledge signal とする。国 B 関連の記事群は Wikidata の country 関連付けから機械的に構築する。
- **Topic 分解**: 記事のカテゴリ → topic taxonomy へのマッピングで topic 別 signal も同時に取れる。
- Wave 1 だけで「10 か国 × knowledge signal のみ」の Directed Graph を end-to-end で成立させる（M2 参照）。

### Wave 2: Search — 検索関心データ

- Google Trends は公式 API の提供条件・アクセス制限・商用利用条件を先に確認する。**規約上問題がある場合、この signal は保留し、knowledge / travel だけで進める**（アーキテクチャ上、signal の欠落は confidence に反映されるだけで全体は壊れない）。
- raw data の再販売はしない前提。保存も規約の許す範囲に留め、derived score のみを exports に含める。

### Wave 3: Travel — 旅行需要

- 各国政府観光局・UNWTO 等が公開する国別入国者統計（集計済み・合法的に利用可能なもの）を利用。更新頻度は低い（月次〜年次）が、構造的な travel signal として十分。
- Voigie との接続点になるため、`source -> target` の旅行需要として独立に保持する。

### Wave 4: Structural — 補助シグナル

- 移住・在留人口（UN 統計）、貿易（UN Comtrade）、留学、言語圏、地理的距離。静的データセットとして年 1 回程度更新。
- 企画書どおり**主指標にはしない**。interest の解釈補助と confidence 算出に使う。

### Information Supply（最難関・実験的に進める）

「国 B に関する、国 A の言語で書かれたコンテンツの供給量」の推定。Phase 1 では以下の proxy から始め、精度は検証しながら上げる:

1. 国 A の言語版 Wikipedia における国 B 関連記事のカバレッジ（記事数・充実度）— Wave 1 の副産物として取得可能
2. （検証後）検索結果の現地語コンテンツ量など、規約を確認した上での追加 proxy

Supply の定義が弱い間は `informationGap` の confidence を明示的に下げる。

---

## 5. リポジトリ構成

```text
linkora/
├── config/
│   ├── countries.ts        # 対象10か国（JP TH IN KR ID VN SG FR DE US）
│   ├── topics.ts           # Topic taxonomy
│   └── providers.ts        # 有効な provider と実行スケジュール
├── src/
│   ├── providers/          # Provider 共通IF + 実装（wikimedia/ など）
│   │   └── types.ts        # interface Provider { fetch(); normalize(); }
│   ├── pipeline/           # fetch → normalize → score → export の各 stage
│   ├── scoring/            # スコア式（versioned, pure function）
│   ├── storage/            # R2 / ローカルFSの読み書き（層: raw/normalized/exports）
│   └── cli.ts              # `linkora fetch|score|export --period 2026-08`
├── dashboard/              # 内部用静的SPA（exports/ を読むだけ）
├── docs/
│   ├── IMPLEMENTATION_PLAN.md
│   ├── data-sources/       # provider ごとの規約確認記録（実装前に必須）
│   └── scoring/            # スコア式の定義と変更履歴
├── tests/
└── .github/workflows/
    ├── pipeline.yml        # 週次 cron + 手動実行
    └── ci.yml              # lint / typecheck / test
```

Provider 共通インターフェース（骨子）:

```ts
interface Provider {
  id: string;                          // "wikimedia-pageviews"
  signal: SignalKind;                  // "knowledge" など
  fetch(period: Period, countries: Country[]): Promise<RawRef[]>;
  normalize(raw: RawRef[]): SignalRecord[];  // pure function・テスト対象
}
```

---

## 6. マイルストーン

| # | 内容 | 完了条件 |
|---|---|---|
| M0 | 足場づくり | リポジトリ初期化（TS/CI/テスト）、config（10か国・taxonomy）、storage 層、CLI 骨格が動く |
| M1 | データソース調査 | Wave 1〜3 の各候補について規約・粒度・制約を `docs/data-sources/` に記録し、Wave 1 の実装可否を確定 |
| M2 | 縦に1本通す | Wikimedia provider だけで fetch → normalize → score → export が動き、10か国 × knowledge signal の edges.json / edges.csv が出る |
| M3 | 時系列と trend | period 単位の蓄積、DuckDB による trend 算出、同一入力からの再計算（再現性）をテストで保証 |
| M4 | Topic 分解 | knowledge signal の topic 別スコアを主要 edge で出力 |
| M5 | Signal 追加 | Wave 2（可能なら）/ Wave 3 を追加し、複合 interestScore と confidence を導入（scoringVersion v0.1.0） |
| M6 | Supply & Gap | Wikipedia カバレッジ proxy による informationSupply / informationGap を追加 |
| M7 | 内部 Dashboard | Audience 国を選ぶ → target ランキング → edge 詳細（signals / topics / trend）が見られる。Network Graph は最小限 |
| M8 | Loka 連携準備 | 「Loka 候補 edge ランキング」を export に追加し、Loka 側で参照する形式（JSON スキーマ）を確定。予測→実績フィードバックの受け口（Loka の traffic 実績を edge に紐づける入力形式）を定義 |

**M2 が最初の判断ポイント**: 単一 signal でも Directed Graph が「もっともらしい」形になるか（例: TH→JP の knowledge interest が VN→KR などと相対比較して直感と大きく矛盾しないか）を確認してから signal を増やす。ここで形にならなければ算出方針を見直す。

---

## 7. スコアリング方針（v0 の考え方）

式は検証前に固定しないが、初期実装の方針だけ決めておく:

- **正規化**: 各 signal は「audience 国内での相対値」として percentile 正規化する（国の人口・ネット普及率の絶対差を吸収する）。
- **合成**: interestScore は signal の重み付き平均から開始（重みは config で可変・versioned）。重みの学習は Phase 2 の実績データが貯まるまでやらない。
- **trend**: 12 か月の period 系列から算出。**一時的ニュース attention の識別**のため、急伸 edge には spike フラグを付け、trend とは区別して表示する（企画書のリスク「データ解釈」への対応）。
- **informationGap**: `Interest - Supply` を基本形とするが、supply の confidence が低い間は gap 値にもその旨を伝播させる。

---

## 8. リスクと対応

| リスク | 対応 |
|---|---|
| Google Trends の規約・仕様変更 | Wave 2 として分離。使えなくても knowledge / travel で成立する設計。provider IF で差し替え可能 |
| Attention ≠ 好感度（事件・災害での急増） | spike 検出で一時的急増を trend と区別。「好感度ではない」ことを export のドキュメントにも明記 |
| Information Supply の推定精度 | proxy から開始し confidence を明示。gap を過信した意思決定を防ぐ |
| 規約違反 | provider 実装前の `docs/data-sources/` への確認記録を必須プロセスにする |
| 過剰設計 | M2 で縦に1本通してから横に広げる。Dashboard は M7 まで作らない。Media Foundry の実装はしない |

---

## 9. Phase 2 への接続（このリポジトリの範囲外だが前提として）

Phase 1 完了後、Loka で実際に edge を選定・公開し、以下を検証する:

- Edge score と記事 CTR / organic traffic の相関
- Information Gap と検索流入獲得速度の相関
- Topic score と記事閲覧数の相関

そのために M8 で「予測データの export 形式」と「実績データの取り込み形式」を先に固定しておく。相関が確認できなければ、スコア定義を見直すか LinkOra 自体を停止する。

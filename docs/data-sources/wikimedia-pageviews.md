# Wikimedia Pageviews（Wave 1: knowledge signal）

**判定: 実装可（GO）** — Wave 1 として採用。実装: `src/providers/wikimedia/`

## 出所・API

| 項目 | 内容 |
|---|---|
| データ | Wikipedia 記事の閲覧数集計（Wikimedia Analytics Pageviews API） |
| エンドポイント | `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/{project}/{access}/{agent}/{article}/{granularity}/{start}/{end}` |
| 補助 API | Wikidata `wbgetentities`（`https://www.wikidata.org/w/api.php`）— 国記事のタイトルを各言語版へ解決 |
| ドキュメント | https://wikimedia.org/api/rest_v1/ / https://wikitech.wikimedia.org/wiki/Analytics/AQS/Pageviews |

## ライセンス・利用条件

- **Pageviews 集計データ**: CC0 1.0（パブリックドメイン相当）。**商用利用可・保存可・derived data の第三者提供可**。
- **Wikidata の構造化データ**（sitelinks 含む）: CC0 1.0。
- **User-Agent ポリシー**: 連絡先を含む識別可能な User-Agent が必須（https://meta.wikimedia.org/wiki/User-Agent_policy）。実装済み（`src/providers/wikimedia/api.ts` の `USER_AGENT`）。
- **レート制限**: Pageviews API はクライアントあたり 100 req/s が目安。LinkOra は 1 回の実行で約 91 リクエスト（sitelinks 1 + 10 か国 × 9 記事）・150ms スロットル付きのため、制限に対して余裕が大きい。

## 粒度・更新頻度

- 記事単位 × 日次/月次。`agent=user` で bot / spider トラフィックを除外できる（採用済み）。
- 月次データは月末締め後に安定する。パイプラインの対象 period を「前月」にしているのはこのため。
- 欠測: 記事が存在しない・閲覧が極端に少ない月は 404 が返る → `views: null` として記録し、SignalRecord を生成しない（confidence に自然に反映）。

## LinkOra での算出方法

audience 国 A の関心を、A の Wikipedia 言語版（`config/countries.ts` の `wikipedia`）で代理する。

```text
knowledge_interest(A -> B)
  = A の言語版における B の国記事の月間 user pageviews
    を audience A 内の最大値で割った相対値 [0, 1]
```

対象記事は Wikidata QID（`config/countries.ts` の `wikidata`）から sitelinks で各言語版のタイトルに解決する（タイトルのハードコードなし）。

## 既知の制約（重要）

1. **言語版 ≠ 国**: en.wikipedia は SG と US の両 audience の代理になるため、この 2 国の knowledge signal は分離できない（現状は同一値になる）。
2. **India の言語代理が弱い**: hi.wikipedia を採用しているが、インドのネット利用は英語比率が高く、hi は過小評価になる。
3. **国記事 1 本のみ**: M2 では国のメイン記事のみを対象とするため、関心の裾野（都市・文化・人物記事など）を拾えていない。M4（Topic 分解）で関連記事群へ拡張する。
4. **改善パス**: `pageviews/top-per-country`（読者の国別・記事別 top 1000）を使えば読者国を正確に取れるが、上位 1000 記事に限られ privacy threshold もある。M5 で併用を検討する。

これらは normalize の値には現れないため、**edge の解釈時に必ずこのファイルを参照すること**。

## 確認記録

- 確認日: 2026-08-16
- 確認方法: 公式ドキュメント（上記 URL）に基づく。CC0 ライセンスと User-Agent ポリシーは Wikimedia の公開ポリシーとして確認済み。
- 注意: 開発セッションのネットワークポリシーにより wikimedia.org への直接疎通確認は未実施。**初回の GitHub Actions 実行（実データ取得）をもって疎通・レスポンス形式の最終確認とする。**

# Data source reviews

**Provider を実装する前に、このディレクトリに規約確認の記録を必ず作成する**（docs/IMPLEMENTATION_PLAN.md §4）。記録がないデータソースはパイプラインに追加しない。

1 ソースにつき 1 ファイル（例: `wikimedia-pageviews.md`）。以下を記録する:

- データの出所・API・ライセンス
- 商用利用の可否
- raw data の保存可否・保存条件
- derived data（スコア）の第三者提供可否
- レート制限・アクセス条件
- 粒度（国・期間・topic）と更新頻度
- 確認日と確認方法（規約 URL 等）

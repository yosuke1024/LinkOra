# LinkOra

国と国の間に存在する「関心（interest / attention）」と「情報供給の不足（information gap）」を可視化する、PixApps 内部のデータプロダクト。

国をノード、国から国への関心を**有向エッジ**として扱い、`Thailand -> Japan` と `Japan -> Thailand` を別の情報需要として観測する。

> どの国の人が、どの国の何に関心を持っているか。
> その関心に対して、その人たちの言語・背景に合った情報は十分に供給されているか。

- 企画の背景・プロダクト仮説: [pixapps_strategy#25](https://github.com/yosuke1024/pixapps_strategy/issues/25)
- 実装計画: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)

## ステータス

**Private Development** — 現時点では OSS 化せず、PixApps 内部の非公開プロダクトとして検証する。

現在は M0（足場）完了。パイプラインの骨格は動くが、provider が未実装のため実データはまだ流れない（次: M1 データソース調査 → M2 Wikimedia provider）。

## 開発

```bash
npm install
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm test           # Vitest

# パイプライン CLI（デフォルト period は前月）
npm run linkora -- --help
npm run linkora -- fetch --period 2026-07
npm run pipeline               # fetch → normalize → score → export を一括実行
```

結果はローカルでは `data/`（gitignore 済み）に `raw/` `normalized/` `exports/` の 3 層で保存される。ストレージ層の設計と各ステージの責務は [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) §2 を参照。

### リポジトリ構成

- `config/` — 対象 10 か国・topic taxonomy・有効な provider の登録
- `src/providers/` — データソース共通インターフェース（実装は Wave 1 から追加）
- `src/pipeline/` — fetch / normalize / score / export の 4 ステージ
- `src/scoring/` — スコア式（versioned・pure function、定義は `docs/scoring/`）
- `src/storage/` — ローカル FS / R2（未実装）の 3 層ストレージ
- `docs/data-sources/` — **provider 実装前に必須**の規約確認記録

## Loka / Voigie との関係

LinkOra は [Loka] の **Opportunity Discovery Engine** として機能する。LinkOra が「関心は強いが現地語の情報供給が不足している国ペア（edge）」を発見し、Loka がその edge をメディア化し、実績（traffic / CTR / revisit / revenue）を LinkOra に返すフィードバックループを構築する。Travel signal は Voigie の市場選定にも接続できる。

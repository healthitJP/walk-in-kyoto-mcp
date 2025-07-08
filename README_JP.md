# Walk-in-Kyoto MCP Server

**[English](README.md)** | **日本語**

[![npm version](https://badge.fury.io/js/walk-in-kyoto-mcp.svg)](https://www.npmjs.com/package/walk-in-kyoto-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Walk-in-Kyoto MCP** は、京都の公共交通機関（バス・電車）のルート検索を提供するModel Context Protocol (MCP) サーバーです。AI アシスタントが京都の交通情報を活用して、最適な移動ルートを提案できるようになります。

## 📊 データソース

このMCPサーバーは、[歩くまち京都](https://www.arukumachikyoto.jp/)（KYOTO Transit Planner）の公開情報をもとにしています。

- **運営**: 「歩くまち・京都」バス・鉄道乗換情報発信システム・コンソーシアム
- **開発**: ジョルダン株式会社
- **URL**: https://www.arukumachikyoto.jp/

---

## 👀 このプロジェクトについて（一般の方向け）

### 🚀 何ができるのか

- 🚌 **京都の交通案内** - 市バス、私鉄、地下鉄を横断した最適ルート検索
- 🗺️ **簡単な検索** - 駅名を言うだけ、GPSを使うだけで経路がわかる
- 🌐 **日本語対応** - 日本語・英語で検索・案内
- 🕐 **詳細時刻対応** - 「明日の10時に出発したい」など時刻指定可能、各区間の発着時刻も表示
- 🌙 **日付跨ぎ対応** - 深夜便などで日付が変わる場合も正確に処理
- ⚡ **AI連携** - ChatGPTやClaude等のAIアシスタントと組み合わせて使用

### 💡 どんな時に便利？

- 「京都駅から金閣寺に行きたい」
- 「清水寺から嵐山まで一番安いルートは？」
- 「現在地から最寄りの観光地へのアクセス方法は？」

---

## 🤖 AIアシスタントで使いたい方向け

### 📦 すぐに始める

```bash
# 簡単実行（推奨）
npx walk-in-kyoto-mcp
```

### 🔧 Claude Desktop での設定

お使いのClaude Desktopの設定ファイル（`claude_desktop_config.json`）に以下を追加：

```json
{
  "mcpServers": {
    "walk-in-kyoto": {
      "command": "npx",
      "args": ["walk-in-kyoto-mcp"]
    }
  }
}
```

### 💬 実際の使用例

**あなた**: 「京都駅から金閣寺まで、明日の午前10時出発で行きたいです」

**Claude（MCPツール使用後）**:
1. 「金閣寺道」というバス停を検索
2. 最適ルートを検索
3. 結果を分析して回答

**結果**: 
- 市バス101系統で約45分
- 運賃230円、乗り換えなし
- 具体的な停留所名とバス系統を提示
- 各区間の詳細な発着時刻（10:00発→10:45着など）
- 深夜便の場合は日付跨ぎも考慮

### 🔄 その他のMCPクライアント

```bash
npx walk-in-kyoto-mcp
```

---

## 🛠️ 技術的な詳細を知りたい方向け

### 提供ツール

#### 1. `search_stop_by_substring` - 駅・バス停検索

部分文字列で駅・バス停を検索します。

**パラメータ**:
```typescript
{
  language: "ja" | "en"        // 応答言語
  max_tokens: number           // 最大トークン数
  query: string               // 検索クエリ（部分一致）
}
```

**レスポンス例**:
```json
{
  "candidates": [
    {
      "name": "京都駅",
      "kind": "train_station", 
      "id": "station_kyoto"
    }
  ],
  "truncated": false
}
```

#### 2. `search_route_by_name` - 駅名指定ルート検索

駅名・バス停名を指定してルート検索を行います。各区間の詳細な発着時刻情報や日付跨ぎにも対応します。

**パラメータ**:
```typescript
{
  language: "ja" | "en"                              // 応答言語
  max_tokens: number                                 // 最大トークン数
  from_station: string                               // 出発駅・バス停名
  to_station: string                                 // 到着駅・バス停名
  datetime_type: "departure" | "arrival" | "first" | "last"  // 時刻指定タイプ
  datetime: string                                   // ISO-8601形式日時
}
```

#### 3. `search_route_by_geo` - GPS座標指定ルート検索

緯度経度を指定してルート検索を行います。各区間の詳細な発着時刻情報や日付跨ぎにも対応します。

**パラメータ**:
```typescript
{
  language: "ja" | "en"                              // 応答言語
  max_tokens: number                                 // 最大トークン数
  from_latlng: string                               // 出発地座標 "緯度,経度"
  to_latlng: string                                 // 到着地座標 "緯度,経度"
  datetime_type: "departure" | "arrival" | "first" | "last"  // 時刻指定タイプ
  datetime: string                                  // ISO-8601形式日時
}
```

### 📋 レスポンス形式

```json
{
  "routes": [
    {
      "summary": {
        "depart": "2025-07-07T09:00",      // 出発時刻
        "arrive": "2025-07-07T09:32",      // 到着時刻  
        "duration_min": 32,                // 所要時間（分）
        "transfers": 1,                    // 乗り換え回数
        "fare_jpy": 230                    // 運賃（円）
      },
      "legs": [                            // 区間詳細
        {
          "mode": "bus",                   // 交通手段
          "line": "市バス100系統",           // 路線名
          "from": "京都駅前",               // 出発地
          "to": "清水道",                   // 到着地
          "depart_time": "2025-07-07T09:00", // 区間出発時刻
          "arrive_time": "2025-07-07T09:15", // 区間到着時刻
          "duration_min": 15,              // 所要時間
          "stops": 8,                      // 停車駅数
          "fare_jpy": 230                  // 区間運賃
        }
      ]
    }
  ],
  "truncated": false                       // レスポンス切り詰めフラグ
}
```

### 🚨 エラーハンドリング

MCPプロトコルに従ったエラー形式：

```json
{
  "code": 404,
  "message": "Station not found",
  "details": {
    "from_station": "存在しない駅", 
    "to_station": "京都駅",
    "cause": "stop_not_found"
  }
}
```

**主なエラーコード**:
- `404`: 駅・停留所が見つからない
- `503`: 外部APIサービス一時停止
- `500`: 内部サーバーエラー

### 📊 対応交通機関

#### 鉄道路線
- **京都市営地下鉄**: 全路線（烏丸線、東西線）
- **近鉄**: 京都線、奈良線（大和西大寺～近鉄奈良）
- **京阪**: 京阪本線、京津線、宇治線
- **阪急**: 京都線、嵐山線
- **嵐電（京福電鉄）**: 全路線（嵐山線、北野線）
- **叡電**: 全路線（叡山本線、鞍馬線）
- **嵯峨野観光鉄道**: 全路線（トロッコ）

#### バス路線
- **京都市バス**: 全系統
- **京都バス**: 全系統  
- **京阪バス**: 山科営業所管内
- **京阪京都交通**: 京都市内（一部路線を除く）及び京都市と亀岡市を結ぶ路線
- **西日本JRバス**: 高雄京北線
- **阪急バス**: 大原野線、長岡京線（一部）
- **ヤサカバス**: 全系統
- **醍醐コミュニティバス**: 全系統
- **京都らくなんエクスプレス**: 全系統
- **京都よるバス**: ぎおんよるバス、かわらまちよるバス

**対象エリア**: 京都市内を通る鉄道・バス路線、観光スポット、宿泊施設、飲食店等

---

## 🔧 開発・貢献したい方向け

### ⚙️ 開発環境構築

#### 必要環境
- Node.js ≥ 16.0.0
- npm ≥ 7.0.0

#### 開発用コマンド
```bash
# 開発サーバー起動（mcp-inspector付き）
npm run dev

# ビルド
npm run build

# テスト実行
npm test

# 単体テスト
npm run test:u

# 統合テスト  
npm run test:i
```

### MCPクライアントでのテスト

```bash
# サーバー起動
npm run dev

# 別ターミナルでMCPクライアント接続テスト
```

### 🤝 貢献・フィードバック

バグ報告や機能提案は [GitHub Issues](https://github.com/healthitJP/walk-in-kyoto-mcp/issues) までお願いします。

### 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

---

**作成者**: YoseiUshida  
**バージョン**: 0.3.4  
**MCP SDK**: @modelcontextprotocol/sdk@1.15.0

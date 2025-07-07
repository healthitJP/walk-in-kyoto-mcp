#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// ==================== DEBUG LOG FUNCTIONALITY - START (DELETE THIS SECTION WHEN NOT NEEDED) ====================
import fs from 'fs';
import path from 'path';

// ログファイル設定
const LOG_FILE = path.join(process.cwd(), 'mcp-debug.log');

// ログ関数を定義
function logToFile(message: string): void {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
}

// console.errorをオーバーライドしてファイルにも出力
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  // 元のconsole.errorも呼び出し
  originalConsoleError(...args);
  
  // ファイルにも出力
  logToFile(message);
};
// ==================== DEBUG LOG FUNCTIONALITY - END (DELETE UNTIL HERE) ====================

// サービスのインポート
import { StopSearchService } from './services/StopSearchService';
import { RouteSearchByNameService } from './services/RouteSearchByNameService';
import { RouteSearchByGeoService } from './services/RouteSearchByGeoService';

// 型のインポート
import {
  StopSearchRequest,
  RouteSearchByNameRequest,
  RouteSearchByGeoRequest,
  StopSearchResponse,
  RouteSearchResponse,
} from './types';

/**
 * Walk-in-Kyoto MCP Server
 * 
 * Tools:
 * 1. search_stop_by_substring - 駅・バス停の部分一致検索
 * 2. search_route_by_name - 駅名指定でのルート検索
 * 3. search_route_by_geo - 緯度経度指定でのルート検索
 */
class WalkInKyotoMcpServer {
  private server: Server;
  private stopSearchService: StopSearchService;
  private routeSearchByNameService: RouteSearchByNameService;
  private routeSearchByGeoService: RouteSearchByGeoService;

  constructor() {
    this.server = new Server(
      {
        name: 'walk-in-kyoto-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // サービス初期化
    this.stopSearchService = new StopSearchService();
    this.routeSearchByNameService = new RouteSearchByNameService();
    this.routeSearchByGeoService = new RouteSearchByGeoService();

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // ツール一覧の提供
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_stop_by_substring',
            description: '駅・バス停候補を部分文字列で検索します。日本語・英語対応。',
            inputSchema: {
              type: 'object',
              properties: {
                language: {
                  type: 'string',
                  enum: ['ja', 'en'],
                  description: '応答言語 (ja: 日本語, en: 英語)',
                },
                max_tokens: {
                  type: 'integer',
                  minimum: 1,
                  description: 'レスポンスの最大トークン数',
                },
                query: {
                  type: 'string',
                  description: '部分一致検索クエリ',
                },
              },
              required: ['language', 'max_tokens', 'query'],
            },
          },
          {
            name: 'search_route_by_name',
            description: '駅名・バス停名指定でルート検索を行います。',
            inputSchema: {
              type: 'object',
              properties: {
                language: {
                  type: 'string',
                  enum: ['ja', 'en'],
                  description: '応答言語',
                },
                max_tokens: {
                  type: 'integer',
                  minimum: 1,
                  description: 'レスポンスの最大トークン数',
                },
                from_station: {
                  type: 'string',
                  description: '出発駅・バス停名',
                },
                to_station: {
                  type: 'string',
                  description: '到着駅・バス停名',
                },
                datetime_type: {
                  type: 'string',
                  enum: ['departure', 'arrival', 'first', 'last'],
                  description: '時刻指定タイプ',
                },
                datetime: {
                  type: 'string',
                  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}',
                  description: 'ISO-8601形式の日時 (例: 2025-07-07T00:43)',
                },
              },
              required: ['language', 'max_tokens', 'from_station', 'to_station', 'datetime_type', 'datetime'],
            },
          },
          {
            name: 'search_route_by_geo',
            description: '緯度経度指定でルート検索を行います。',
            inputSchema: {
              type: 'object',
              properties: {
                language: {
                  type: 'string',
                  enum: ['ja', 'en'],
                  description: '応答言語',
                },
                max_tokens: {
                  type: 'integer',
                  minimum: 1,
                  description: 'レスポンスの最大トークン数',
                },
                from_latlng: {
                  type: 'string',
                  pattern: '^\\d+\\.\\d+,\\d+\\.\\d+$',
                  description: '出発地の緯度経度 (例: 35.02527,135.79189)',
                },
                to_latlng: {
                  type: 'string',
                  pattern: '^\\d+\\.\\d+,\\d+\\.\\d+$',
                  description: '到着地の緯度経度',
                },
                datetime_type: {
                  type: 'string',
                  enum: ['departure', 'arrival', 'first', 'last'],
                  description: '時刻指定タイプ',
                },
                datetime: {
                  type: 'string',
                  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}',
                  description: 'ISO-8601形式の日時',
                },
              },
              required: ['language', 'max_tokens', 'from_latlng', 'to_latlng', 'datetime_type', 'datetime'],
            },
          },
        ],
      };
    });

    // ツール実行
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_stop_by_substring':
            return await this.handleStopSearch(args as unknown as StopSearchRequest);

          case 'search_route_by_name':
            return await this.handleRouteSearchByName(args as unknown as RouteSearchByNameRequest);

          case 'search_route_by_geo':
            return await this.handleRouteSearchByGeo(args as unknown as RouteSearchByGeoRequest);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }

        // その他のエラーをMcpErrorに変換
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${errorMessage}`
        );
      }
    });
  }

  /**
   * Tool 1: search_stop_by_substring の実行
   */
  private async handleStopSearch(args: StopSearchRequest) {
    const result: StopSearchResponse = await this.stopSearchService.search(args);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Tool 2: search_route_by_name の実行
   */
  private async handleRouteSearchByName(args: RouteSearchByNameRequest) {
    const result: RouteSearchResponse = await this.routeSearchByNameService.searchRoute(args);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * Tool 3: search_route_by_geo の実行
   */
  private async handleRouteSearchByGeo(args: RouteSearchByGeoRequest) {
    // 緯度経度検索のパラメータをログ出力
    console.error('🔍 [Route Search by Geo] Starting geo-coordinate search...');
    console.error(`📍 From: ${args.from_latlng}`);
    console.error(`📍 To: ${args.to_latlng}`);
    console.error(`⏰ DateTime: ${args.datetime} (${args.datetime_type})`);
    console.error(`🌐 Language: ${args.language}`);
    console.error(`📝 Max tokens: ${args.max_tokens}`);
    
    const result: RouteSearchResponse = await this.routeSearchByGeoService.searchRoute(args);
    
    console.error(`✅ [Route Search by Geo] Search completed, found ${result.routes.length} routes`);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  /**
   * サーバー開始
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('Walk-in-Kyoto MCP Server running on stdio');
    // ==================== DEBUG LOG INFO - START (DELETE WHEN LOG FUNCTIONALITY IS REMOVED) ====================
    console.error(`📝 Debug logs will be written to: ${LOG_FILE}`);
    console.error('🔍 To monitor logs: tail -f mcp-debug.log');
    // ==================== DEBUG LOG INFO - END (DELETE UNTIL HERE) ====================
  }

  /**
   * クリーンアップ
   */
  async dispose(): Promise<void> {
    this.routeSearchByNameService.dispose();
    this.routeSearchByGeoService.dispose();
  }
}

// メイン実行
async function main(): Promise<void> {
  const server = new WalkInKyotoMcpServer();
  
  // シグナルハンドリング
  process.on('SIGINT', async () => {
    console.error('Received SIGINT, shutting down gracefully...');
    await server.dispose();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('Received SIGTERM, shutting down gracefully...');
    await server.dispose();
    process.exit(0);
  });

  try {
    await server.run();
  } catch (error) {
    console.error('Fatal error:', error);
    await server.dispose();
    process.exit(1);
  }
}

// メイン実行
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 
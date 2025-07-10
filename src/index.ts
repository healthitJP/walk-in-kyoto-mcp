#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// サービスのインポート
import { StopSearchService } from './services/StopSearchService.js';
import { RouteSearchByNameService } from './services/RouteSearchByNameService.js';
import { RouteSearchByGeoService } from './services/RouteSearchByGeoService.js';

// 型のインポート
import {
  StopSearchRequest,
  RouteSearchByNameRequest,
  RouteSearchByGeoRequest,
  StopSearchResponse,
  RouteSearchResponse,
} from './types/index.js';

/**
 * Walk-in-Kyoto MCP Server
 * 
 * Tools:
 * 1. search_stop_by_substring - 駅・バス停の部分一致検索
 * 2. search_route_by_name - 駅名指定でのルート検索（詳細発着時刻、日付跨ぎ対応）
 * 3. search_route_by_geo - 緯度経度指定でのルート検索（詳細発着時刻、日付跨ぎ対応）
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
        version: '0.3.6',
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
    // Provide list of tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_stop_by_substring',
            description: 'Search for station and bus stop candidates by partial string. Supports Japanese and English.',
            inputSchema: {
              type: 'object',
              properties: {
                language: {
                  type: 'string',
                  enum: ['ja', 'en'],
                  description: 'Response language (ja: Japanese, en: English)',
                },
                max_tokens: {
                  type: 'integer',
                  minimum: 1,
                  description: 'Maximum number of tokens in response',
                },
                query: {
                  type: 'string',
                  description: 'Partial match search query',
                },
              },
              required: ['language', 'max_tokens', 'query'],
            },
          },
          {
            name: 'search_route_by_name',
            description: 'Performs route search by specifying station and bus stop names. Supports detailed departure/arrival times for each segment and date crossing.',
            inputSchema: {
              type: 'object',
              properties: {
                language: {
                  type: 'string',
                  enum: ['ja', 'en'],
                  description: 'Response language',
                },
                max_tokens: {
                  type: 'integer',
                  minimum: 1,
                  description: 'Maximum number of tokens in response',
                },
                from_station: {
                  type: 'string',
                  description: 'Departure station/bus stop name',
                },
                to_station: {
                  type: 'string',
                  description: 'Arrival station/bus stop name',
                },
                datetime_type: {
                  type: 'string',
                  enum: ['departure', 'arrival', 'first', 'last'],
                  description: 'Time specification type. departure: Search routes by specifying departure time, arrival: Search routes by specifying arrival time, first: Search first train routes, last: Search last train routes.',
                },
                datetime: {
                  type: 'string',
                  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}',
                  description: 'Date and time in ISO-8601 format (example: 2025-07-07T00:43)',
                },
              },
              required: ['language', 'max_tokens', 'from_station', 'to_station', 'datetime_type', 'datetime'],
            },
          },
          {
            name: 'search_route_by_geo',
            description: 'Performs route search by specifying latitude and longitude coordinates. Supports detailed departure/arrival times for each segment and date crossing.',
            inputSchema: {
              type: 'object',
              properties: {
                language: {
                  type: 'string',
                  enum: ['ja', 'en'],
                  description: 'Response language',
                },
                max_tokens: {
                  type: 'integer',
                  minimum: 1,
                  description: 'Maximum number of tokens in response',
                },
                from_latlng: {
                  type: 'string',
                  pattern: '^\\d+\\.\\d+,\\d+\\.\\d+$',
                  description: 'Latitude and longitude of departure location (example: 35.02527,135.79189)',
                },
                to_latlng: {
                  type: 'string',
                  pattern: '^\\d+\\.\\d+,\\d+\\.\\d+$',
                  description: 'Latitude and longitude of arrival location',
                },
                datetime_type: {
                  type: 'string',
                  enum: ['departure', 'arrival', 'first', 'last'],
                  description: 'Time specification type. departure: Search routes by specifying departure time, arrival: Search routes by specifying arrival time, first: Search first train routes, last: Search last train routes.',
                },
                datetime: {
                  type: 'string',
                  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}',
                  description: 'Date and time in ISO-8601 format',
                },
              },
              required: ['language', 'max_tokens', 'from_latlng', 'to_latlng', 'datetime_type', 'datetime'],
            },
          },
        ],
      };
    });

    // Tool execution
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

        // Convert other errors to McpError
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${errorMessage}`
        );
      }
    });
  }

  /**
   * Tool 1: Execute search_stop_by_substring
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
   * Tool 2: Execute search_route_by_name
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
   * Tool 3: Execute search_route_by_geo
   */
  private async handleRouteSearchByGeo(args: RouteSearchByGeoRequest) {
    const result: RouteSearchResponse = await this.routeSearchByGeoService.searchRoute(args);
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
   * Start server
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    this.routeSearchByNameService.dispose();
    this.routeSearchByGeoService.dispose();
  }
}

// Main execution
async function main(): Promise<void> {
  const server = new WalkInKyotoMcpServer();
  
  // Signal handling
  process.on('SIGINT', async () => {
    await server.dispose();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.dispose();
    process.exit(0);
  });

  try {
    await server.run();
  } catch (error) {
    await server.dispose();
    process.exit(1);
  }
}

// Main execution
main().catch((error) => {
  process.exit(1);
}); 
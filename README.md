# Walk-in-Kyoto MCP

[![npm version](https://badge.fury.io/js/walk-in-kyoto-mcp.svg)](https://www.npmjs.com/package/walk-in-kyoto-mcp)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

**Walk-in-Kyoto MCP** is a Model Context Protocol (MCP) server that provides comprehensive public transportation route search capabilities for Kyoto, Japan. It supports both bus and train route planning with real-time schedule information.

## Features

🚌 **Bus Route Search** - City bus and private bus lines  
🚊 **Train Route Search** - JR, Keihan, Hankyu, and other railways  
🗺️ **Multiple Search Methods** - By station name or GPS coordinates  
🌐 **Multilingual Support** - Japanese and English  
🕐 **Time-based Planning** - Departure or arrival time specification  
⚡ **Token Limit Control** - Optimized responses for AI models  

## Quick Start

### Installation via npx (Recommended)

```bash
npx walk-in-kyoto-mcp
```

### Global Installation

```bash
npm install -g walk-in-kyoto-mcp
walk-in-kyoto-mcp
```

### Local Installation

```bash
npm install walk-in-kyoto-mcp
npx walk-in-kyoto-mcp
```

## MCP Tools

This server provides 3 MCP tools:

### 1. `search_stop_by_substring`
Search for bus stops and train stations by partial name matching.

**Parameters:**
- `language`: "ja" | "en" - Response language
- `max_tokens`: number - Maximum response tokens
- `query`: string - Search query (partial match)

**Example:**
```json
{
  "language": "ja",
  "max_tokens": 512,
  "query": "京都"
}
```

### 2. `search_route_by_name`
Find routes between stations specified by name.

**Parameters:**
- `language`: "ja" | "en" - Response language  
- `max_tokens`: number - Maximum response tokens
- `from_station`: string - Departure station name
- `to_station`: string - Destination station name
- `datetime_type`: "departure" | "arrival" | "first" | "last" - Time specification type
- `datetime`: string - ISO-8601 datetime (e.g., "2025-07-07T09:00")

**Example:**
```json
{
  "language": "ja",
  "max_tokens": 1024,
  "from_station": "京都駅",
  "to_station": "清水寺",
  "datetime_type": "departure",
  "datetime": "2025-07-07T09:00"
}
```

### 3. `search_route_by_geo`
Find routes between GPS coordinates.

**Parameters:**
- `language`: "ja" | "en" - Response language
- `max_tokens`: number - Maximum response tokens  
- `from_latlng`: string - Departure coordinates "lat,lng"
- `to_latlng`: string - Destination coordinates "lat,lng"
- `datetime_type`: "departure" | "arrival" | "first" | "last" - Time specification type
- `datetime`: string - ISO-8601 datetime

**Example:**
```json
{
  "language": "ja", 
  "max_tokens": 1024,
  "from_latlng": "35.0116,135.7681",
  "to_latlng": "34.9949,135.7849",
  "datetime_type": "departure",
  "datetime": "2025-07-07T09:00"
}
```

## Response Format

All tools return standardized JSON responses:

### Stop Search Response
```json
{
  "candidates": [
    {
      "name": "京都駅",
      "kind": "train_station",
      "id": "station_001"
    }
  ],
  "truncated": false
}
```

### Route Search Response  
```json
{
  "routes": [
    {
      "summary": {
        "depart": "2025-07-07T09:00",
        "arrive": "2025-07-07T09:32", 
        "duration_min": 32,
        "transfers": 1,
        "fare_jpy": 230
      },
      "legs": [
        {
          "mode": "bus",
          "line": "市バス100系統",
          "from": "京都駅前",
          "to": "清水道",
          "duration_min": 15,
          "stops": 8,
          "fare_jpy": 230
        },
        {
          "mode": "walk",
          "duration_min": 17,
          "distance_km": 1.2
        }
      ]
    }
  ],
  "truncated": false
}
```

## MCP Client Integration

### Claude Desktop

Add to your Claude Desktop configuration:

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

### Other MCP Clients

The server communicates via stdio and follows the MCP protocol specification. Launch with:

```bash
npx walk-in-kyoto-mcp
```

## Development

### Prerequisites

- Node.js ≥ 16.0.0
- npm ≥ 7.0.0

### Local Development

```bash
# Clone repository
git clone https://github.com/healthitJP/walk-in-kyoto-mcp.git
cd walk-in-kyoto-mcp

# Install dependencies
npm install

# Run tests
npm test

# Development mode
npm run dev

# Build for production
npm run build
```

### Testing

```bash
npm test           # All tests
npm run test:u     # Unit tests only
npm run test:i     # Integration tests only  
```

## Error Handling

The server provides comprehensive error handling:

- **404**: Station/stop not found
- **503**: Service temporarily unavailable (upstream timeout)
- **500**: Internal server error

Errors follow MCP format:
```json
{
  "code": 404,
  "message": "Stop not found", 
  "details": {
    "from_station": "不存在駅",
    "to_station": "京都駅",
    "cause": "stop_not_found"
  }
}
```

## Data Sources

- **Bus**: Kyoto City Bus, Kyoto Bus, Keihan Bus
- **Train**: JR West, Keihan Electric Railway, Hankyu Railway, Kintetsu
- **Coverage**: Kyoto City and surrounding areas

## Contributing

Contributions welcome! Please read our contributing guidelines and submit pull requests.

## License

ISC License - see LICENSE file for details.

## Support

- 🐛 **Issues**: [GitHub Issues](https://github.com/healthitJP/walk-in-kyoto-mcp/issues)
- 📖 **Documentation**: [GitHub Wiki](https://github.com/healthitJP/walk-in-kyoto-mcp/wiki)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/healthitJP/walk-in-kyoto-mcp/discussions)

---

**🌸 Experience Kyoto like a local with intelligent transportation planning! 🌸**

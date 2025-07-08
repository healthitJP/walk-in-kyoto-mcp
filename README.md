# Walk-in-Kyoto MCP Server

**English** | **[日本語](README_JP.md)**

[![npm version](https://badge.fury.io/js/walk-in-kyoto-mcp.svg)](https://www.npmjs.com/package/walk-in-kyoto-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Walk-in-Kyoto MCP** is a Model Context Protocol (MCP) server that provides public transportation route search functionality for Kyoto, Japan (buses and trains). It enables AI assistants to utilize Kyoto transportation information to suggest optimal travel routes.

## 📊 Data Source

This MCP server is based on public information from [Arukumachi Kyoto](https://www.arukumachikyoto.jp/) (KYOTO Transit Planner).

- **Operated by**: "Arukumachi Kyoto" Bus & Railway Transit Information System Consortium
- **Developed by**: Jorudan Co.,Ltd.
- **URL**: https://www.arukumachikyoto.jp/

---

## 👀 About This Project (For General Users)

### 🚀 What It Can Do

- 🚌 **Kyoto Transportation Guide** - Optimal route search across city buses, private railways, and subways
- 🗺️ **Simple Search** - Just mention a station name or use GPS to find routes
- 🌐 **Japanese Language Support** - Search and guidance in Japanese and English
- 🕐 **Detailed Time Information** - Specify times like "I want to leave tomorrow at 10 AM" with detailed departure/arrival times for each segment
- 🌙 **Midnight Crossing Support** - Accurate handling of routes that cross midnight (overnight services)
- ⚡ **AI Integration** - Use with AI assistants like ChatGPT or Claude

### 💡 When Is It Useful?

- "I want to go from Kyoto Station to Kinkaku-ji Temple"
- "What's the cheapest route from Kiyomizu-dera to Arashiyama?"
- "How do I get from my current location to the nearest tourist spot?"

---

## 🤖 For AI Assistant Users

### 📦 Quick Start

```bash
# Simple execution (recommended)
npx walk-in-kyoto-mcp
```

### 🔧 Claude Desktop Setup

Add the following to your Claude Desktop configuration file (`claude_desktop_config.json`):

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

### 💬 Real Usage Example

**You**: "I want to go from Kyoto Station to Kinkaku-ji Temple, departing tomorrow at 10 AM"

**Claude (after using MCP tools)**:
1. Search for bus stops named "Kinkaku-ji"
2. Search for optimal routes
3. Analyze results and provide clear guidance

**Result**: 
- Take Kyoto City Bus Route 101, about 45 minutes
- Fare: 230 yen, no transfers required
- Specific bus stop names and route numbers provided
- Detailed departure/arrival times for each segment (e.g., 10:00 depart → 10:45 arrive)
- Midnight crossing handling for overnight services

### 🔄 Other MCP Clients

```bash
npx walk-in-kyoto-mcp
```

---

## 🛠️ For Those Who Want Technical Details

### Available Tools

#### 1. `search_stop_by_substring` - Station/Bus Stop Search

Search for stations and bus stops by partial string matching.

**Parameters**:
```typescript
{
  language: "ja" | "en"        // Response language
  max_tokens: number           // Maximum token count
  query: string               // Search query (partial match)
}
```

**Response Example**:
```json
{
  "candidates": [
    {
      "name": "Kyoto Station",
      "kind": "train_station", 
      "id": "station_kyoto"
    }
  ],
  "truncated": false
}
```

#### 2. `search_route_by_name` - Route Search by Station Name

Search for routes by specifying station/bus stop names. Provides detailed departure/arrival times for each segment and handles midnight crossing.

**Parameters**:
```typescript
{
  language: "ja" | "en"                              // Response language
  max_tokens: number                                 // Maximum token count
  from_station: string                               // Departure station/bus stop
  to_station: string                                 // Destination station/bus stop
  datetime_type: "departure" | "arrival" | "first" | "last"  // Time specification type
  datetime: string                                   // ISO-8601 format datetime
}
```

#### 3. `search_route_by_geo` - Route Search by GPS Coordinates

Search for routes by specifying latitude and longitude. Provides detailed departure/arrival times for each segment and handles midnight crossing.

**Parameters**:
```typescript
{
  language: "ja" | "en"                              // Response language
  max_tokens: number                                 // Maximum token count
  from_latlng: string                               // Departure coordinates "lat,lng"
  to_latlng: string                                 // Destination coordinates "lat,lng"
  datetime_type: "departure" | "arrival" | "first" | "last"  // Time specification type
  datetime: string                                  // ISO-8601 format datetime
}
```

### 📋 Response Format

```json
{
  "routes": [
    {
      "summary": {
        "depart": "2025-07-07T09:00",      // Departure time
        "arrive": "2025-07-07T09:32",      // Arrival time  
        "duration_min": 32,                // Duration (minutes)
        "transfers": 1,                    // Number of transfers
        "fare_jpy": 230                    // Fare (Japanese yen)
      },
      "legs": [                            // Route segments
        {
          "mode": "bus",                   // Transportation mode
          "line": "City Bus Route 100",    // Route name
          "from": "Kyoto Station",         // Departure point
          "to": "Kiyomizu-michi",          // Destination point
          "depart_time": "2025-07-07T09:00", // Segment departure time
          "arrive_time": "2025-07-07T09:15", // Segment arrival time
          "duration_min": 15,              // Duration
          "stops": 8,                      // Number of stops
          "fare_jpy": 230                  // Segment fare
        }
      ]
    }
  ],
  "truncated": false                       // Response truncation flag
}
```

### 🚨 Error Handling

Error format following MCP protocol:

```json
{
  "code": 404,
  "message": "Station not found",
  "details": {
    "from_station": "NonexistentStation", 
    "to_station": "Kyoto Station",
    "cause": "stop_not_found"
  }
}
```

**Main Error Codes**:
- `404`: Station/stop not found
- `503`: External API service temporarily unavailable
- `500`: Internal server error

### 📊 Supported Transportation

#### Railway Lines
- **Kyoto Municipal Subway**: All lines (Karasuma Line, Tozai Line)
- **Kintetsu**: Kyoto Line, Nara Line (Yamato-Saidaiji to Kintetsu Nara)
- **Keihan**: Keihan Main Line, Keishin Line, Uji Line
- **Hankyu**: Kyoto Line, Arashiyama Line
- **Randen (Keifuku Electric Railroad)**: All lines (Arashiyama Line, Kitano Line)
- **Eizan Electric Railway**: All lines (Eizan Main Line, Kurama Line)
- **Sagano Scenic Railway**: All lines (Trolley train)

#### Bus Lines
- **Kyoto City Bus**: All routes
- **Kyoto Bus**: All routes  
- **Keihan Bus**: Yamashina Office area
- **Keihan Kyoto Transport**: Kyoto City (excluding some routes) and routes connecting Kyoto City and Kameoka City
- **West Japan JR Bus**: Takao Keihoku Line
- **Hankyu Bus**: Oharano Line, Nagaokakyo Line (partial)
- **Yasaka Bus**: All routes
- **Daigo Community Bus**: All routes
- **Kyoto Rakunan Express**: All routes
- **Kyoto Night Bus**: Gion Night Bus, Kawaramachi Night Bus

**Coverage Area**: Railway and bus lines passing through Kyoto City, tourist spots, accommodations, restaurants, etc.

### 📊 Data Source

This MCP server is based on public information from [Arukumachi Kyoto](https://www.arukumachikyoto.jp/) (KYOTO Transit Planner).

- **Operated by**: "Arukumachi Kyoto" Bus & Railway Transit Information System Consortium
- **Developed by**: Jorudan Co.,Ltd.
- **URL**: https://www.arukumachikyoto.jp/

---

## 🔧 For Developers and Contributors

### ⚙️ Development Environment Setup

#### Requirements
- Node.js ≥ 16.0.0
- npm ≥ 7.0.0

#### Development Commands
```bash
# Start development server (with mcp-inspector)
npm run dev

# Build
npm run build

# Run tests
npm test

# Unit tests
npm run test:u

# Integration tests  
npm run test:i
```

### MCP Client Testing

```bash
# Start server
npm run dev

# Test MCP client connection in another terminal
```

### 🤝 Contributing and Feedback

Please report bugs and feature requests to [GitHub Issues](https://github.com/healthitJP/walk-in-kyoto-mcp/issues).

### 📄 License

MIT License - See [LICENSE](LICENSE) file for details

---

**Author**: YoseiUshida  
**Version**: 0.3.4  
**MCP SDK**: @modelcontextprotocol/sdk@1.15.0 
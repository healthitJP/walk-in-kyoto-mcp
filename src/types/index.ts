// 共通型定義
export type Language = 'ja' | 'en';
export type DateTimeType = 'departure' | 'arrival' | 'first' | 'last';

// Tool 1: search_stop_by_substring
export interface StopSearchRequest {
  language: Language;
  max_tokens: number;
  query: string;
}

export interface StopCandidate {
  name: string;
  kind: 'bus_stop' | 'train_station' | 'landmark';
  id: string;
}

export interface StopSearchResponse {
  candidates: StopCandidate[];
  truncated: boolean;
}

// Tool 2 & 3: Route search
export interface RouteSearchByNameRequest {
  language: Language;
  max_tokens: number;
  from_station: string;
  to_station: string;
  datetime_type: DateTimeType;
  datetime: string; // ISO-8601
}

export interface RouteSearchByGeoRequest {
  language: Language;
  max_tokens: number;
  from_latlng: string; // "lat,lng"
  to_latlng: string;
  datetime_type: DateTimeType;
  datetime: string; // ISO-8601
}

export interface RouteSummary {
  depart: string; // ISO-8601
  arrive: string; // ISO-8601
  duration_min: number;
  transfers: number;
  fare_jpy: number;
}

export interface RouteLeg {
  mode: 'bus' | 'train' | 'walk';
  line?: string;
  from?: string;
  to?: string;
  duration_min: number;
  stops?: number;
  fare_jpy?: number;
  distance_km?: number;
}

export interface Route {
  summary: RouteSummary;
  legs: RouteLeg[];
}

export interface RouteSearchResponse {
  routes: Route[];
  truncated: boolean;
}

// Route HTML Fetcher Internal Types
export interface RouteSearchParams {
  fn: string;        // from name
  tn: string;        // to name  
  dt: string;        // date (YYYY/MM/DD)
  tm: string;        // time (HH:MM)
  fs: string;        // from stations (近隣駅リスト)
  ts: string;        // to stations (近隣駅リスト)
  fl: string;        // from location (緯度経度)
  tl: string;        // to location (緯度経度)
  de: string;        // delay estimation (遅延予測: y/n)
  tt: string;        // time type (d=departure, a=arrival)
  md: string;        // mode (t=transit)
  pn: string;        // pass name (経由地)
  lang: Language;    // ja or en
  fi: string;        // from type identifier
  ti: string;        // to type identifier
}

// Master Data Types
export interface StopRecord {
  id: string;
  name_ja: string;
  name_en: string;
  kind: 'bus_stop' | 'train_station';
  lat: number;
  lng: number;
  agency?: string;
}

export interface LandmarkRecord {
  id: string;
  name_ja: string;
  name_en: string;
  lat: number;
  lng: number;
  category: string;
}

// LandmarkData Types
export interface LandmarkInfo {
  name: string;
  yomi: string;
  lat: number;
  lng: number;
  category: number;
}

export interface LandmarkData {
  data: Record<string, LandmarkInfo>;
  byarea: string[][][];
}

// Master Data Types
export interface Company {
  ekidiv: string;
  name: string;
}

export interface StationName {
  stationname: string;
  companyid: number;
}

export interface StationSelect {
  stationnames: StationName[];
  kana: string;
  byname: string;
}

export interface Station {
  lat: number;
  lng: number;
  stationtype: number;
  kyotoflag: number;
  exflag: number;
  ekidiv: string;
  selectname: string;
}

export interface Rosen {
  companyid: number;
  name: string;
  dest: string;
  expl: string;
  stations: string[];
}

export interface Coefficient {
  SEARCH_FIRST_DEPARTURE_TIME: string;
  SESRCH_LAST_ARRIVAL_TIME: string;
  SEARCH_NEXT_INTERVAL_TIME: number;
  BUS_CO2_EMISSION_RATE: number;
  TRAIN_CO2_EMISSION_RATE: number;
  CAR_CO2_EMISSION_RATE: number;
  WALK_CALORIE_RATE: number;
  WALK_STEPS_RATE: number;
  SEARCH_NEAR_SPOTS_NUMBER: number;
  MASTER_UPDATE_DATETIME: string;
}

export interface Master {
  company: Record<string, Company>;
  company_byorder: number[];
  stationselect: Record<string, StationSelect>;
  station: Record<string, Station>;
  rosen: Record<string, Rosen>;
  rosen_byorder: number[];
  coefficient: Coefficient;
}

// Error Types
export interface McpError {
  code: number;
  message: string;
  details?: any;
} 
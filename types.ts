export enum AppTab {
  SCAN = 'scan',
  GENERATE = 'generate'
}

export enum QRType {
  URL = 'URL',
  TEXT = 'TEXT',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  WIFI = 'WIFI',
  GEO = 'GEO'
}

export interface WifiConfig {
  ssid: string;
  password: string;
  encryption: 'WPA' | 'WEP' | 'nopass';
}

export interface GeoConfig {
  lat: string;
  lng: string;
}

export interface EmailConfig {
  to: string;
  subject: string;
  body: string;
}

export interface ScannedResult {
  raw: string;
  type: QRType;
  actionDescription: string;
}
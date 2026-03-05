export interface IngestionResult {
  found: number;
  inserted: number;
  duplicates: number;
  matches: number;
  errors: number;
}

export interface Ingester {
  name: string;
  run(): Promise<IngestionResult>;
}

export interface SourceListing {
  source: string;
  externalId: string;
  title: string;
  price?: number;
  location?: string;
  url: string;
  imageUrl?: string;
  bedrooms?: number;
  size_m2?: number;
  latitude?: number;
  longitude?: number;
  createdAt?: Date;
}

export interface SourceListing {
  source: string;
  externalId: string;
  title: string;
  price?: number;
  location?: string;
  url: string;
  imageUrl?: string;
  bedrooms?: number;
  createdAt?: Date;
}

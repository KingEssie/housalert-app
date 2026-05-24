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
  /**
   * Optional city override.  When set by the fetcher (e.g. SherryFitz
   * detecting city from URL), the ingester uses this value instead of
   * the default city it was called with.
   */
  city?: string;
}

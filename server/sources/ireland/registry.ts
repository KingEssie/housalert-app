import { fetchListings as fetchDaft }        from "./daft";
import { fetchListings as fetchRentie }      from "./rentie";
import { fetchListings as fetchMyhome }      from "./myhome";
import { fetchListings as fetchLetie }       from "./letie";
import { fetchListings as fetchPropertyie }  from "./propertyie";
import { fetchListings as fetchPropertyPal } from "./propertypal";
import { fetchListings as fetchLisney }      from "./lisney";
import { fetchListings as fetchOwenReilly }  from "./owenreilly";
import { fetchListings as fetchCityhomes }   from "./cityhomes";
import { fetchListings as fetchSherryFitz }  from "./sherryfitz";
import { fetchListings as fetchRayCooke }    from "./raycooke";
import type { SourceListing } from "./types";

export interface IrelandSource {
  name:          string;
  fetchListings: (city?: string) => Promise<SourceListing[]>;
  /**
   * When true the ingester runs this source only for Dublin regardless of the
   * configured IRELAND_CITIES list.  Dublin-specific agencies (Lisney, Owen
   * Reilly, CityHomes, Ray Cooke) and sources that are always blocked for
   * non-Dublin queries should be flagged here.
   */
  dublinOnly?:   boolean;
  /**
   * When true the ingester skips this source entirely and logs
   * "Source disabled due to high scraping cost". The source files and
   * parsers are preserved for future re-enablement.
   */
  disabled?:     boolean;
  disabledReason?: string;
}

export const irelandSources: IrelandSource[] = [
  // ── National aggregators / portals (multi-city capable) ──────────────────
  { name: "daft",       fetchListings: fetchDaft,       dublinOnly: true },
  { name: "propertyie", fetchListings: fetchPropertyie, dublinOnly: true },
  { name: "propertypal",fetchListings: fetchPropertyPal },
  { name: "sherryfitz", fetchListings: fetchSherryFitz },

  // ── Dublin estate agencies (Dublin-only) ─────────────────────────────────
  { name: "lisney",     fetchListings: fetchLisney,     dublinOnly: true },
  { name: "owenreilly", fetchListings: fetchOwenReilly, dublinOnly: true },
  { name: "cityhomes",  fetchListings: fetchCityhomes,  dublinOnly: true },
  { name: "raycooke",   fetchListings: fetchRayCooke,   dublinOnly: true },

  // ── Disabled (high-cost JS-rendering proxies) ─────────────────────────────
  {
    name: "rentie", fetchListings: fetchRentie, disabled: true,
    disabledReason: "Requires render=true JS proxy (RENTIE_PROXY_URL) — high scraping cost",
  },
  {
    name: "myhome", fetchListings: fetchMyhome, disabled: true,
    disabledReason: "Requires render=true JS proxy (MYHOME_PROXY_URL) — high scraping cost",
  },
  {
    name: "letie", fetchListings: fetchLetie, disabled: true,
    disabledReason: "Requires render=true JS proxy (LETIE_PROXY_URL) — high scraping cost",
  },
];

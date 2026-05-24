import { fetchListings as fetchDaft }        from "./daft";
import { fetchListings as fetchRentie }      from "./rentie";
import { fetchListings as fetchMyhome }      from "./myhome";
import { fetchListings as fetchLetie }       from "./letie";
import { fetchListings as fetchPropertyie }  from "./propertyie";
import { fetchListings as fetchPropertyPal } from "./propertypal";
import { fetchListings as fetchLisney }      from "./lisney";
import { fetchListings as fetchOwenReilly }  from "./owenreilly";
import type { SourceListing } from "./types";

export interface IrelandSource {
  name:          string;
  fetchListings: () => Promise<SourceListing[]>;
  /**
   * When true the ingester skips this source entirely and logs
   * "Source disabled due to high scraping cost". The source files and
   * parsers are preserved for future re-enablement.
   */
  disabled?:     boolean;
  disabledReason?: string;
}

export const irelandSources: IrelandSource[] = [
  { name: "daft",        fetchListings: fetchDaft },
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
  { name: "propertyie",  fetchListings: fetchPropertyie },
  { name: "propertypal", fetchListings: fetchPropertyPal },
  { name: "lisney",      fetchListings: fetchLisney },
  { name: "owenreilly",  fetchListings: fetchOwenReilly },
];

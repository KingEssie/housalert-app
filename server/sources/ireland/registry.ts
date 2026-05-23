import { fetchListings as fetchDaft }        from "./daft";
import { fetchListings as fetchRentie }      from "./rentie";
import { fetchListings as fetchMyhome }      from "./myhome";
import { fetchListings as fetchLetie }       from "./letie";
import { fetchListings as fetchPropertyie }  from "./propertyie";
import { fetchListings as fetchPropertyPal } from "./propertypal";

export const irelandSources = [
  { name: "daft",        fetchListings: fetchDaft },
  { name: "rentie",      fetchListings: fetchRentie },
  { name: "myhome",      fetchListings: fetchMyhome },
  { name: "letie",       fetchListings: fetchLetie },
  { name: "propertyie",  fetchListings: fetchPropertyie },
  { name: "propertypal", fetchListings: fetchPropertyPal },
];

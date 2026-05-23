import { fetchListings as fetchDaft } from "./daft";
import { fetchListings as fetchRentie } from "./rentie";
import { fetchListings as fetchMyhome } from "./myhome";

export const irelandSources = [
  { name: "daft", fetchListings: fetchDaft },
  { name: "rentie", fetchListings: fetchRentie },
  { name: "myhome", fetchListings: fetchMyhome },
];

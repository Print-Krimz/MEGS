/**
 * Standard Philippine Administrative Geographic Dataset
 * Maps regions/provinces to constituent cities and municipalities
 * for cascading location input and AI proximity matching normalization.
 */

export interface ProvinceData {
  name: string;
  region: string;
  cities: string[];
}

export const PHILIPPINE_REGIONS_AND_PROVINCES: string[] = [
  "Metro Manila (NCR)",
  "Laguna",
  "Cavite",
  "Batangas",
  "Rizal",
  "Bulacan",
  "Pampanga",
  "Cebu",
  "Davao del Sur",
  "Iloilo",
  "Pangasinan",
  "Quezon Province",
  "Bataan",
  "Benguet",
  "Misamis Oriental",
  "Negros Occidental",
];

export const PHILIPPINE_PROVINCES: ProvinceData[] = [
  {
    name: "Metro Manila (NCR)",
    region: "National Capital Region",
    cities: [
      "Caloocan",
      "Las Piñas",
      "Makati",
      "Malabon",
      "Mandaluyong",
      "Manila",
      "Marikina",
      "Muntinlupa",
      "Navotas",
      "Parañaque",
      "Pasay",
      "Pasig",
      "Pateros",
      "Quezon City",
      "San Juan",
      "Taguig",
      "Valenzuela",
    ],
  },
  {
    name: "Laguna",
    region: "Region IV-A (CALABARZON)",
    cities: [
      "Alaminos",
      "Bay",
      "Biñan",
      "Cabuyao",
      "Calamba",
      "Calauan",
      "Cavinti",
      "Famy",
      "Kalayaan",
      "Liliw",
      "Los Baños",
      "Luisiana",
      "Lumban",
      "Mabitac",
      "Magdalena",
      "Majayjay",
      "Nagcarlan",
      "Paete",
      "Pagsanjan",
      "Pakil",
      "Pangil",
      "Pila",
      "Rizal",
      "San Pablo",
      "San Pedro",
      "Santa Cruz",
      "Santa Maria",
      "Santa Rosa",
      "Siniloan",
      "Victoria",
    ],
  },
  {
    name: "Cavite",
    region: "Region IV-A (CALABARZON)",
    cities: [
      "Alfonso",
      "Amadeo",
      "Bacoor",
      "Carmona",
      "Cavite City",
      "Dasmariñas",
      "General Emilio Aguinaldo",
      "General Mariano Alvarez",
      "General Trias",
      "Imus",
      "Indang",
      "Kawit",
      "Magallanes",
      "Maragondon",
      "Mendez",
      "Naic",
      "Noveleta",
      "Rosario",
      "Silang",
      "Tagaytay",
      "Tanza",
      "Ternate",
      "Trece Martires",
    ],
  },
  {
    name: "Batangas",
    region: "Region IV-A (CALABARZON)",
    cities: [
      "Agoncillo",
      "Alitagtag",
      "Balayan",
      "Balete",
      "Batangas City",
      "Bauan",
      "Calaca",
      "Calatagan",
      "Cuenca",
      "Ibaan",
      "Laurel",
      "Lemery",
      "Lian",
      "Lipa",
      "Lobo",
      "Mabini",
      "Malvar",
      "Mataasnakahoy",
      "Nasugbu",
      "Padre Garcia",
      "Rosario",
      "San Jose",
      "San Juan",
      "San Luis",
      "San Nicolas",
      "San Pascual",
      "Santa Teresita",
      "Santo Tomas",
      "Taal",
      "Talisay",
      "Tanauan",
      "Taysan",
      "Tingloy",
      "Tuy",
    ],
  },
  {
    name: "Rizal",
    region: "Region IV-A (CALABARZON)",
    cities: [
      "Angono",
      "Antipolo",
      "Baras",
      "Binangonan",
      "Cainta",
      "Cardona",
      "Jalajala",
      "Morong",
      "Pililla",
      "Rodriguez (Montalban)",
      "San Mateo",
      "Tanay",
      "Taytay",
      "Teresa",
    ],
  },
  {
    name: "Bulacan",
    region: "Region III (Central Luzon)",
    cities: [
      "Angat",
      "Balagtas",
      "Baliuag",
      "Bocaue",
      "Bulakan",
      "Bustos",
      "Calumpit",
      "Doña Remedios Trinidad",
      "Guiguinto",
      "Hagonoy",
      "Malolos",
      "Marilao",
      "Meycauayan",
      "Norzagaray",
      "Obando",
      "Pandi",
      "Paombong",
      "Plaridel",
      "Pulilan",
      "San Ildefonso",
      "San Jose del Monte",
      "San Miguel",
      "San Rafael",
      "Santa Maria",
    ],
  },
  {
    name: "Pampanga",
    region: "Region III (Central Luzon)",
    cities: [
      "Angeles",
      "Apalit",
      "Arayat",
      "Bacolor",
      "Candaba",
      "Floridablanca",
      "Guagua",
      "Lubao",
      "Mabalacat",
      "Macabebe",
      "Magalang",
      "Masantol",
      "Mexico",
      "Minalin",
      "Porac",
      "San Fernando",
      "San Luis",
      "San Simon",
      "Santa Ana",
      "Santa Rita",
      "Santo Tomas",
      "Sasmuan",
    ],
  },
  {
    name: "Cebu",
    region: "Region VII (Central Visayas)",
    cities: [
      "Carcar",
      "Cebu City",
      "Danao",
      "Lapu-Lapu",
      "Mandaue",
      "Naga",
      "Talisay",
      "Toledo",
      "Bogo",
      "Consolacion",
      "Liloan",
      "Minglanilla",
      "Cordova",
    ],
  },
  {
    name: "Davao del Sur",
    region: "Region XI (Davao Region)",
    cities: [
      "Davao City",
      "Digos",
      "Bansalan",
      "Hagonoy",
      "Kiblawan",
      "Magsaysay",
      "Malalag",
      "Matanao",
      "Padada",
      "Santa Cruz",
      "Sulop",
    ],
  },
  {
    name: "Iloilo",
    region: "Region VI (Western Visayas)",
    cities: ["Iloilo City", "Passi", "Oton", "Pavia", "Santa Barbara", "Leganes"],
  },
  {
    name: "Pangasinan",
    region: "Region I (Ilocos Region)",
    cities: ["Dagupan", "San Carlos", "Urdaneta", "Alaminos", "Lingayen"],
  },
  {
    name: "Quezon Province",
    region: "Region IV-A (CALABARZON)",
    cities: ["Lucena", "Tayabas", "Candelaria", "Sariaya", "Tiaong", "Pagbilao"],
  },
  {
    name: "Bataan",
    region: "Region III (Central Luzon)",
    cities: ["Balanga", "Mariveles", "Dinalupihan", "Hermosa", "Orani", "Limay"],
  },
  {
    name: "Benguet",
    region: "CAR (Cordillera)",
    cities: ["Baguio City", "La Trinidad", "Itogon", "Tuba"],
  },
  {
    name: "Misamis Oriental",
    region: "Region X (Northern Mindanao)",
    cities: ["Cagayan de Oro", "Gingoog", "El Salvador", "Tagoloan", "Villanueva"],
  },
  {
    name: "Negros Occidental",
    region: "Region VI (Western Visayas)",
    cities: ["Bacolod", "Bago", "Cadiz", "Escalante", "Himamaylan", "Silay", "Talisay"],
  },
];

/**
 * Returns the list of cities/municipalities for a specific province.
 */
export function getCitiesForProvince(provinceName: string): string[] {
  if (!provinceName) return [];
  const clean = provinceName.trim().toLowerCase();
  const match = PHILIPPINE_PROVINCES.find(
    (p) =>
      p.name.toLowerCase() === clean ||
      clean.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().includes(clean)
  );
  return match ? match.cities : [];
}

/**
 * Searches across provinces and constituent cities for autocomplete.
 */
export function searchLocations(
  query: string
): Array<{ province: string; city: string; formatted: string }> {
  if (!query || query.trim().length === 0) return [];
  const clean = query.trim().toLowerCase();
  const results: Array<{ province: string; city: string; formatted: string }> = [];

  for (const prov of PHILIPPINE_PROVINCES) {
    for (const city of prov.cities) {
      if (
        city.toLowerCase().includes(clean) ||
        prov.name.toLowerCase().includes(clean)
      ) {
        results.push({
          province: prov.name,
          city,
          formatted: `${city}, ${prov.name}`,
        });
      }
    }
  }

  return results.slice(0, 20);
}

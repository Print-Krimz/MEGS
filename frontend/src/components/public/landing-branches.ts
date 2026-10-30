type Region = "Luzon & NCR" | "Visayas" | "Mindanao";

interface Branch {
  id: string;
  name: string;
  region: Region;
  isHQ: boolean;
  address: string;
  landmark?: string;
  mobile: string;
  landlines?: { display: string; tel: string }[];
  latLng: [number, number];
}

export const BRANCHES: Branch[] = [
  {
    id: "valenzuela",
    name: "Valenzuela Central Office",
    region: "Luzon & NCR",
    isHQ: true,
    address: "#9, PJAR Bldg, P. Gomez St, Malinta, Valenzuela City",
    mobile: "0917-629-1864 (Globe)",
    landlines: [
      { display: "(02) 8277-2959", tel: "+63282772959" },
      { display: "(02) 8291-0807", tel: "+63282910807" },
    ],
    latLng: [14.6991, 120.984],
  },
  {
    id: "quezon-city",
    name: "Quezon City Branch",
    region: "Luzon & NCR",
    isHQ: false,
    address: "Rm 207, 2nd Floor, STG Bldg., 109 P. Tuazon, Cubao, Quezon City",
    mobile: "0917-629-1864 (Globe)",
    latLng: [14.6195, 121.0511],
  },
  {
    id: "binan",
    name: "Biñan, Laguna Branch",
    region: "Luzon & NCR",
    isHQ: false,
    address: "3rd Fl, Uniworld Bldg. 347, Burgos St., Brgy Vicente, Biñan, Laguna",
    mobile: "0917-629-1864 (Globe)",
    latLng: [14.3414, 121.0803],
  },
  {
    id: "batangas",
    name: "Tanauan, Batangas Branch",
    region: "Luzon & NCR",
    isHQ: false,
    address: "PJAR Trading, (In front of New City Hall), Brgy Santor, Tanauan City, Batangas",
    mobile: "0917-629-1864 (Globe)",
    latLng: [14.0854, 121.1504],
  },
  {
    id: "cebu",
    name: "Cebu Branch",
    region: "Visayas",
    isHQ: false,
    address: "RM 301, Du Sui Bldg, North Road, Brgy Jagobiao, Mandaue City, Cebu",
    mobile: "0923-745-4050 (Sun/Smart)",
    latLng: [10.362, 123.9472],
  },
  {
    id: "davao",
    name: "Davao City Branch",
    region: "Mindanao",
    isHQ: false,
    address: "D2 2F, C LAT Bldg, Bonifacio St, Davao City",
    mobile: "0923-745-4050 (Sun/Smart)",
    latLng: [7.0707, 125.6087],
  },
];

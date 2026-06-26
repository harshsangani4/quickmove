/**
 * Curated settle-in / local orientation cards (build doc §6.10), seeded per city.
 * Unlocks after the move is delivered.
 */
export interface LocalService {
  category: string;
  name: string;
  note: string;
}

const GENERIC: LocalService[] = [
  { category: "Grocery", name: "Local supermarket & daily needs", note: "Most areas have a BigBasket / Zepto delivery zone." },
  { category: "Healthcare", name: "Nearest multi-speciality hospital", note: "Save the emergency number in your phone." },
  { category: "Banking", name: "Bank branch & ATMs", note: "Update your address within 30 days of moving." },
  { category: "Transport", name: "Metro / bus & cab coverage", note: "Check the local transit app for passes." },
];

const BY_CITY: Record<string, LocalService[]> = {
  bengaluru: [
    { category: "Grocery", name: "Namdhari's Fresh / More", note: "Indiranagar & Koramangala have late-night options." },
    { category: "Healthcare", name: "Manipal & Apollo hospitals", note: "Book via the Apollo 24|7 app." },
    { category: "Transport", name: "Namma Metro (Purple/Green)", note: "Buy a smart card for daily commutes." },
    { category: "Schools", name: "Reputed CBSE/ICSE schools nearby", note: "Admissions usually open Nov–Jan." },
  ],
  pune: [
    { category: "Grocery", name: "Dorabjee's & Star Bazaar", note: "Camp & Kalyani Nagar are well stocked." },
    { category: "Healthcare", name: "Ruby Hall & Jehangir", note: "Central, 24x7 emergency." },
    { category: "Transport", name: "Pune Metro + PMPML buses", note: "Metro covers Pimpri–Swargate." },
  ],
  mumbai: [
    { category: "Grocery", name: "DMart & local kirana", note: "Order essentials on Swiggy Instamart." },
    { category: "Healthcare", name: "Lilavati / Hinduja", note: "Keep your society's doctor on call." },
    { category: "Transport", name: "Local trains & Metro", note: "Get a smart card; avoid peak 9–11am." },
  ],
};

export function getLocalServices(citySlug: string): LocalService[] {
  return BY_CITY[citySlug] ?? GENERIC;
}

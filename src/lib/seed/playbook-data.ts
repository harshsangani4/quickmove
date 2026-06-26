/**
 * Per-city Playbook seed data (build doc §11).
 *
 * The whole point: each of the 8 cities is encoded as DATA — different utility
 * setup times, vendors, doc rules, and task lead times — so two moves to
 * different cities visibly differ. Task templates are generated per-city from
 * the city's utility setup days, so a city with slow internet provisioning
 * gets an earlier "request internet" task automatically.
 */
import type { ProofType, TaskCategory } from "@/lib/types";

export interface UtilitySeed {
  type: "electricity" | "internet" | "gas" | "water";
  name: string;
  avg_setup_days: number;
  contact: string;
}

export interface VendorSeed {
  type: "property" | "movers";
  name: string;
  contact: string;
  on_time_pct: number;
  issue_rate: number;
  rating: number;
}

export interface DocReqSeed {
  name: string;
  applies_to: "customer" | "relocation";
  mandatory: boolean;
  notes?: string;
}

export interface TemplateSeed {
  key: string;
  title: string;
  category: TaskCategory;
  owner_role: "ops" | "lead" | "admin";
  lead_time_days: number;
  depends_on: string[];
  requires_proof: boolean;
  proof_type: ProofType | null;
  weight: number;
}

export interface CitySeed {
  name: string;
  slug: string;
  timezone: string;
  policeVerification: boolean;
  utilities: UtilitySeed[];
  vendors: VendorSeed[];
  docRequirements: DocReqSeed[];
}

/**
 * Build a city's task templates. The backbone is shared, but utility lead times
 * come from that city's setup days, and police verification is conditional —
 * this is what makes each city's generated checklist genuinely different.
 */
export function buildTemplates(city: CitySeed): TemplateSeed[] {
  const days = (t: UtilitySeed["type"]) =>
    city.utilities.find((u) => u.type === t)?.avg_setup_days ?? 7;

  const templates: TemplateSeed[] = [
    // Housing
    {
      key: "apartment_shortlist",
      title: "Shortlist apartments",
      category: "apartment",
      owner_role: "ops",
      lead_time_days: -21,
      depends_on: [],
      requires_proof: false,
      proof_type: null,
      weight: 2,
    },
    {
      key: "apartment_approve",
      title: "Customer approves apartment",
      category: "apartment",
      owner_role: "ops",
      lead_time_days: -17,
      depends_on: ["apartment_shortlist"],
      requires_proof: true,
      proof_type: "confirmation",
      weight: 2,
    },
    {
      key: "lease_sign",
      title: "Sign lease agreement",
      category: "apartment",
      owner_role: "ops",
      lead_time_days: -14,
      depends_on: ["apartment_approve"],
      requires_proof: true,
      proof_type: "doc",
      weight: 2,
    },
    // Logistics
    {
      key: "movers_quote",
      title: "Get packers & movers quotes",
      category: "movers",
      owner_role: "ops",
      lead_time_days: -12,
      depends_on: ["lease_sign"],
      requires_proof: false,
      proof_type: null,
      weight: 1,
    },
    {
      key: "movers_book",
      title: "Book packers & movers",
      category: "movers",
      owner_role: "ops",
      lead_time_days: -8,
      depends_on: ["movers_quote"],
      requires_proof: true,
      proof_type: "confirmation",
      weight: 2,
    },
    {
      key: "packing_day",
      title: "Packing day",
      category: "movers",
      owner_role: "ops",
      lead_time_days: -1,
      depends_on: ["movers_book"],
      requires_proof: false,
      proof_type: null,
      weight: 1,
    },
    {
      key: "move_day",
      title: "Move day — delivery & unload",
      category: "movers",
      owner_role: "ops",
      lead_time_days: 0,
      depends_on: ["packing_day"],
      requires_proof: true,
      proof_type: "photo",
      weight: 2,
    },
    // Utilities — lead times driven by the city's setup days
    {
      key: "electricity_setup",
      title: "Set up electricity connection",
      category: "utility",
      owner_role: "ops",
      lead_time_days: -days("electricity"),
      depends_on: ["lease_sign"],
      requires_proof: true,
      proof_type: "account_no",
      weight: 1,
    },
    {
      key: "internet_setup",
      title: "Set up internet / broadband",
      category: "utility",
      owner_role: "ops",
      lead_time_days: -days("internet"),
      depends_on: ["lease_sign"],
      requires_proof: true,
      proof_type: "account_no",
      weight: 1,
    },
    {
      key: "gas_setup",
      title: "Set up piped/LPG gas connection",
      category: "utility",
      owner_role: "ops",
      lead_time_days: -days("gas"),
      depends_on: ["lease_sign"],
      requires_proof: true,
      proof_type: "account_no",
      weight: 1,
    },
    {
      key: "water_setup",
      title: "Set up water connection",
      category: "utility",
      owner_role: "ops",
      lead_time_days: -days("water"),
      depends_on: ["lease_sign"],
      requires_proof: true,
      proof_type: "account_no",
      weight: 1,
    },
    // Paperwork
    {
      key: "bank_address_change",
      title: "Update bank address",
      category: "paperwork",
      owner_role: "ops",
      lead_time_days: 3,
      depends_on: ["move_day"],
      requires_proof: true,
      proof_type: "doc",
      weight: 1,
    },
    {
      key: "id_address_change",
      title: "Update ID / Aadhaar address",
      category: "paperwork",
      owner_role: "ops",
      lead_time_days: 5,
      depends_on: ["move_day"],
      requires_proof: true,
      proof_type: "doc",
      weight: 1,
    },
    {
      key: "subscriptions_update",
      title: "Update subscriptions & deliveries",
      category: "paperwork",
      owner_role: "ops",
      lead_time_days: 7,
      depends_on: ["move_day"],
      requires_proof: false,
      proof_type: null,
      weight: 1,
    },
    // Support / post-move
    {
      key: "settle_in_pack",
      title: "Share settle-in / local orientation pack",
      category: "support",
      owner_role: "ops",
      lead_time_days: 2,
      depends_on: ["move_day"],
      requires_proof: false,
      proof_type: null,
      weight: 1,
    },
    {
      key: "feedback_nps",
      title: "Collect feedback / NPS",
      category: "support",
      owner_role: "ops",
      lead_time_days: 10,
      depends_on: ["move_day"],
      requires_proof: false,
      proof_type: null,
      weight: 1,
    },
  ];

  if (city.policeVerification) {
    templates.push({
      key: "police_verification",
      title: "Complete tenant police verification",
      category: "paperwork",
      owner_role: "ops",
      lead_time_days: 4,
      depends_on: ["lease_sign"],
      requires_proof: true,
      proof_type: "doc",
      weight: 1,
    });
  }

  return templates;
}

const BASE_DOCS: DocReqSeed[] = [
  { name: "Government ID (Aadhaar / PAN)", applies_to: "customer", mandatory: true },
  { name: "Signed Rental Agreement", applies_to: "relocation", mandatory: true },
  { name: "Passport-size Photographs", applies_to: "customer", mandatory: false },
];

export const CITIES: CitySeed[] = [
  {
    name: "Bengaluru",
    slug: "bengaluru",
    timezone: "Asia/Kolkata",
    policeVerification: false,
    utilities: [
      { type: "electricity", name: "BESCOM", avg_setup_days: 5, contact: "1912" },
      { type: "internet", name: "ACT Fibernet", avg_setup_days: 10, contact: "1800-1020-0000" },
      { type: "gas", name: "Indane LPG", avg_setup_days: 7, contact: "1906" },
      { type: "water", name: "BWSSB", avg_setup_days: 6, contact: "1916" },
    ],
    vendors: [
      { type: "property", name: "NestAway Bengaluru", contact: "ops@nestaway.in", on_time_pct: 92, issue_rate: 6, rating: 4.5 },
      { type: "property", name: "Brigade Rentals", contact: "rentals@brigade.in", on_time_pct: 88, issue_rate: 9, rating: 4.2 },
      { type: "movers", name: "Agarwal Packers BLR", contact: "blr@agarwalpackers.in", on_time_pct: 94, issue_rate: 4, rating: 4.6 },
      { type: "movers", name: "LEO Packers", contact: "hello@leopackers.in", on_time_pct: 81, issue_rate: 14, rating: 3.9 },
    ],
    docRequirements: [
      ...BASE_DOCS,
      { name: "Karnataka E-Khata / KYC", applies_to: "relocation", mandatory: true, notes: "Required by BWSSB & BESCOM for new connections." },
    ],
  },
  {
    name: "Pune",
    slug: "pune",
    timezone: "Asia/Kolkata",
    policeVerification: false,
    utilities: [
      { type: "electricity", name: "MSEDCL", avg_setup_days: 4, contact: "1912" },
      { type: "internet", name: "Jio Fiber", avg_setup_days: 7, contact: "1800-889-9999" },
      { type: "gas", name: "MNGL", avg_setup_days: 5, contact: "020-2616-1000" },
      { type: "water", name: "PCMC Water", avg_setup_days: 4, contact: "020-2742-5511" },
    ],
    vendors: [
      { type: "property", name: "Kolte-Patil Lettings", contact: "lease@koltepatil.in", on_time_pct: 90, issue_rate: 7, rating: 4.4 },
      { type: "property", name: "Pune Rent Hub", contact: "hub@punerent.in", on_time_pct: 84, issue_rate: 11, rating: 4.0 },
      { type: "movers", name: "Writer Relocations PNQ", contact: "pnq@writercorp.in", on_time_pct: 96, issue_rate: 3, rating: 4.7 },
      { type: "movers", name: "Maxworth Movers", contact: "care@maxworth.in", on_time_pct: 79, issue_rate: 16, rating: 3.7 },
    ],
    docRequirements: [
      ...BASE_DOCS,
      { name: "Society NOC", applies_to: "relocation", mandatory: true, notes: "Housing society no-objection certificate." },
    ],
  },
  {
    name: "Mumbai",
    slug: "mumbai",
    timezone: "Asia/Kolkata",
    policeVerification: true,
    utilities: [
      { type: "electricity", name: "Adani Electricity", avg_setup_days: 7, contact: "19122" },
      { type: "internet", name: "Hathway Broadband", avg_setup_days: 14, contact: "1800-419-9595" },
      { type: "gas", name: "Mahanagar Gas", avg_setup_days: 10, contact: "1800-266-9944" },
      { type: "water", name: "BMC Water Dept", avg_setup_days: 9, contact: "1916" },
    ],
    vendors: [
      { type: "property", name: "Lodha Lettings", contact: "rent@lodha.in", on_time_pct: 91, issue_rate: 8, rating: 4.4 },
      { type: "property", name: "Mumbai Homes Co", contact: "ops@mumbaihomes.in", on_time_pct: 80, issue_rate: 15, rating: 3.8 },
      { type: "movers", name: "PM Relocations BOM", contact: "bom@pmrelocations.in", on_time_pct: 93, issue_rate: 5, rating: 4.5 },
      { type: "movers", name: "Gati Movers", contact: "mumbai@gati.in", on_time_pct: 82, issue_rate: 13, rating: 3.9 },
    ],
    docRequirements: [
      ...BASE_DOCS,
      { name: "Police Verification Form", applies_to: "relocation", mandatory: true, notes: "Mandatory tenant verification in Maharashtra." },
    ],
  },
  {
    name: "Delhi-NCR",
    slug: "delhi-ncr",
    timezone: "Asia/Kolkata",
    policeVerification: true,
    utilities: [
      { type: "electricity", name: "BSES Rajdhani", avg_setup_days: 6, contact: "19123" },
      { type: "internet", name: "Airtel Xstream", avg_setup_days: 12, contact: "121" },
      { type: "gas", name: "Indraprastha Gas (IGL)", avg_setup_days: 8, contact: "1800-102-5109" },
      { type: "water", name: "Delhi Jal Board", avg_setup_days: 7, contact: "1916" },
    ],
    vendors: [
      { type: "property", name: "DLF Rentals", contact: "lease@dlf.in", on_time_pct: 89, issue_rate: 9, rating: 4.3 },
      { type: "property", name: "NCR Nest", contact: "ops@ncrnest.in", on_time_pct: 83, issue_rate: 12, rating: 4.0 },
      { type: "movers", name: "Agarwal Packers DEL", contact: "del@agarwalpackers.in", on_time_pct: 90, issue_rate: 7, rating: 4.4 },
      { type: "movers", name: "Capital Movers", contact: "hello@capitalmovers.in", on_time_pct: 77, issue_rate: 18, rating: 3.6 },
    ],
    docRequirements: [
      ...BASE_DOCS,
      { name: "Address Proof for Utility Connection", applies_to: "relocation", mandatory: true },
      { name: "Police Verification Form", applies_to: "relocation", mandatory: true },
    ],
  },
  {
    name: "Hyderabad",
    slug: "hyderabad",
    timezone: "Asia/Kolkata",
    policeVerification: false,
    utilities: [
      { type: "electricity", name: "TSSPDCL", avg_setup_days: 4, contact: "1912" },
      { type: "internet", name: "ACT Fibernet", avg_setup_days: 8, contact: "1800-1020-0000" },
      { type: "gas", name: "Bharat Gas", avg_setup_days: 6, contact: "1800-22-4344" },
      { type: "water", name: "HMWSSB", avg_setup_days: 5, contact: "155313" },
    ],
    vendors: [
      { type: "property", name: "My Home Lettings", contact: "rent@myhome.in", on_time_pct: 93, issue_rate: 5, rating: 4.5 },
      { type: "property", name: "Hitech Homes", contact: "ops@hitechhomes.in", on_time_pct: 85, issue_rate: 10, rating: 4.1 },
      { type: "movers", name: "Sai Packers HYD", contact: "hyd@saipackers.in", on_time_pct: 91, issue_rate: 6, rating: 4.4 },
      { type: "movers", name: "Deccan Movers", contact: "care@deccanmovers.in", on_time_pct: 80, issue_rate: 15, rating: 3.8 },
    ],
    docRequirements: [
      ...BASE_DOCS,
      { name: "Local Address Affidavit", applies_to: "relocation", mandatory: false },
    ],
  },
  {
    name: "Chennai",
    slug: "chennai",
    timezone: "Asia/Kolkata",
    policeVerification: false,
    utilities: [
      { type: "electricity", name: "TNEB / TANGEDCO", avg_setup_days: 5, contact: "94987-94987" },
      { type: "internet", name: "BSNL Fiber", avg_setup_days: 9, contact: "1800-345-1500" },
      { type: "gas", name: "Indane LPG", avg_setup_days: 7, contact: "1906" },
      { type: "water", name: "CMWSSB (Metrowater)", avg_setup_days: 8, contact: "044-4567-4567" },
    ],
    vendors: [
      { type: "property", name: "Casagrand Rentals", contact: "rent@casagrand.in", on_time_pct: 90, issue_rate: 7, rating: 4.3 },
      { type: "property", name: "Chennai Stay Co", contact: "ops@chennaistay.in", on_time_pct: 82, issue_rate: 12, rating: 3.9 },
      { type: "movers", name: "Chennai Cargo Movers", contact: "hello@chennaicargo.in", on_time_pct: 88, issue_rate: 9, rating: 4.2 },
      { type: "movers", name: "Marina Packers", contact: "care@marinapackers.in", on_time_pct: 78, issue_rate: 17, rating: 3.6 },
    ],
    docRequirements: [
      ...BASE_DOCS,
      { name: "TNEB New Connection Form", applies_to: "relocation", mandatory: true },
    ],
  },
  {
    name: "Kolkata",
    slug: "kolkata",
    timezone: "Asia/Kolkata",
    policeVerification: false,
    utilities: [
      { type: "electricity", name: "CESC", avg_setup_days: 6, contact: "1912" },
      { type: "internet", name: "Alliance Broadband", avg_setup_days: 11, contact: "033-6628-0000" },
      { type: "gas", name: "Bengal Gas", avg_setup_days: 9, contact: "1800-345-3300" },
      { type: "water", name: "KMC Water Supply", avg_setup_days: 6, contact: "033-2286-1000" },
    ],
    vendors: [
      { type: "property", name: "PS Group Rentals", contact: "rent@psgroup.in", on_time_pct: 87, issue_rate: 9, rating: 4.2 },
      { type: "property", name: "Kolkata Homes", contact: "ops@kolkatahomes.in", on_time_pct: 81, issue_rate: 13, rating: 3.9 },
      { type: "movers", name: "Eastern Packers", contact: "hello@easternpackers.in", on_time_pct: 89, issue_rate: 8, rating: 4.3 },
      { type: "movers", name: "Howrah Movers", contact: "care@howrahmovers.in", on_time_pct: 76, issue_rate: 19, rating: 3.5 },
    ],
    docRequirements: [
      ...BASE_DOCS,
      { name: "CESC New Connection Document", applies_to: "relocation", mandatory: true },
    ],
  },
  {
    name: "Ahmedabad",
    slug: "ahmedabad",
    timezone: "Asia/Kolkata",
    policeVerification: false,
    utilities: [
      { type: "electricity", name: "Torrent Power", avg_setup_days: 3, contact: "1800-233-0000" },
      { type: "internet", name: "GTPL Broadband", avg_setup_days: 6, contact: "1800-419-9999" },
      { type: "gas", name: "Adani Gas", avg_setup_days: 5, contact: "1800-3002-3001" },
      { type: "water", name: "AMC Water Supply", avg_setup_days: 4, contact: "079-2539-1811" },
    ],
    vendors: [
      { type: "property", name: "Adani Realty Lettings", contact: "rent@adanirealty.in", on_time_pct: 92, issue_rate: 6, rating: 4.5 },
      { type: "property", name: "Amdavad Homes", contact: "ops@amdavadhomes.in", on_time_pct: 84, issue_rate: 11, rating: 4.0 },
      { type: "movers", name: "Gujarat Cargo Movers", contact: "hello@gujaratcargo.in", on_time_pct: 90, issue_rate: 7, rating: 4.3 },
      { type: "movers", name: "Sabarmati Packers", contact: "care@sabarmatipackers.in", on_time_pct: 80, issue_rate: 14, rating: 3.8 },
    ],
    docRequirements: [
      ...BASE_DOCS,
      { name: "AMC Property Tax Receipt", applies_to: "relocation", mandatory: false },
    ],
  },
];

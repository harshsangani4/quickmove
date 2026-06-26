/**
 * Domain types mirroring the Postgres schema (build doc §4).
 * Hand-maintained for clarity; kept in sync with supabase/migrations.
 */

export type Role = "ops" | "lead" | "admin";
export type TaskCategory = "apartment" | "movers" | "utility" | "paperwork" | "support";
export type ProofType = "account_no" | "photo" | "doc" | "confirmation";
export type UtilityType = "electricity" | "internet" | "gas" | "water";
export type VendorType = "property" | "movers";
export type Stage = "intake" | "housing" | "logistics" | "utilities" | "paperwork" | "post_move" | "done";
export type RelocationStatus = "active" | "on_hold" | "completed" | "cancelled";
export type RiskLevel = "on_track" | "at_risk" | "critical";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type EscalationStatus = "open" | "ack" | "resolved";
export type ApartmentStatus = "shortlisted" | "approved" | "rejected";
export type DocumentStatus = "pending" | "uploaded" | "validating" | "validated" | "rejected";
export type MessageSender = "ops" | "customer" | "system";
export type Channel = "app" | "whatsapp" | "email";
export type CommsStatus = "queued" | "sent" | "failed" | "dead";
export type PaymentStatus = "due" | "paid";
export type ActorType = "ops" | "customer" | "system";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  city_ids: string[];
  avatar_url: string | null;
  active: boolean;
}

export interface City {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  active: boolean;
}

export interface UtilityProvider {
  id: string;
  city_id: string;
  type: UtilityType;
  name: string;
  avg_setup_days: number;
  contact: string | null;
}

export interface Vendor {
  id: string;
  city_id: string;
  type: VendorType;
  name: string;
  contact: string | null;
  on_time_pct: number;
  issue_rate: number;
  rating: number;
  active: boolean;
}

export interface DocRequirement {
  id: string;
  city_id: string;
  name: string;
  applies_to: "customer" | "relocation";
  mandatory: boolean;
  notes: string | null;
}

export interface TaskTemplate {
  id: string;
  city_id: string;
  key: string;
  title: string;
  category: TaskCategory;
  owner_role: Role;
  lead_time_days: number;
  depends_on: string[];
  requires_proof: boolean;
  proof_type: ProofType | null;
  weight: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  current_city: string | null;
  preferred_lang: string;
}

export interface Relocation {
  id: string;
  customer_id: string;
  origin_city: string | null;
  destination_city_id: string;
  move_date: string; // ISO date
  stage: Stage;
  status: RelocationStatus;
  ops_owner_id: string | null;
  progress_pct: number;
  risk_level: RiskLevel;
  created_at: string;
}

export interface Task {
  id: string;
  relocation_id: string;
  template_key: string;
  title: string;
  category: TaskCategory;
  owner_id: string | null;
  due_date: string | null;
  status: TaskStatus;
  blocked_reason: string | null;
  requires_proof: boolean;
  proof_type: ProofType | null;
  proof_value: string | null;
  proof_url: string | null;
  depends_on: string[];
  completed_at: string | null;
  completed_by: string | null;
  sort_order: number;
}

export interface Escalation {
  id: string;
  relocation_id: string;
  task_id: string | null;
  reason: string;
  level: number;
  status: EscalationStatus;
  created_at: string;
}

export interface Apartment {
  id: string;
  relocation_id: string;
  vendor_id: string | null;
  title: string;
  rent: number | null;
  bedrooms: number | null;
  locality: string | null;
  commute_min: number | null;
  photos: string[];
  status: ApartmentStatus;
  customer_note: string | null;
}

export interface DocumentRow {
  id: string;
  relocation_id: string;
  customer_id: string | null;
  type: string;
  file_url: string | null;
  status: DocumentStatus;
  extracted: Record<string, unknown> | null;
  validation: Record<string, unknown> | null;
  reject_reason: string | null;
  uploaded_at: string | null;
}

export interface Message {
  id: string;
  relocation_id: string;
  sender: MessageSender;
  channel: Channel;
  body: string;
  created_at: string;
}

export interface Payment {
  id: string;
  relocation_id: string;
  label: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  due_date: string | null;
  invoice_url: string | null;
  paid_at: string | null;
}

export interface ActivityLogRow {
  id: string;
  relocation_id: string | null;
  actor_id: string | null;
  actor_type: ActorType;
  action: string;
  entity: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
}

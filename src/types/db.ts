import type { Database } from "@/integrations/supabase/types";

export type Json = Database["public"]["Tables"][string]["Row"][string];

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];

export type TableRow = Record<string, unknown>;

export interface AppUser {
  id: string;
  email?: string;
}

export interface AppSession {
  access_token: string;
  user: AppUser;
}

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TableRow = Record<string, unknown>;
export type Tables<T extends string = string> = TableRow & { __table?: T };
export type TablesInsert<T extends string = string> = Record<string, unknown> & { __table?: T };

export interface AppUser {
  id: string;
  email?: string;
}

export interface AppSession {
  access_token: string;
  user: AppUser;
}

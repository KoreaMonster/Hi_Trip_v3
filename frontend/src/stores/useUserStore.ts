import { create } from "zustand";

export interface UserDetail {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: "super_admin" | "manager" | "staff";
  is_approved?: boolean;
}

interface UserState {
  user: UserDetail | null;
  setUser: (u: UserDetail | null) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (u) => set({ user: u }),
  logout: () => set({ user: null })
}));

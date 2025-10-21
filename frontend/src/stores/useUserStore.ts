import { create } from 'zustand';
import type { UserDetail } from '@/types/api';

interface UserState {
  user: UserDetail | null;
  setUser: (user: UserDetail | null) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CompanyData {
  razaoSocial: string;
  cnpj: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  // Geocoded coordinates for route starting point
  latitude: number | null;
  longitude: number | null;
}

export interface SubUser {
  id: string;
  name: string;
  email: string;
  cargo: string;
  accessLevel: 'admin' | 'operacional' | 'financeiro' | 'visualizacao';
  createdAt: Date;
  active: boolean;
}

export interface MasterUser {
  name: string;
  cargo: string;
  telefone: string;
  email: string;
}

interface CompanyStore {
  company: CompanyData | null;
  masterUser: MasterUser | null;
  subUsers: SubUser[];
  setCompany: (data: CompanyData) => void;
  setMasterUser: (user: MasterUser) => void;
  addSubUser: (user: Omit<SubUser, 'id' | 'createdAt'>) => void;
  updateSubUser: (id: string, data: Partial<SubUser>) => void;
  removeSubUser: (id: string) => void;
  getBaseCoordinates: () => { lat: number; lng: number } | null;
}

export const useCompanyStore = create<CompanyStore>()(
  persist(
    (set, get) => ({
      company: null,
      masterUser: null,
      subUsers: [],
      
      setCompany: (data) => set({ company: data }),
      
      setMasterUser: (user) => set({ masterUser: user }),
      
      addSubUser: (user) => set((state) => ({
        subUsers: [
          ...state.subUsers,
          {
            ...user,
            id: crypto.randomUUID(),
            createdAt: new Date(),
          }
        ]
      })),
      
      updateSubUser: (id, data) => set((state) => ({
        subUsers: state.subUsers.map(u => 
          u.id === id ? { ...u, ...data } : u
        )
      })),
      
      removeSubUser: (id) => set((state) => ({
        subUsers: state.subUsers.filter(u => u.id !== id)
      })),
      
      getBaseCoordinates: () => {
        const company = get().company;
        if (company?.latitude && company?.longitude) {
          return { lat: company.latitude, lng: company.longitude };
        }
        return null;
      }
    }),
    {
      name: 'company-storage',
    }
  )
);

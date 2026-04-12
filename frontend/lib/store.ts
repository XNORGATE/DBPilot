"use client"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Connection, SchemaInfo, ActivityItem } from "./types"

interface AppState {
  connectionId: string | null
  connection: Connection | null
  schema: SchemaInfo | null

  // Separate activity logs for each portal
  staffActivity: ActivityItem[]   // DataChat queries + CRUD operations
  adminActivity: ActivityItem[]   // Migrations + schema changes

  setConnection: (id: string, conn: Connection, schema: SchemaInfo) => void
  clearConnection: () => void
  addStaffActivity: (item: Omit<ActivityItem, "id" | "ts">) => void
  addAdminActivity: (item: Omit<ActivityItem, "id" | "ts">) => void
  clearStaffActivity: () => void
  clearAdminActivity: () => void

  // Legacy – keeps Dashboard working if old activity exists
  recentActivity: ActivityItem[]
  addActivity: (item: Omit<ActivityItem, "id" | "ts">) => void
  clearActivity: () => void
}

function makeItem(item: Omit<ActivityItem, "id" | "ts">): ActivityItem {
  return { ...item, id: Date.now(), ts: new Date().toLocaleTimeString() }
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      connectionId: null,
      connection: null,
      schema: null,
      staffActivity: [],
      adminActivity: [],
      recentActivity: [],

      setConnection: (id, conn, schema) =>
        set({ connectionId: id, connection: conn, schema }),

      clearConnection: () =>
        set({
          connectionId: null,
          connection: null,
          schema: null,
          staffActivity: [],
          adminActivity: [],
          recentActivity: [],
        }),

      addStaffActivity: (item) =>
        set((s) => ({
          staffActivity: [makeItem(item), ...s.staffActivity].slice(0, 30),
        })),

      addAdminActivity: (item) =>
        set((s) => ({
          adminActivity: [makeItem(item), ...s.adminActivity].slice(0, 30),
        })),

      clearStaffActivity: () => set({ staffActivity: [] }),
      clearAdminActivity: () => set({ adminActivity: [] }),

      // Legacy
      addActivity: (item) =>
        set((s) => ({
          recentActivity: [makeItem(item), ...s.recentActivity].slice(0, 30),
        })),
      clearActivity: () => set({ recentActivity: [] }),
    }),
    {
      name: "dbpilot-store",
      partialize: (s) => ({
        connectionId: s.connectionId,
        connection: s.connection,
        schema: s.schema,
        staffActivity: s.staffActivity,
        adminActivity: s.adminActivity,
        recentActivity: s.recentActivity,
      }),
    }
  )
)

"use client"
import { useAppStore } from "@/lib/store"
import ConnectionSetup from "@/components/ConnectionSetup"
import Dashboard from "@/components/Dashboard"

export default function Home() {
  const connectionId = useAppStore((s) => s.connectionId)
  return connectionId ? <Dashboard /> : <ConnectionSetup />
}

import type { Metadata } from "next"
import { Suspense } from "react"
import "./globals.css"
import NavBar from "@/components/NavBar"

export const metadata: Metadata = {
  title: "YunoClinic — AI-powered clinic management",
  description: "AI-powered clinic data management: query patient records, track appointments, manage staff, and ship schema changes safely.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <NavBar />
        </Suspense>
        <main>{children}</main>
      </body>
    </html>
  )
}

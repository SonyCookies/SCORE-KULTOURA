"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import LoginForm from "@/components/auth/login-form"
import JudgeDashboard from "@/components/judge/judge-dashboard"
import KultouraLoading from "@/components/kultoura-loading"

export default function HomePage() {
  const { user, loading: authLoading } = useAuth()
  const [minLoadingComplete, setMinLoadingComplete] = useState(false)

  useEffect(() => {
    // Ensure minimum 3-second loading time
    const timer = setTimeout(() => {
      setMinLoadingComplete(true)
    }, 2500)

    return () => clearTimeout(timer)
  }, [])

  const isLoading = authLoading || !minLoadingComplete

  if (isLoading) {
    return <KultouraLoading />
  }

  return user ? <JudgeDashboard /> : <LoginForm />
}

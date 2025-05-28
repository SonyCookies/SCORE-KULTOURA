"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import AdminLoginForm from "@/components/admin/admin-login-form"
import AdminDashboard from "@/components/admin/admin-dashboard"
import KultouraLoading from "@/components/kultoura-loading"

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const [minLoadingComplete, setMinLoadingComplete] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Ensure minimum 2-second loading time for admin
    const timer = setTimeout(() => {
      setMinLoadingComplete(true)
    }, 2500)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Check if user is admin (you can implement admin role checking here)
    if (user) {
      // For now, we'll check if email contains 'admin' or implement proper role checking
      // In production, you'd check against a Firestore collection or custom claims
      setIsAdmin(true) // Simplified for demo - implement proper admin checking
    }
  }, [user])

  // Show loading if auth is still loading OR if minimum time hasn't passed
  const isLoading = authLoading || !minLoadingComplete

  if (isLoading) {
    return <KultouraLoading />
  }

  return user && isAdmin ? <AdminDashboard /> : <AdminLoginForm />
}

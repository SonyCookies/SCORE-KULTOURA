"use client"

import type React from "react"
import { useState } from "react"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Shield, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function AdminLoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    setError("")

    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password)

      // Check if user is admin in Firestore
      const adminDoc = await getDoc(doc(db, "admins", userCredential.user.uid))

      if (!adminDoc.exists()) {
        setError("Access denied. Admin privileges required.")
        await auth.signOut()
        return
      }

      const adminData = adminDoc.data()
      if (adminData.status !== "active") {
        setError("Admin account is not active. Please contact system administrator.")
        await auth.signOut()
        return
      }
    } catch (error: any) {
      console.error("Admin login error:", error)
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        setError("Invalid admin credentials")
      } else {
        setError(error.message || "An error occurred during authentication")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Back to Judge Portal */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Judge Portal
          </Link>
        </div>

        {/* KULTOURA Admin Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Shield className="h-8 w-8 text-red-600" />
            <h1 className="text-5xl font-bold text-gray-900">KULTOURA</h1>
          </div>
          <p className="text-gray-600 font-medium text-lg">Cultural Experience Platform</p>
          <div className="w-20 h-1 bg-red-600 mx-auto rounded-full mt-3"></div>
          <p className="text-red-700 mt-4 font-bold">ADMIN PORTAL</p>
        </div>

        {/* Admin Login Card */}
        <Card className="border-red-200 shadow-lg bg-white">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-gray-900 flex items-center gap-2">
              <Shield className="h-6 w-6 text-red-600" />
              Admin Access
            </CardTitle>
            <CardDescription className="text-gray-600">Sign in with your administrator credentials</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">
                  Admin Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@kultoura.com"
                  required
                  disabled={loading}
                  className="border-gray-300 focus:border-red-500 focus:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="border-gray-300 focus:border-red-500 focus:ring-red-500"
                />
              </div>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-4 mt-4">
              <Button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Sign In as Admin
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Security Notice */}
        <div className="text-center space-y-2">
          <p className="text-red-600 text-sm font-medium">🔒 Secure Admin Access</p>
          <p className="text-gray-500 text-xs">This portal is restricted to authorized administrators only</p>
        </div>
      </div>
    </div>
  )
}

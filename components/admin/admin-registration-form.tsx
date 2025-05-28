"use client"

import type React from "react"
import { useState } from "react"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, setDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Shield, ArrowLeft, UserPlus } from "lucide-react"
import Link from "next/link"

export default function AdminRegistrationForm() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    adminCode: "",
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    // Simple admin code check (in production, use a more secure method)
    if (formData.adminCode !== "KULTOURA-ADMIN-2024") {
      setError("Invalid admin registration code")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password)

      // Create admin document in Firestore
      await setDoc(doc(db, "admins", userCredential.user.uid), {
        email: formData.email,
        fullName: formData.fullName,
        role: "admin",
        status: "active",
        createdAt: new Date(),
        permissions: {
          manageEvents: true,
          manageJudges: true,
          manageParticipants: true,
          viewReports: true,
        },
      })

      setSuccess(true)
    } catch (error: any) {
      console.error("Admin registration error:", error)
      setError(error.message || "An error occurred during registration")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md border-green-200 bg-green-50">
          <CardHeader className="text-center">
            <CardTitle className="text-green-800">Registration Successful!</CardTitle>
            <CardDescription className="text-green-700">Admin account has been created successfully</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-green-700 mb-4">You can now sign in with your admin credentials.</p>
            <Link href="/admin">
              <Button className="bg-green-600 hover:bg-green-700">Go to Admin Login</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Back to Admin Login */}
        <div className="text-center">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin Login
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
          <p className="text-red-700 mt-4 font-bold">ADMIN REGISTRATION</p>
        </div>

        {/* Admin Registration Card */}
        <Card className="border-red-200 shadow-lg bg-white">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-gray-900 flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-red-600" />
              Create Admin Account
            </CardTitle>
            <CardDescription className="text-gray-600">Register as a system administrator</CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-gray-700 font-medium">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  placeholder="John Doe"
                  required
                  disabled={loading}
                  className="border-gray-300 focus:border-red-500 focus:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">
                  Admin Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
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
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="border-gray-300 focus:border-red-500 focus:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-gray-700 font-medium">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="border-gray-300 focus:border-red-500 focus:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminCode" className="text-gray-700 font-medium">
                  Admin Registration Code
                </Label>
                <Input
                  id="adminCode"
                  name="adminCode"
                  type="password"
                  value={formData.adminCode}
                  onChange={handleInputChange}
                  placeholder="Enter admin code"
                  required
                  disabled={loading}
                  className="border-gray-300 focus:border-red-500 focus:ring-red-500"
                />
                <p className="text-xs text-gray-500">Contact system administrator for the registration code</p>
              </div>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Create Admin Account
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Security Notice */}
        <div className="text-center space-y-2">
          <p className="text-red-600 text-sm font-medium">🔒 Secure Registration</p>
          <p className="text-gray-500 text-xs">Admin registration requires a valid registration code</p>
        </div>
      </div>
    </div>
  )
}

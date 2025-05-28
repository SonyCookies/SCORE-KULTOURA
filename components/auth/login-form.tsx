"use client"

import type React from "react"
import { useState } from "react"
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from 'lucide-react'

export default function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    setLoading(true)
    setError("")

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
    } catch (error: any) {
      setError(error.message || "An error occurred during authentication")
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setIsSignUp(!isSignUp)
    setError("")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8">
        {/* KULTOURA Header */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-3">KULTOURA</h1>
          <p className="text-gray-600 font-medium text-lg">Celebrating the Rich Culture and Heritage of Oriental Mindoro</p>
          <div className="w-20 h-1 bg-gray-300 mx-auto rounded-full mt-3"></div>
          <p className="text-gray-700 mt-4 font-medium">Judge Portal</p>
        </div>

        {/* Login Card */}
        <Card className="border-gray-200 shadow-lg bg-white">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-gray-900">{isSignUp ? "Create Account" : "Welcome Back"}</CardTitle>
            <CardDescription className="text-gray-600">
              {isSignUp ? "Register as a judge for KULTOURA" : "Sign in to access your judge dashboard"}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-700 font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="judge@kultoura.com"
                  required
                  disabled={loading}
                  className="border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                />
              </div>

              <div className="space-y-2 mb-4">
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
                  className="border-gray-300 focus:border-gray-500 focus:ring-gray-500"
                />
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
                disabled={loading || !email || !password}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-2.5"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isSignUp ? "Creating Account..." : "Signing In..."}
                  </>
                ) : (
                  <>{isSignUp ? "Create Account" : "Sign In"}</>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={toggleMode}
                disabled={loading}
                className="w-full text-gray-600 hover:text-gray-800 hover:bg-gray-50"
              >
                {isSignUp ? "Already have an account? Sign In" : "Need an account? Sign Up"}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Footer */}
        <div className="text-center space-y-2">
          <p className="text-gray-600 text-sm italic">"Tracing Roots, Bridging Generations: Weaving Oriental Mindoro's Living Heritage"</p>
          <p className="text-gray-500 text-xs">&copy; {new Date().getFullYear()} KULTOURA Platform</p>
        </div>
      </div>
    </div>
  )
}

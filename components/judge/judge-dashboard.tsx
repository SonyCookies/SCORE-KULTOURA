"use client"

import { useState, useEffect } from "react"
import { collection, query, where, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Clock,
  Calendar,
  AlertCircle,
  Gavel,
  LogOut,
  RefreshCw,
  MapPin,
  UserCheck,
  Timer,
  Circle,
  Play,
  Star,
  Award,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"

import type { ActiveEvent } from "@/types"

export default function JudgeDashboard() {
  const { user, signOut } = useAuth()
  const [currentEvent, setCurrentEvent] = useState<ActiveEvent | null>(null)
  const [allActiveEvents, setAllActiveEvents] = useState<ActiveEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const loadDashboardData = async () => {
    if (!user) return
  }

  useEffect(() => {
    if (!user) return

    let unsubscribe: (() => void) | undefined

    const initializeDashboard = async () => {
      try {
        const activeEventQuery = query(
          collection(db, "events"),
          where("adminActivated", "==", true),
          where("showToJudges", "==", true),
        )

        unsubscribe = onSnapshot(
          activeEventQuery,
          (snapshot) => {
            if (!snapshot.empty) {
              const events = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })) as ActiveEvent[]

              const sortedEvents = events.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds)

              setAllActiveEvents(sortedEvents)
              setCurrentEvent(sortedEvents[0] || null)
            } else {
              setAllActiveEvents([])
              setCurrentEvent(null)
            }
            setLoading(false)
            setRefreshing(false)
          },
          (error) => {
            console.error("Error listening to events:", error)
            setError("Failed to load events. Please refresh the page.")
            setLoading(false)
            setRefreshing(false)
          },
        )
      } catch (error) {
        console.error("Error initializing dashboard:", error)
        setError("Failed to initialize dashboard. Please refresh the page.")
        setLoading(false)
        setRefreshing(false)
      }
    }

    initializeDashboard()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [user])

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setError("")

    await loadDashboardData()

    setTimeout(() => {
      setRefreshing(false)
    }, 1000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-stone-50 to-amber-50 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-amber-200 border-t-amber-800 rounded-full animate-spin mx-auto"></div>
            <Gavel className="h-6 w-6 text-amber-800 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-stone-900">Loading Dashboard</h3>
            <p className="text-stone-600 text-sm">Preparing your judging environment...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-stone-50 to-amber-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-32 h-32 border border-amber-300 rounded-full"></div>
        <div className="absolute top-40 right-32 w-24 h-24 border border-stone-300 rounded-full"></div>
        <div className="absolute bottom-32 left-1/3 w-20 h-20 border border-amber-300 rounded-full"></div>
        <div className="absolute bottom-20 right-20 w-28 h-28 border border-stone-300 rounded-full"></div>
      </div>

      <div className="relative max-w-5xl mx-auto p-6 space-y-8">
        {/* Enhanced Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-stone-200 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl">
                <Gavel className="h-8 w-8 text-amber-800" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-stone-900">KULTOURA</h1>
                <p className="text-amber-800 font-medium">Judge Dashboard</p>
                <p className="text-stone-600 text-sm">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
                <Star className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Judge</span>
              </div>
              <Button
                onClick={handleRefresh}
                variant="ghost"
                size="sm"
                disabled={refreshing}
                className="text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button
                onClick={handleSignOut}
                variant="ghost"
                size="sm"
                className="text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-200 bg-red-50/80 backdrop-blur-sm rounded-xl">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Primary Event Section */}
          <div className="lg:col-span-2 space-y-6">
            {currentEvent ? (
              <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden">
                {/* Live Header with Enhanced Design */}
                <div className="bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 px-6 py-4 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                      <Badge className="bg-red-600 text-white px-4 py-2 text-sm font-bold tracking-wide shadow-lg rounded-full">
                        🔴 LIVE
                      </Badge>
                      <div className="flex items-center gap-2 text-amber-100">
                        <Users className="h-4 w-4" />
                        <span className="text-sm font-medium">Active Event</span>
                      </div>
                    </div>
                    <div className="relative">
                      <Circle className="h-3 w-3 text-red-400 fill-red-400 animate-pulse" />
                      <Circle className="h-6 w-6 text-red-400/30 absolute -top-1.5 -left-1.5 animate-ping" />
                    </div>
                  </div>
                </div>

                <CardContent className="p-8 space-y-8">
                  {/* Event Details */}
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <Award className="h-6 w-6 text-amber-700" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-stone-900 mb-2">{currentEvent.title}</h2>
                        <p className="text-stone-600 leading-relaxed">{currentEvent.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <Button
                    onClick={() => {
                      const path = currentEvent.category.toLowerCase().includes("fashion")
                        ? `/judge/cultural-fashion-walk/${currentEvent.id}`
                        : `/judge/${currentEvent.id}`
                      router.push(path)
                    }}
                    className="w-full bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 hover:from-amber-800 hover:via-amber-900 hover:to-amber-950 text-white font-semibold py-6 px-8 rounded-xl shadow-lg transform hover:-translate-y-1 hover:shadow-xl transition-all duration-200 group text-lg"
                    size="lg"
                  >
                    <Play className="h-6 w-6 mr-3 group-hover:scale-110 transition-transform" />
                    Start Judging Session
                  </Button>

                  {/* Status Indicator */}
                  <div className="flex items-center justify-center gap-3 text-stone-600">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Ready to begin evaluation</span>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl">
                <CardHeader className="pb-6">
                  <CardTitle className="flex items-center gap-3 text-stone-900 text-xl">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Clock className="h-6 w-6 text-amber-700" />
                    </div>
                    Waiting for Events
                  </CardTitle>
                  <CardDescription className="text-stone-600 ml-14">
                    {allActiveEvents.length > 0
                      ? "Events are available but not currently active for judging"
                      : "No active events available for judging"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {allActiveEvents.length > 0 ? (
                    <div className="space-y-6">
                      <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-6 text-center">
                        <AlertCircle className="h-8 w-8 text-amber-700 mx-auto mb-3" />
                        <h3 className="font-semibold text-amber-900 mb-2">Events Available</h3>
                        <p className="text-amber-800">{allActiveEvents.length} event(s) waiting for admin activation</p>
                      </div>

                      <div className="space-y-4">
                        {allActiveEvents.map((event) => (
                          <Card key={event.id} className="border-stone-200 bg-stone-50/50 rounded-xl">
                            <CardContent className="p-6">
                              <div className="flex justify-between items-start">
                                <div className="flex-1 space-y-3">
                                  <h5 className="font-semibold text-stone-900">{event.title}</h5>
                                  <p className="text-stone-600 text-sm">{event.description}</p>

                                  <div className="flex flex-wrap gap-4 text-xs text-stone-500">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      <span>{event.category}</span>
                                    </div>
                                    {event.venue && (
                                      <div className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" />
                                        <span>{event.venue}</span>
                                      </div>
                                    )}
                                    {event.duration && (
                                      <div className="flex items-center gap-1">
                                        <Timer className="h-3 w-3" />
                                        <span>{event.duration}</span>
                                      </div>
                                    )}
                                    {event.maxParticipants && (
                                      <div className="flex items-center gap-1">
                                        <UserCheck className="h-3 w-3" />
                                        <span>Max: {event.maxParticipants}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Badge className="bg-amber-100 text-amber-800 border-amber-200 rounded-full px-3 py-1">
                                  Waiting
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-stone-100 to-stone-200 rounded-xl p-8 text-center">
                      <AlertCircle className="h-12 w-12 text-stone-500 mx-auto mb-4" />
                      <h3 className="font-semibold text-stone-900 mb-2">No Active Events</h3>
                      <p className="text-stone-600">
                        Please wait for an administrator to create and activate an event for judging.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Instructions */}
            <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-stone-900">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-amber-700" />
                  </div>
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  {[
                    "Admin creates cultural events",
                    "Events are activated for judging",
                    "Evaluate participants based on criteria",
                    "Submit scores and feedback",
                  ].map((step, index) => (
                    <div key={index} className="flex gap-3">
                      <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800 rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="text-stone-700 leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Judge Information */}
            <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-lg rounded-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-stone-900">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Star className="h-5 w-5 text-amber-700" />
                  </div>
                  Judge Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  {[
                    { label: "Email", value: user?.email },
                    { label: "Judge ID", value: `${user?.uid.slice(0, 8)}...`, mono: true },
                    {
                      label: "Last Login",
                      value: user?.metadata?.lastSignInTime
                        ? new Date(user.metadata.lastSignInTime).toLocaleDateString()
                        : "Unknown",
                    },
                    {
                      label: "Account Created",
                      value: user?.metadata?.creationTime
                        ? new Date(user.metadata.creationTime).toLocaleDateString()
                        : "Unknown",
                    },
                  ].map((item, index) => (
                    <div key={index} className="flex justify-between py-2 border-b border-stone-100 last:border-b-0">
                      <span className="text-stone-600">{item.label}</span>
                      <span className={`font-medium text-stone-900 ${item.mono ? "font-mono text-xs" : ""}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

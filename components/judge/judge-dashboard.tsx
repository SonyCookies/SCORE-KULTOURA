"use client"

import { useState, useEffect } from "react"
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Clock,
  Eye,
  Calendar,
  AlertCircle,
  Gavel,
  LogOut,
  RefreshCw,
  MapPin,
  UserCheck,
  Timer,
} from "lucide-react"
import { useRouter } from "next/navigation"

import type { Participant } from "@/types"

interface ActiveEvent {
  id: string
  title: string
  description: string
  category: string
  participants: Participant[]
  maxParticipants?: number
  duration?: string
  venue?: string
  requirements?: string
  startTime?: Timestamp | null
  adminActivated: boolean
  showToJudges: boolean
  createdAt?: Timestamp | null
}

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
    // Placeholder if you want to add manual reload logic
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
              const events = snapshot.docs.map((doc) => {
                const data = doc.data()
                return {
                  id: doc.id,
                  title: data.title,
                  description: data.description,
                  category: data.category,
                  participants: (data.participants || []) as Participant[],
                  maxParticipants: data.maxParticipants,
                  duration: data.duration,
                  venue: data.venue,
                  requirements: data.requirements,
                  startTime: data.startTime || null,
                  adminActivated: data.adminActivated,
                  showToJudges: data.showToJudges,
                  createdAt: data.createdAt || null,
                } as ActiveEvent
              })

              const sortedEvents = events.sort(
                (a, b) =>
                  (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
              )

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
          }
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
      if (unsubscribe) unsubscribe()
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
              <Gavel className="h-8 w-8 text-gray-600" />
              KULTOURA Judge Dashboard
            </h1>
            <p className="text-gray-600 mt-1">Welcome back, {user?.email}</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRefresh}
              variant="outline"
              disabled={refreshing}
              className="border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {/* Current Active Event or Waiting State */}
        {currentEvent ? (
          <Card className="border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Eye className="h-5 w-5 text-green-500" />
                Active Event
              </CardTitle>
              <CardDescription className="text-gray-600">Event is live and ready for judging</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{currentEvent.title}</h3>
                <p className="text-gray-700">{currentEvent.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <span className="font-medium text-gray-900">Category:</span>
                  <p className="text-gray-700">{currentEvent.category}</p>
                </div>
                <div className="space-y-1">
                  <span className="font-medium text-gray-900">Participants:</span>
                  <p className="text-gray-700">{currentEvent.participants?.length || 0} registered</p>
                </div>
                {currentEvent.venue && (
                  <div className="space-y-1">
                    <span className="font-medium text-gray-900">Venue:</span>
                    <p className="text-gray-700">{currentEvent.venue}</p>
                  </div>
                )}
                {currentEvent.duration && (
                  <div className="space-y-1">
                    <span className="font-medium text-gray-900">Duration:</span>
                    <p className="text-gray-700">{currentEvent.duration}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <span className="font-medium text-gray-900">Started:</span>
                  <p className="text-gray-700">
                    {currentEvent.startTime?.toDate
                      ? currentEvent.startTime.toDate().toLocaleString()
                      : "Just now"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="font-medium text-gray-900">Status:</span>
                  <Badge className="bg-green-100 text-green-800 border-green-300">Live for Judging</Badge>
                </div>
              </div>

              {currentEvent.requirements && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-2">Event Requirements:</h4>
                  <p className="text-blue-700 text-sm">{currentEvent.requirements}</p>
                </div>
              )}

              <div className="pt-4 border-t border-gray-200">
                <Button
                  onClick={() => router.push(`/judge/${currentEvent.id}`)}
                  className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-3"
                  size="lg"
                >
                  Start Judging Event
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-900">
                <Clock className="h-5 w-5 text-yellow-500" />
                Waiting for Events
              </CardTitle>
              <CardDescription className="text-gray-600">
                {allActiveEvents.length > 0
                  ? "Events are available but not currently active for judging"
                  : "No active events available for judging"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allActiveEvents.length > 0 ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <AlertCircle className="h-8 w-8 text-blue-500 mx-auto mb-3" />
                    <h3 className="font-medium text-blue-800 mb-2">Events Available</h3>
                    <p className="text-blue-700 text-sm mb-4">
                      There are {allActiveEvents.length} event(s) created by the admin. Please wait for the admin to
                      activate an event for judging.
                    </p>
                  </div>

                  {/* Show all active events */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-gray-900">Available Events:</h4>
                    {allActiveEvents.map((event) => (
                      <Card key={event.id} className="border-gray-200 bg-gray-50">
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h5 className="font-semibold text-gray-900">{event.title}</h5>
                              <p className="text-gray-600 text-sm mt-1">{event.description}</p>

                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs text-gray-600">
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
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 ml-4">Waiting</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                  <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                  <h3 className="font-medium text-yellow-800 mb-2">No Active Events</h3>
                  <p className="text-yellow-700 text-sm">
                    Please wait for an administrator to create and activate an event for judging. You will be notified
                    when an event becomes available.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Calendar className="h-5 w-5 text-gray-600" />
              How Judging Works
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="font-medium text-gray-900 min-w-[20px]">1.</span>
                  <span>Admin creates and prepares cultural events</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-gray-900 min-w-[20px]">2.</span>
                  <span>Events are activated and made visible to judges</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="font-medium text-gray-900 min-w-[20px]">3.</span>
                  <span>You evaluate participants based on criteria</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-medium text-gray-900 min-w-[20px]">4.</span>
                  <span>Submit scores and feedback for each participant</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Judge Information */}
        <Card className="border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-gray-900">Judge Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-700">Email:</span>
                <span className="font-medium text-gray-900">{user?.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-700">Judge ID:</span>
                <span className="font-mono text-xs text-gray-600">{user?.uid.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-700">Last Login:</span>
                <span className="font-medium text-gray-900">
                  {user?.metadata?.lastSignInTime
                    ? new Date(user.metadata.lastSignInTime).toLocaleDateString()
                    : "Unknown"}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-700">Account Created:</span>
                <span className="font-medium text-gray-900">
                  {user?.metadata?.creationTime
                    ? new Date(user.metadata.creationTime).toLocaleDateString()
                    : "Unknown"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Shield,
  LogOut,
  Users,
  Calendar,
  Play,
  Pause,
  Trash2,
  Settings,
  BarChart3,
  MapPin,
  Clock,
  UserCheck,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react"
import EventCreationForm from "./event-creation-form"
import EventCriteriaForm from "./event-criteria-form"
import ParticipantManagement from "./participant-management"
import EventResultsDialog from "./event-results-dialog"
import SpecialAwardsManagement from "./special-awards-management"
import type { Event, Judge } from "@/types"

interface LoadingState {
  isLoading: boolean
  action: string
  eventId: string
  eventTitle: string
}

export default function AdminDashboard() {
  const { user, signOut } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [judges, setJudges] = useState<Judge[]>([])
  const [eventCriteria, setEventCriteria] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("overview")
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    action: "",
    eventId: "",
    eventTitle: "",
  })

  useEffect(() => {
    if (!user) return

    // Listen to events
    const eventsQuery = query(collection(db, "events"))
    const unsubscribeEvents = onSnapshot(
      eventsQuery,
      async (snapshot) => {
        const eventsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Event[]

        // Check which events have criteria
        const criteriaStatus: Record<string, boolean> = {}
for (const event of eventsData) {
  try {
    const criteriaDoc = await getDoc(doc(db, "eventCriteria", event.id));
    criteriaStatus[event.id] = criteriaDoc.exists();
  } catch {
    criteriaStatus[event.id] = false;
  }
}


        setEventCriteria(criteriaStatus)
        setEvents(eventsData.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds))
        setLoading(false)
      },
      (eventError) => {
        console.error("Error listening to events:", eventError)
        setError("Failed to load events")
        setLoading(false)
      },
    )

    // Listen to judges
    const judgesQuery = query(collection(db, "judges"))
    const unsubscribeJudges = onSnapshot(
      judgesQuery,
      (snapshot) => {
        const judgesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Judge[]
        setJudges(judgesData)
      },
      (judgeError) => {
        console.error("Error listening to judges:", judgeError)
      },
    )

    return () => {
      unsubscribeEvents()
      unsubscribeJudges()
    }
  }, [user])

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (signOutError) {
      console.error("Error signing out:", signOutError)
    }
  }

  const toggleEventActivation = async (eventId: string, currentActivation: boolean, eventTitle: string) => {
    const action = currentActivation ? "Stopping Event" : "Starting Event"
    setLoadingState({
      isLoading: true,
      action,
      eventId,
      eventTitle,
    })

    try {
      if (!currentActivation) {
        // If activating this event, first deactivate all other events
        const deactivatePromises = events
          .filter((e) => e.id !== eventId && e.adminActivated)
          .map((e) =>
            updateDoc(doc(db, "events", e.id), {
              adminActivated: false,
              showToJudges: false,
              startTime: null,
            }),
          )

        await Promise.all(deactivatePromises)

        // Then activate this event and make it visible to judges
        await updateDoc(doc(db, "events", eventId), {
          adminActivated: true,
          showToJudges: true,
          startTime: new Date(),
        })
      } else {
        // If deactivating, just deactivate and hide
        await updateDoc(doc(db, "events", eventId), {
          adminActivated: false,
          showToJudges: false,
          startTime: null,
        })
      }

      // Add a small delay to show the loading state
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (toggleError) {
      console.error("Error toggling event activation:", toggleError)
      setError("Failed to update event. Please try again.")
    } finally {
      setLoadingState({
        isLoading: false,
        action: "",
        eventId: "",
        eventTitle: "",
      })
    }
  }

  const deleteEvent = async (eventId: string, eventTitle: string) => {
    if (confirm(`Are you sure you want to delete "${eventTitle}"?`)) {
      setLoadingState({
        isLoading: true,
        action: "Deleting Event",
        eventId,
        eventTitle,
      })

      try {
        await deleteDoc(doc(db, "events", eventId))
        // Also delete criteria if exists
        try {
          await deleteDoc(doc(db, "eventCriteria", eventId))
        } catch {
          // Criteria might not exist, ignore error
        }

        // Add a small delay to show the loading state
        await new Promise((resolve) => setTimeout(resolve, 800))
      } catch (deleteError) {
        console.error("Error deleting event:", deleteError)
        setError("Failed to delete event. Please try again.")
      } finally {
        setLoadingState({
          isLoading: false,
          action: "",
          eventId: "",
          eventTitle: "",
        })
      }
    }
  }

  const refreshEventCriteria = async () => {
    // Refresh criteria status for all events
    const criteriaStatus: Record<string, boolean> = {}
    for (const event of events) {
      try {
        const criteriaDoc = await getDoc(doc(db, "eventCriteria", event.id))
        criteriaStatus[event.id] = criteriaDoc.exists()
      } catch {
        criteriaStatus[event.id] = false
      }
    }
    setEventCriteria(criteriaStatus)
  }

  const activeEvents = events.filter((e) => e.adminActivated && e.showToJudges)
  const activeJudges = judges.filter((j) => j.status === "active")

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Loading Dialog */}
      <Dialog open={loadingState.isLoading} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-red-600" />
              {loadingState.action}
            </DialogTitle>
            <DialogDescription>
              {loadingState.action === "Starting Event" && (
                <>
                  Starting <strong>{loadingState.eventTitle}</strong> and making it visible to judges...
                </>
              )}
              {loadingState.action === "Stopping Event" && (
                <>
                  Stopping <strong>{loadingState.eventTitle}</strong> and hiding it from judges...
                </>
              )}
              {loadingState.action === "Deleting Event" && (
                <>
                  Deleting <strong>{loadingState.eventTitle}</strong> and all associated data...
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-6">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              <p className="text-sm text-gray-600">Please wait...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
              <Shield className="h-8 w-8 text-red-600" />
              KULTOURA Admin Dashboard
            </h1>
            <p className="text-gray-600 mt-1">Welcome back, {user?.email}</p>
          </div>
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50 flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-white p-1 rounded-lg border border-gray-200">
          {[
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "events", label: "Events", icon: Calendar },
            { id: "judges", label: "Judges", icon: Users },
            { id: "settings", label: "Settings", icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                activeTab === tab.id ? "bg-red-600 text-white" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-blue-800 flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Total Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-900">{events.length}</div>
                <p className="text-blue-700 text-sm">{activeEvents.length} active</p>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-green-800 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Active Judges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-900">{activeJudges.length}</div>
                <p className="text-green-700 text-sm">{judges.length} total</p>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-purple-800 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Live Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-900">{activeEvents.length}</div>
                <p className="text-purple-700 text-sm">Currently running</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === "events" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Event Management</h2>
              <EventCreationForm onEventCreated={() => {}} />
            </div>

            {/* Single Event Warning */}
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-yellow-700">
                <strong>Note:</strong> Only one event can be active at a time. Starting a new event will automatically
                stop any currently running event.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4">
              {events.map((event) => (
                <Card key={event.id} className="border-gray-200">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-gray-900 text-lg">{event.title}</CardTitle>
                        <CardDescription className="text-gray-600 mt-1">{event.description}</CardDescription>

                        {/* Event Details */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                          <div className="flex items-center gap-1 text-gray-600">
                            <Calendar className="h-3 w-3" />
                            <span>{event.category}</span>
                          </div>
                          {event.venue && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <MapPin className="h-3 w-3" />
                              <span>{event.venue}</span>
                            </div>
                          )}
                          {event.duration && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <Clock className="h-3 w-3" />
                              <span>{event.duration}</span>
                            </div>
                          )}
                          {event.maxParticipants && (
                            <div className="flex items-center gap-1 text-gray-600">
                              <UserCheck className="h-3 w-3" />
                              <span>Max: {event.maxParticipants}</span>
                            </div>
                          )}
                        </div>

                        {event.requirements && (
                          <div className="mt-2 text-sm">
                            <span className="font-medium text-gray-700">Requirements: </span>
                            <span className="text-gray-600">{event.requirements}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <Badge
                          className={event.adminActivated ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                        >
                          {event.adminActivated ? "Active" : "Draft"}
                        </Badge>
                        <Badge
                          className={event.showToJudges ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800"}
                        >
                          {event.showToJudges ? "Visible" : "Hidden"}
                        </Badge>
                        <Badge
                          className={
                            eventCriteria[event.id] ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }
                        >
                          {eventCriteria[event.id] ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Criteria Set
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              No Criteria
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant={event.adminActivated ? "destructive" : "default"}
                        onClick={() => toggleEventActivation(event.id, event.adminActivated, event.title)}
                        disabled={loadingState.isLoading}
                        className={`flex items-center gap-1 ${
                          event.adminActivated
                            ? "bg-red-600 hover:bg-red-700 text-white"
                            : "bg-green-600 hover:bg-green-700 text-white"
                        }`}
                      >
                        {loadingState.isLoading && loadingState.eventId === event.id ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {event.adminActivated ? "Stopping..." : "Starting..."}
                          </>
                        ) : (
                          <>
                            {event.adminActivated ? (
                              <>
                                <Pause className="h-3 w-3" />
                                Stop Event
                              </>
                            ) : (
                              <>
                                <Play className="h-3 w-3" />
                                Start Event
                              </>
                            )}
                          </>
                        )}
                      </Button>

                      <EventCriteriaForm
                        eventId={event.id}
                        eventTitle={event.title}
                        onCriteriaSaved={refreshEventCriteria}
                      />

                      <SpecialAwardsManagement eventId={event.id} eventTitle={event.title} onAwardsUpdated={() => {}} />

                      <ParticipantManagement event={event} onEventUpdated={() => {}} />

                      <EventResultsDialog eventId={event.id} eventTitle={event.title} />

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteEvent(event.id, event.title)}
                        disabled={loadingState.isLoading}
                        className="flex items-center gap-1"
                      >
                        {loadingState.isLoading &&
                        loadingState.eventId === event.id &&
                        loadingState.action === "Deleting Event" ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {events.length === 0 && (
                <Card className="border-gray-200">
                  <CardContent className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No events created yet</p>
                    <EventCreationForm onEventCreated={() => {}} />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Judges Tab */}
        {activeTab === "judges" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Judge Management</h2>

            <div className="grid gap-4">
              {judges.map((judge) => (
                <Card key={judge.id} className="border-gray-200">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-gray-900">{judge.fullName || judge.email}</h3>
                        <p className="text-gray-600 text-sm">{judge.email}</p>
                      </div>
                      <Badge
                        className={
                          judge.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }
                      >
                        {judge.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {judges.length === 0 && (
                <Card className="border-gray-200">
                  <CardContent className="text-center py-8">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No judges registered yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>

            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle>Admin Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-700">Email:</span>
                  <span className="font-medium text-gray-900">{user?.email}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-700">Admin ID:</span>
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
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

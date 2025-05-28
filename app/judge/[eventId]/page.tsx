"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import JudgingInterface from "@/components/judging/judging-interface"
import KultouraLoading from "@/components/kultoura-loading"
import type { Event, Criteria } from "@/types"

export default function JudgingPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<Event | null>(null)
  const [criteria, setCriteria] = useState<Criteria | null>(null)
  const [error, setError] = useState("")

  const loadJudgingData = useCallback(async () => {
    try {
      const eventId = params.eventId as string

      // Load event data
      const eventDoc = await getDoc(doc(db, "events", eventId))
      if (!eventDoc.exists()) {
        setError("Event not found")
        setLoading(false)
        return
      }

      // Properly type the event data
      const eventData = { id: eventDoc.id, ...eventDoc.data() } as Event

      // Check if event is active and visible to judges
      if (!eventData.adminActivated || !eventData.showToJudges) {
        setError("This event is not currently active for judging")
        setLoading(false)
        return
      }

      setEvent(eventData)

      // Load criteria
      const criteriaDoc = await getDoc(doc(db, "eventCriteria", eventId))
      if (criteriaDoc.exists()) {
        setCriteria(criteriaDoc.data() as Criteria)
      }

      setLoading(false)
    } catch (error) {
      console.error("Error loading judging data:", error)
      setError("Failed to load judging data")
      setLoading(false)
    }
  }, [params.eventId])

  useEffect(() => {
    if (!user || !params.eventId) {
      router.push("/")
      return
    }

    loadJudgingData()
  }, [user, params.eventId, router, loadJudgingData])

  if (loading) {
    return <KultouraLoading />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return <JudgingInterface event={event} criteria={criteria} />
}

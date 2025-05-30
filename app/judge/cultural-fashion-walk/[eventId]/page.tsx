"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Slider } from "@/components/ui/slider"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  ArrowLeft,
  Users,
  Star,
  CheckCircle,
  AlertCircle,
  Loader2,
  Edit,
  Save,
  Award,
  Sparkles,
  Crown,
  Trophy,
} from "lucide-react"
import KultouraLoading from "@/components/kultoura-loading"
import type { Event, Criteria, Participant, Criterion, SpecialAward, ParticipantScore } from "@/types"

export default function CulturalFashionWalkJudging() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<Event | null>(null)
  const [criteria, setCriteria] = useState<Criteria | null>(null)
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null)
  const [scores, setScores] = useState<Record<string, ParticipantScore>>({})
  const [loadingScores, setLoadingScores] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [error, setError] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [specialAwardCriteria, setSpecialAwardCriteria] = useState<Criterion[]>([])
  const [allParticipantScores, setAllParticipantScores] = useState<Record<string, boolean>>({})

  // Draft score management functions
  const saveDraftScore = async (participantId: string, criterionId: string, score: number) => {
    if (!event || !user) return

    try {
      const draftKey = `draft_${event.id}_${user.uid}_${participantId}`
      const currentDrafts = JSON.parse(localStorage.getItem(draftKey) || "{}")

      currentDrafts[criterionId] = score
      localStorage.setItem(draftKey, JSON.stringify(currentDrafts))
    } catch (error) {
      console.error("Error saving draft score:", error)
    }
  }

  const loadDraftScores = (participantId: string): Record<string, number> => {
    if (!event || !user) return {}

    try {
      const draftKey = `draft_${event.id}_${user.uid}_${participantId}`
      return JSON.parse(localStorage.getItem(draftKey) || "{}")
    } catch (error) {
      console.error("Error loading draft scores:", error)
      return {}
    }
  }

  const clearDraftScores = (participantId: string) => {
    if (!event || !user) return

    try {
      const draftKey = `draft_${event.id}_${user.uid}_${participantId}`
      localStorage.removeItem(draftKey)
    } catch (error) {
      console.error("Error clearing draft scores:", error)
    }
  }

  const hasDraftScores = (participantId: string): boolean => {
    if (!event || !user) return false

    try {
      const draftKey = `draft_${event.id}_${user.uid}_${participantId}`
      const drafts = JSON.parse(localStorage.getItem(draftKey) || "{}")
      return Object.keys(drafts).length > 0
    } catch {
      return false
    }
  }

  // Load participant scores submitted by the current judge
  const loadAllParticipantScores = useCallback(
    async (eventId: string) => {
      if (!user) return

      try {
        const scoresQuery = query(
          collection(db, "judgingScores"),
          where("eventId", "==", eventId),
          where("judgeId", "==", user.uid),
        )

        const scoresSnapshot = await getDocs(scoresQuery)
        const scoredParticipants: Record<string, boolean> = {}

        scoresSnapshot.docs.forEach((doc) => {
          const scoreData = doc.data()
          scoredParticipants[scoreData.participantId] = true
        })

        setAllParticipantScores(scoredParticipants)
      } catch (error) {
        console.error("[Judging] Error loading participant scores:", error)
      }
    },
    [user], // ← dependencies go here
  )

  // Load event data including participants and criteria
  const loadEventData = useCallback(async () => {
    try {
      const eventId = params.eventId as string

      // Load event data
      const eventDoc = await getDoc(doc(db, "events", eventId))
      if (!eventDoc.exists()) {
        setError("Event not found")
        setLoading(false)
        return
      }

      const eventData = { id: eventDoc.id, ...eventDoc.data() } as Event

      // Verify this is a Cultural Fashion Walk event
      const isCulturalFashionWalk =
        eventData.judgingMode === "free-roam" ||
        eventData.title?.toLowerCase().includes("cultural fashion walk") ||
        eventData.category?.toLowerCase().includes("cultural fashion walk")

      if (!isCulturalFashionWalk) {
        setError("This page is only for Cultural Fashion Walk events")
        setLoading(false)
        return
      }

      // Check if event is active and visible to judges
      if (!eventData.adminActivated || !eventData.showToJudges) {
        setError("This event is not currently active for judging")
        setLoading(false)
        return
      }

      // Fetch participants, either from eventData.participants or Firestore subcollection
      let participants: Participant[] = []
      if (eventData.participants && eventData.participants.length > 0) {
        participants = eventData.participants
      } else {
        const participantsQuery = query(collection(db, "events", eventId, "participants"))
        const participantsSnapshot = await getDocs(participantsQuery)
        participants = participantsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Participant[]
      }

      setEvent({ ...eventData, participants })

      // Load criteria
      const criteriaDoc = await getDoc(doc(db, "eventCriteria", eventId))
      if (criteriaDoc.exists()) {
        setCriteria(criteriaDoc.data() as Criteria)
      }

      // Load all participant scores for this judge
      await loadAllParticipantScores(eventId)

      setLoading(false)
    } catch (error) {
      console.error("[Judging] Error loading event data:", error)
      setError("Failed to load event data")
      setLoading(false)
    }
  }, [params.eventId, loadAllParticipantScores])

  // Load scores (existing or draft) for selected participant
  const loadExistingScores = async (participant: Participant) => {
    if (!participant || !criteria || !user || !event) return

    setLoadingScores(true)
    try {
      // Load special awards criteria
      const specialAwardsDoc = await getDoc(doc(db, "specialAwards", event.id))
      let additionalCriteria: Criterion[] = []

      if (specialAwardsDoc.exists()) {
        const specialAwards = specialAwardsDoc.data().awards || []
        additionalCriteria = specialAwards
          .filter((award: SpecialAward) => award.type === "new")
          .map((award: SpecialAward) => ({
            id: `special_${award.id}`,
            name: award.criterionName || "",
            description: award.criterionDescription || "",
            percentage: 0,
            maxScore: award.maxScore,
            isSpecialAward: true,
            specialAwardId: award.id,
            awardName: award.name,
          }))
      }

      setSpecialAwardCriteria(additionalCriteria)

      // Combine regular criteria with special award criteria
      const allCriteria = [...(criteria?.criteria || [])] // only main criteria

      // Query for existing scores
      const scoresQuery = query(
        collection(db, "judgingScores"),
        where("eventId", "==", event.id),
        where("judgeId", "==", user.uid),
        where("participantId", "==", participant.id),
      )

      const scoresSnapshot = await getDocs(scoresQuery)

      if (!scoresSnapshot.empty) {
        const existingScore = scoresSnapshot.docs[0]
        const scoreData = existingScore.data()

        setScores((prev) => ({
          ...prev,
          [participant.id]: {
            participantId: participant.id,
            participantName: participant.name,
            scores: scoreData.scores || {},
            feedback: scoreData.feedback || "",
            totalScore: scoreData.totalScore || 0,
            submitted: true,
            scoreDocId: existingScore.id,
            submittedAt: scoreData.submittedAt,
          },
        }))
      } else {
        // Initialize new scores
        const participantScores: Record<string, number> = {}
        allCriteria.forEach((criterion) => {
          participantScores[criterion.id] = 0
        })

        // Load draft scores if they exist
        const draftScores = loadDraftScores(participant.id)
        Object.keys(draftScores).forEach((criterionId) => {
          if (allCriteria.find((c) => c.id === criterionId)) {
            participantScores[criterionId] = draftScores[criterionId]
          }
        })

        // Calculate total score from draft
        let totalScore = 0
        for (const criterionId in participantScores) {
          const criterion = criteria?.criteria.find((c) => c.id === criterionId)
          if (criterion) {
            totalScore += (participantScores[criterionId] * criterion.percentage) / 100
          }
        }

        setScores((prev) => ({
          ...prev,
          [participant.id]: {
            participantId: participant.id,
            participantName: participant.name,
            scores: participantScores,
            feedback: "",
            totalScore: totalScore,
            submitted: false,
          },
        }))
      }
    } catch (error) {
      console.error("Error loading existing scores:", error)
      setError("Failed to load existing scores")
    } finally {
      setLoadingScores(false)
    }
  }

  const updateScore = (participantId: string, criterionId: string, score: number) => {
    setScores((prev) => {
      const updated = { ...prev }
      if (!updated[participantId]) return prev

      updated[participantId] = {
        ...updated[participantId],
        scores: {
          ...updated[participantId].scores,
          [criterionId]: score,
        },
      }

      // Calculate total score
      let totalScore = 0
      for (const criterionId in updated[participantId].scores) {
        const criterion = criteria?.criteria.find((c) => c.id === criterionId)
        if (criterion) {
          totalScore += (updated[participantId].scores[criterionId] * criterion.percentage) / 100
        }
      }
      updated[participantId].totalScore = totalScore

      return updated
    })

    // Save draft score automatically
    saveDraftScore(participantId, criterionId, score)
  }

  const submitScore = async () => {
    if (!event || !selectedParticipant) return false

    setSubmitting(true)
    try {
      const participantScore = scores[selectedParticipant.id]
      if (!participantScore) return false

      const scoreData = {
        eventId: event.id,
        judgeId: user?.uid,
        judgeEmail: user?.email,
        participantId: participantScore.participantId,
        participantName: participantScore.participantName,
        scores: participantScore.scores,
        totalScore: participantScore.totalScore,
        eventTitle: event.title,
        updatedAt: new Date(),
      }

      if (participantScore.scoreDocId) {
        await updateDoc(doc(db, "judgingScores", participantScore.scoreDocId), scoreData)
      } else {
        const docRef = await addDoc(collection(db, "judgingScores"), {
          ...scoreData,
          submittedAt: new Date(),
        })

        setScores((prev) => ({
          ...prev,
          [selectedParticipant.id]: {
            ...prev[selectedParticipant.id],
            scoreDocId: docRef.id,
          },
        }))
      }

      setScores((prev) => ({
        ...prev,
        [selectedParticipant.id]: {
          ...prev[selectedParticipant.id],
          submitted: true,
        },
      }))

      clearDraftScores(selectedParticipant.id)

      setAllParticipantScores((prev) => ({
        ...prev,
        [selectedParticipant.id]: true,
      }))

      setIsEditing(false)
      setShowSubmitDialog(true)
      return true
    } catch (error) {
      console.error("Error submitting score:", error)
      setError("Failed to submit score. Please try again.")
      return false
    } finally {
      setSubmitting(false)
    }
  }

  const enableEditing = () => {
    if (!selectedParticipant) return

    setIsEditing(true)
    setScores((prev) => ({
      ...prev,
      [selectedParticipant.id]: {
        ...prev[selectedParticipant.id],
        submitted: false,
      },
    }))
  }

  const selectParticipant = (participant: Participant) => {
    setSelectedParticipant(participant)
    loadExistingScores(participant)
  }

  const returnToParticipantSelection = () => {
    setSelectedParticipant(null)
    setIsEditing(false)
  }

  useEffect(() => {
    if (!user || !params.eventId) {
      router.push("/")
      return
    }

    loadEventData()
  }, [user, params.eventId, router, loadEventData])

  if (loading) {
    return <KultouraLoading />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-stone-50 to-amber-50 flex items-center justify-center">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-stone-200">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-stone-600 mb-6">{error}</p>
          <Button
            onClick={() => router.push("/")}
            className="bg-amber-800 hover:bg-amber-900 text-white px-6 py-3 rounded-xl"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (!criteria || !criteria.criteria.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-stone-50 to-amber-50 flex items-center justify-center">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-stone-200">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-600 mb-4">No Judging Criteria</h1>
          <p className="text-stone-600 mb-6">This event does not have judging criteria set up.</p>
          <Button onClick={() => router.push("/")} variant="outline" className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  // Helper to extract number after "#" in participant name
  function getParticipantNumber(name: string): number | null {
    const match = name.match(/#(\d+)/)
    return match ? Number.parseInt(match[1], 10) : null
  }

  // Participant groups
  const participants = event?.participants || []
  const msParticipants = participants.filter((p) => p.name.trim().toUpperCase().includes("MS."))
  const mrParticipants = participants.filter((p) => p.name.trim().toUpperCase().includes("MR."))

  msParticipants.sort((a, b) => {
    const numA = getParticipantNumber(a.name)
    const numB = getParticipantNumber(b.name)

    if (numA === null && numB === null) return a.name.localeCompare(b.name)
    if (numA === null) return 1
    if (numB === null) return -1

    return numA - numB
  })

  mrParticipants.sort((a, b) => {
    const numA = getParticipantNumber(a.name)
    const numB = getParticipantNumber(b.name)

    if (numA === null && numB === null) return a.name.localeCompare(b.name)
    if (numA === null) return 1
    if (numB === null) return -1

    return numA - numB
  })

  // Participant selection screen
  if (!selectedParticipant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-stone-50 to-amber-50">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-32 h-32 border border-amber-300 rounded-full"></div>
          <div className="absolute top-40 right-32 w-24 h-24 border border-stone-300 rounded-full"></div>
          <div className="absolute bottom-32 left-1/3 w-20 h-20 border border-amber-300 rounded-full"></div>
          <div className="absolute bottom-20 right-20 w-28 h-28 border border-stone-300 rounded-full"></div>
        </div>

        <div className="relative max-w-7xl mx-auto p-6 space-y-8">
          {/* Success Dialog */}
          <Dialog open={showSubmitDialog} onOpenChange={() => {}}>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  Score Submitted Successfully!
                </DialogTitle>
                <DialogDescription>
                  Your score has been submitted. You can continue scoring other participants or return to the dashboard.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center gap-3 pt-4">
                <Button onClick={() => setShowSubmitDialog(false)} variant="outline" className="rounded-xl">
                  Score Another Participant
                </Button>
                <Button onClick={() => router.push("/")} className="bg-green-600 hover:bg-green-700 rounded-xl">
                  Return to Dashboard
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Enhanced Header */}
          <div className="bg-white/80 backdrop-blur-sm border border-stone-200 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <Button
                onClick={() => router.push("/")}
                variant="ghost"
                className="text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl">
                <Sparkles className="h-10 w-10 text-amber-800" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-stone-900">{event?.title}</h1>
                <p className="text-amber-800 font-medium">Cultural Fashion Walk - Free Selection Judging</p>
              </div>
            </div>
          </div>

          {error && (
            <Alert className="border-red-200 bg-red-50/80 backdrop-blur-sm rounded-xl">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* MS Participants */}
            <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-pink-100 to-rose-100 border-b border-pink-200">
                <CardTitle className="flex items-center mt-6 text-pink-800">
                  <div className="p-2 bg-pink-200 rounded-lg">
                    <Crown className="h-6 w-6 text-pink-700" />
                  </div>
                  MS. Participants
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {msParticipants.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-pink-300 mx-auto mb-3" />
                    <p className="text-pink-600">No MS. participants available</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {msParticipants.map((p) => (
                      <div
                        key={p.id}
                        className={`cursor-pointer border rounded-xl p-4 transition-all duration-200 hover:shadow-md ${
                          allParticipantScores[p.id]
                            ? "bg-green-50 border-green-200 hover:bg-green-100"
                            : hasDraftScores(p.id)
                              ? "bg-amber-50 border-amber-200 hover:bg-amber-100"
                              : "bg-pink-50 border-pink-200 hover:bg-pink-100"
                        }`}
                        onClick={() => selectParticipant(p)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-pink-100 rounded-lg">
                              <Crown className="h-4 w-4 text-pink-700" />
                            </div>
                            <span className="font-semibold text-stone-900">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {allParticipantScores[p.id] ? (
                              <Badge className="bg-green-100 text-green-800 border-green-300 rounded-full">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Scored
                              </Badge>
                            ) : hasDraftScores(p.id) ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 rounded-full">
                                <Edit className="h-3 w-3 mr-1" />
                                Draft
                              </Badge>
                            ) : (
                              <Badge className="bg-pink-100 text-pink-800 border-pink-300 rounded-full">
                                <Star className="h-3 w-3 mr-1" />
                                Ready
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* MR Participants */}
            <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-100 to-indigo-100 border-b border-blue-200">
                <CardTitle className="flex items-center gap-3 mt-6 text-blue-800">
                  <div className="p-2 bg-blue-200 rounded-lg">
                    <Trophy className="h-6 w-6 text-blue-700" />
                  </div>
                  MR. Participants
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {mrParticipants.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-blue-300 mx-auto mb-3" />
                    <p className="text-blue-600">No MR. participants available</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mrParticipants.map((p) => (
                      <div
                        key={p.id}
                        className={`cursor-pointer border rounded-xl p-4 transition-all duration-200 hover:shadow-md ${
                          allParticipantScores[p.id]
                            ? "bg-green-50 border-green-200 hover:bg-green-100"
                            : hasDraftScores(p.id)
                              ? "bg-amber-50 border-amber-200 hover:bg-amber-100"
                              : "bg-blue-50 border-blue-200 hover:bg-blue-100"
                        }`}
                        onClick={() => selectParticipant(p)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Trophy className="h-4 w-4 text-blue-700" />
                            </div>
                            <span className="font-semibold text-stone-900">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {allParticipantScores[p.id] ? (
                              <Badge className="bg-green-100 text-green-800 border-green-300 rounded-full">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Scored
                              </Badge>
                            ) : hasDraftScores(p.id) ? (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 rounded-full">
                                <Edit className="h-3 w-3 mr-1" />
                                Draft
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-100 text-blue-800 border-blue-300 rounded-full">
                                <Star className="h-3 w-3 mr-1" />
                                Ready
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  // Scoring interface for selected participant
  const currentScore = scores[selectedParticipant.id]
  const canSubmit = currentScore && Object.values(currentScore.scores).every((s) => s > 0) && !currentScore.submitted
  const hasExistingScore = Boolean(currentScore?.scoreDocId && currentScore?.submitted && !isEditing)

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
          <Button
            onClick={returnToParticipantSelection}
            variant="ghost"
            className="mb-4 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Participant Selection
          </Button>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl">
              <Sparkles className="h-8 w-8 text-amber-800" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Cultural Fashion Walk</h1>
              <p className="text-stone-600">
                Currently scoring: <span className="font-semibold text-amber-800">{selectedParticipant.name}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-200 bg-red-50/80 backdrop-blur-sm rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading Scores Alert */}
        {loadingScores && (
          <Alert className="border-blue-200 bg-blue-50/80 backdrop-blur-sm rounded-xl">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription className="text-blue-700">Loading your previous scores...</AlertDescription>
          </Alert>
        )}

        {/* Selected Participant Card */}
        <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Users className="h-6 w-6 text-amber-700" />
                </div>
                Selected Participant
              </div>
              <div className="flex items-center gap-2">
                {hasExistingScore && (
                  <Button onClick={enableEditing} size="sm" variant="outline" className="rounded-xl">
                    <Edit className="h-3 w-3 mr-1" />
                    Edit Score
                  </Button>
                )}
                {currentScore?.submitted && !isEditing && (
                  <Badge className="bg-green-100 text-green-800 border-green-300 rounded-full">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Submitted
                  </Badge>
                )}
                {isEditing && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 rounded-full">
                    <Edit className="h-3 w-3 mr-1" />
                    Editing
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-stone-900">{selectedParticipant.name}</h3>
                <p className="text-stone-600">You can score this participant at any time</p>
                {hasExistingScore && currentScore?.submittedAt && (
                  <p className="text-stone-500 text-sm mt-1">
                    Previously scored on: {currentScore.submittedAt.toDate?.()?.toLocaleString() || "Unknown"}
                  </p>
                )}
              </div>
              <Badge className="bg-amber-800 text-white text-lg px-4 py-2 rounded-full">SELECTED</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Scoring Interface */}
        {currentScore && (
          <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Star className="h-6 w-6 text-amber-700" />
                </div>
                Scoring: {selectedParticipant.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 pb-24">
              {/* Regular Scoring Criteria */}
              <div className="space-y-6">
                <h3 className="font-semibold text-stone-900 text-lg">Main Judging Criteria</h3>
                {criteria.criteria
                  .filter((criterion) => !specialAwardCriteria.some((special) => special.id === criterion.id))
                  .map((criterion) => (
                    <div key={criterion.id} className="border border-stone-200 rounded-xl p-6 bg-stone-50/50">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-stone-900 text-lg">{criterion.name}</h4>
                          <p className="text-stone-600 mt-1">{criterion.description}</p>
                          <div className="text-sm text-amber-700 mt-2 font-medium">Weight: {criterion.percentage}%</div>
                        </div>
                        <div className="text-right ml-6">
                          <div className="text-3xl font-bold text-amber-800">
                            {currentScore.scores[criterion.id] || 0}%
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Slider
                          value={[currentScore.scores[criterion.id] || 0]}
                          onValueChange={(value) => updateScore(selectedParticipant.id, criterion.id, value[0])}
                          max={100}
                          min={0}
                          step={0.5}
                          className="w-full"
                          disabled={Boolean(hasExistingScore)}
                        />
                        <div className="flex justify-between text-sm text-stone-500">
                          <span>0%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Special Award Criteria */}
              {specialAwardCriteria.length > 0 && (
                <div className="space-y-6 mt-8">
                  <div className="border-t border-stone-200 pt-8">
                    <h3 className="font-semibold text-stone-900 text-lg flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Award className="h-6 w-6 text-purple-700" />
                      </div>
                      Special Award Criteria
                    </h3>
                    <p className="text-stone-600 mt-2">
                      These scores are used for special awards and sashes - they do not count toward the main score
                    </p>
                  </div>

                  {specialAwardCriteria.map((criterion) => (
                    <div key={criterion.id} className="border border-purple-200 rounded-xl p-6 bg-purple-50/50">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-stone-900 text-lg">{criterion.name}</h4>
                          <p className="text-stone-600 mt-1">{criterion.description}</p>
                          <div className="text-sm text-purple-700 mt-2 flex items-center gap-2 font-medium">
                            <Award className="h-4 w-4" />
                            Special Award: {criterion.awardName} (Sash)
                          </div>
                        </div>
                        <div className="text-right ml-6">
                          <div className="text-3xl font-bold text-purple-800">
                            {currentScore.scores[criterion.id] || 0}%
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Slider
                          value={[currentScore.scores[criterion.id] || 0]}
                          onValueChange={(value) => updateScore(selectedParticipant.id, criterion.id, value[0])}
                          max={100}
                          min={0}
                          step={0.5}
                          className="w-full"
                          disabled={Boolean(hasExistingScore)}
                        />
                        <div className="flex justify-between text-sm text-purple-600">
                          <span>0%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-6 border-t border-stone-200">
                {hasExistingScore ? (
                  <div className="text-center space-y-4">
                    <p className="text-stone-600">
                      You have already scored this participant. Click &quot;Edit Score&quot; above to make changes.
                    </p>
                    <div className="flex justify-center gap-3">
                      <Button onClick={returnToParticipantSelection} variant="outline" size="lg" className="rounded-xl">
                        Score Another Participant
                      </Button>
                      <Button onClick={() => router.push("/")} variant="outline" size="lg" className="rounded-xl">
                        Return to Dashboard
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button
                      onClick={submitScore}
                      disabled={!canSubmit || submitting}
                      className="w-full bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 hover:from-amber-800 hover:via-amber-900 hover:to-amber-950 text-white font-semibold py-4 px-8 rounded-xl shadow-lg transform hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
                      size="lg"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          {currentScore.scoreDocId ? "Updating Score..." : "Submitting Score..."}
                        </>
                      ) : (
                        <>
                          <Save className="h-5 w-5 mr-2" />
                          {currentScore.scoreDocId
                            ? `Update Score for ${selectedParticipant.name}`
                            : `Submit Score for ${selectedParticipant.name}`}
                        </>
                      )}
                    </Button>
                    {!canSubmit && (
                      <p className="text-red-600 text-sm mt-3 text-center">
                        Please score all criteria before submitting.
                      </p>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Floating Total Score */}
      {currentScore && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-white/90 backdrop-blur-sm border border-stone-200 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between min-w-[320px]">
              <span className="font-semibold text-stone-900 text-lg">Total Score:</span>
              <span className="text-4xl font-bold text-amber-800">{currentScore.totalScore.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { collection, addDoc, doc, onSnapshot, query, where, getDocs, updateDoc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Slider } from "@/components/ui/slider"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  ArrowLeft,
  Gavel,
  Star,
  CheckCircle,
  AlertCircle,
  Loader2,
  Play,
  Clock,
  Edit,
  Save,
  Award,
  Users,
} from "lucide-react"
import type { Event, Criteria, Participant, ParticipantScore, Criterion, SpecialAward } from "@/types"

interface JudgingInterfaceProps {
  event: Event | null
  criteria: Criteria | null
}

export default function JudgingInterface({ event: initialEvent, criteria }: JudgingInterfaceProps) {
  const router = useRouter()
  const { user } = useAuth()
  const [event, setEvent] = useState<Event | null>(initialEvent)
  const [currentPerformer, setCurrentPerformer] = useState<Participant | null>(null)
  const [scores, setScores] = useState<Record<string, ParticipantScore>>({})
  const [loading, setLoading] = useState(true)
  const [loadingScores, setLoadingScores] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [error, setError] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [specialAwardCriteria, setSpecialAwardCriteria] = useState<Criterion[]>([])

  // Listen for real-time updates to the event
  useEffect(() => {
    if (!initialEvent) return

    const unsubscribe = onSnapshot(
      doc(db, "events", initialEvent.id),
      (doc) => {
        if (doc.exists()) {
          const updatedEvent = { id: doc.id, ...doc.data() } as Event
          setEvent(updatedEvent)

          // Find current performer
          const performer = updatedEvent.participants?.find((p) => p.id === updatedEvent.currentPerformer)
          setCurrentPerformer(performer || null)
        }
      },
      (error) => {
        console.error("Error listening to event updates:", error)
      },
    )

    return () => unsubscribe()
  }, [initialEvent])

  const initializeNewScoring = useCallback(() => {
    if (!currentPerformer || !criteria) return

    const participantScores: Record<string, number> = {}
    criteria.criteria.forEach((criterion) => {
      participantScores[criterion.id] = 0
    })

    setScores((prev) => ({
      ...prev,
      [currentPerformer.id]: {
        participantId: currentPerformer.id,
        participantName: currentPerformer.name,
        scores: participantScores,
        feedback: "",
        totalScore: 0,
        submitted: false,
      },
    }))
  }, [currentPerformer, criteria])

  const loadExistingScores = useCallback(async () => {
    if (!currentPerformer || !criteria || !user || !event) return

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
            percentage: 0, // Special awards don't count toward main score
            maxScore: award.maxScore,
            isSpecialAward: true,
            specialAwardId: award.id,
            awardName: award.name,
          }))
      }

      // Combine regular criteria with special award criteria
      const allCriteria = [...(criteria?.criteria || []), ...additionalCriteria]

      // Query for existing scores by this judge for this participant in this event
      const scoresQuery = query(
        collection(db, "judgingScores"),
        where("eventId", "==", event.id),
        where("judgeId", "==", user.uid),
        where("participantId", "==", currentPerformer.id),
      )

      const scoresSnapshot = await getDocs(scoresQuery)

      if (!scoresSnapshot.empty) {
        // Load existing scores
        const existingScore = scoresSnapshot.docs[0]
        const scoreData = existingScore.data()

        setScores((prev) => ({
          ...prev,
          [currentPerformer.id]: {
            participantId: currentPerformer.id,
            participantName: currentPerformer.name,
            scores: scoreData.scores || {},
            feedback: scoreData.feedback || "",
            totalScore: scoreData.totalScore || 0,
            submitted: true,
            scoreDocId: existingScore.id,
            submittedAt: scoreData.submittedAt,
          },
        }))
      } else {
        // Initialize new scores including special awards
        const participantScores: Record<string, number> = {}
        allCriteria.forEach((criterion) => {
          participantScores[criterion.id] = 0
        })

        setScores((prev) => ({
          ...prev,
          [currentPerformer.id]: {
            participantId: currentPerformer.id,
            participantName: currentPerformer.name,
            scores: participantScores,
            feedback: "",
            totalScore: 0,
            submitted: false,
          },
        }))
      }
    } catch (error) {
      console.error("Error loading existing scores:", error)
      setError("Failed to load existing scores")
      // Fallback to initialize new scoring
      initializeNewScoring()
    } finally {
      setLoadingScores(false)
    }
  }, [currentPerformer, criteria, user, event, initializeNewScoring])

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
  }

  const submitScore = async () => {
    if (!event || !currentPerformer) return false

    setSubmitting(true)
    try {
      const participantScore = scores[currentPerformer.id]
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
        // Update existing score
        await updateDoc(doc(db, "judgingScores", participantScore.scoreDocId), scoreData)
      } else {
        // Create new score
        const docRef = await addDoc(collection(db, "judgingScores"), {
          ...scoreData,
          submittedAt: new Date(),
        })

        // Update local state with document ID
        setScores((prev) => ({
          ...prev,
          [currentPerformer.id]: {
            ...prev[currentPerformer.id],
            scoreDocId: docRef.id,
          },
        }))
      }

      setScores((prev) => ({
        ...prev,
        [currentPerformer.id]: {
          ...prev[currentPerformer.id],
          submitted: true,
        },
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
    setIsEditing(true)
    setScores((prev) => ({
      ...prev,
      [currentPerformer!.id]: {
        ...prev[currentPerformer!.id],
        submitted: false,
      },
    }))
  }

  const currentScore = currentPerformer ? scores[currentPerformer.id] : null
  const canSubmit = currentScore && Object.values(currentScore.scores).every((s) => s > 0) && !currentScore.submitted
  const hasExistingScore = Boolean(currentScore?.scoreDocId && currentScore?.submitted && !isEditing)

  const loadSpecialAwardCriteria = useCallback(async () => {
    if (!event) return

    try {
      const specialAwardsDoc = await getDoc(doc(db, "specialAwards", event.id))
      if (specialAwardsDoc.exists()) {
        const specialAwards = specialAwardsDoc.data().awards || []
        const newCriteria = specialAwards
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

        setSpecialAwardCriteria(newCriteria)
      }
    } catch (error) {
      console.error("Error loading special award criteria:", error)
    }
  }, [event])

  useEffect(() => {
    if (event && currentPerformer) {
      loadExistingScores()
      loadSpecialAwardCriteria()
    }
    setLoading(false)
  }, [event, currentPerformer, loadExistingScores, loadSpecialAwardCriteria])

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-stone-50 to-amber-50 flex items-center justify-center">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-stone-200">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-600 mb-4">Event Not Found</h1>
          <Button onClick={() => router.push("/")} variant="outline" className="rounded-xl">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
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
            <h3 className="text-lg font-semibold text-stone-900">Loading Judging Interface</h3>
            <p className="text-stone-600 text-sm">Preparing your scoring environment...</p>
          </div>
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

  if (!currentPerformer) {
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
              onClick={() => router.push("/")}
              variant="ghost"
              className="mb-4 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>

            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl">
                <Gavel className="h-8 w-8 text-amber-800" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-stone-900">Judging: {event.title}</h1>
                <p className="text-stone-600">Real-time event scoring</p>
              </div>
            </div>
          </div>

          {/* Waiting for Performer */}
          <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-amber-100 to-amber-200 border-b border-amber-200">
              <CardTitle className="flex items-center gap-3 text-amber-800">
                <div className="p-2 bg-amber-200 rounded-lg">
                  <Clock className="h-6 w-6 text-amber-700" />
                </div>
                Waiting for Performance
              </CardTitle>
              <CardDescription className="text-amber-800">
                No team is currently performing. Please wait for the admin to start a performance.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="text-center py-8">
                  <Clock className="h-16 w-16 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-stone-900 mb-2">No Active Performance</h3>
                  <p className="text-stone-600">
                    The admin will select which team is performing. You can only score the currently performing team.
                  </p>
                </div>

                {/* Show all participants and their status */}
                {event.participants && event.participants.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
                      <Users className="h-5 w-5 text-amber-700" />
                      Event Participants:
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {event.participants.map((participant) => (
                        <div
                          key={participant.id}
                          className="flex items-center gap-3 p-4 bg-stone-50 border border-stone-200 rounded-xl"
                        >
                          <div className="p-2 bg-stone-100 rounded-lg">
                            {participant.status === "performing" && <Play className="h-4 w-4 text-green-600" />}
                            {participant.status === "completed" && <CheckCircle className="h-4 w-4 text-blue-600" />}
                            {participant.status === "waiting" && <Clock className="h-4 w-4 text-amber-600" />}
                          </div>
                          <div className="flex-1">
                            <span className="font-medium text-stone-900">{participant.name}</span>
                            <div className="text-xs text-stone-500 capitalize">{participant.status || "waiting"}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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

      {/* Success Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Score {currentScore?.scoreDocId ? "Updated" : "Submitted"} Successfully!
            </DialogTitle>
            <DialogDescription>
              Your score for <strong>{currentPerformer.name}</strong> has been{" "}
              {currentScore?.scoreDocId ? "updated" : "submitted"} for <strong>{event.title}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-4">
            <Button onClick={() => router.push("/")} className="bg-green-600 hover:bg-green-700 rounded-xl">
              Return to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-5xl mx-auto p-6 space-y-8">
        {/* Enhanced Header */}
        <div className="bg-white/80 backdrop-blur-sm border border-stone-200 rounded-2xl p-6 shadow-lg">
          <Button
            onClick={() => router.push("/")}
            variant="ghost"
            className="mb-4 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl">
              <Gavel className="h-8 w-8 text-amber-800" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Judging: {event.title}</h1>
              <p className="text-stone-600">
                Currently scoring: <span className="font-semibold text-amber-800">{currentPerformer.name}</span>
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
          <Alert className="border-amber-200 bg-amber-50/80 backdrop-blur-sm rounded-xl">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription className="text-amber-700">Loading your previous scores...</AlertDescription>
          </Alert>
        )}

        {/* Current Performer Card */}
        <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-green-100 to-emerald-100 border-b border-green-200">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-green-800 mt-6">
                <div className="p-2 bg-green-200 rounded-lg">
                  <Play className="h-6 w-6 text-green-700" />
                </div>
                <span>Currently Performing</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-red-600 text-white text-sm px-3 py-1 rounded-full animate-pulse">🔴 LIVE</Badge>
                {hasExistingScore && (
                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 rounded-full">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Previously Scored
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-stone-900">{currentPerformer.name}</h3>
                <p className="text-stone-600">This team is currently performing and available for scoring</p>
                {hasExistingScore && currentScore?.submittedAt && (
                  <p className="text-stone-500 text-sm mt-1">
                    Previously scored on: {currentScore.submittedAt.toDate?.()?.toLocaleString() || "Unknown"}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scoring Interface */}
        {currentScore && (
          <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-xl rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Star className="h-6 w-6 text-amber-700" />
                  </div>
                  Scoring: {currentPerformer.name}
                </div>
                <div className="flex items-center gap-2">
                  {hasExistingScore && (
                    <Button onClick={enableEditing} size="sm" variant="outline" className="rounded-xl">
                      <Edit className="h-3 w-3 mr-1" />
                      Edit Score
                    </Button>
                  )}
                  {currentScore.submitted && !isEditing && (
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
            <CardContent className="space-y-8 pb-24">
              {/* Regular Scoring Criteria */}
              <div className="space-y-6">
                <h3 className="font-semibold text-stone-900 text-lg">Main Judging Criteria</h3>
                {criteria.criteria.map((criterion) => (
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
                        onValueChange={(value) => updateScore(currentPerformer.id, criterion.id, value[0])}
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
                      <div className="p-2 bg-amber-100 rounded-lg">
                        <Award className="h-6 w-6 text-amber-700" />
                      </div>
                      Special Award Criteria
                    </h3>
                    <p className="text-stone-600 mt-2">These scores are used for special awards only</p>
                  </div>

                  {specialAwardCriteria.map((criterion) => (
                    <div key={criterion.id} className="border border-amber-200 rounded-xl p-6 bg-amber-50/50">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-stone-900 text-lg flex items-center gap-2">
                            <Award className="h-5 w-5 text-amber-700" />
                            {criterion.name}
                          </h4>
                          <p className="text-stone-600 mt-1">{criterion.description}</p>
                          <div className="text-sm text-amber-700 mt-2 font-medium">
                            Special Award: {criterion.awardName}
                          </div>
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
                          onValueChange={(value) => updateScore(currentPerformer.id, criterion.id, value[0])}
                          max={100}
                          min={0}
                          step={0.5}
                          className="w-full"
                          disabled={Boolean(hasExistingScore)}
                        />
                        <div className="flex justify-between text-sm text-amber-600">
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
                      You have already scored this team. Click &quot;Edit Score&quot; above to make changes.
                    </p>
                    <Button onClick={() => router.push("/")} variant="outline" size="lg" className="rounded-xl">
                      Return to Dashboard
                    </Button>
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
                            ? `Update Score for ${currentPerformer.name}`
                            : `Submit Score for ${currentPerformer.name}`}
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

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  query,
  where,
  getDocs,
  updateDoc,
  getDoc,
  Timestamp,
} from "firebase/firestore"
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
} from "lucide-react"
import type { Event, Criteria, Participant, Criterion, SpecialAward } from "@/types"

interface ParticipantScore {
  participantId: string
  participantName: string
  scores: Record<string, number>
  feedback: string
  totalScore: number
  submitted: boolean
  scoreDocId?: string // For updating existing scores
  submittedAt?: Timestamp
}

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
  }, [currentPerformer, criteria, user, event])

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
      for (const critId in updated[participantId].scores) {
        const criterion = criteria?.criteria.find((c) => c.id === critId)
        if (criterion) {
          totalScore += (updated[participantId].scores[critId] * criterion.percentage) / 100
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

  // Run these when their dependencies change
  useEffect(() => {
    if (event && currentPerformer) {
      loadExistingScores()
      loadSpecialAwardCriteria()
    }
    setLoading(false)
  }, [event, currentPerformer, criteria, user, loadExistingScores, loadSpecialAwardCriteria])

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-600 mb-4">Event Not Found</h1>
          <Button onClick={() => router.push("/")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading judging interface...</p>
        </div>
      </div>
    )
  }

  if (!criteria || !criteria.criteria.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-600 mb-4">No Judging Criteria</h1>
          <p className="text-gray-600 mb-4">
            This event does not have judging criteria set up.
          </p>
          <Button onClick={() => router.push("/")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (!currentPerformer) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <Button onClick={() => router.push("/")} variant="outline" className="mb-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
                <Gavel className="h-8 w-8 text-gray-600" />
                Judging: {event.title}
              </h1>
            </div>
          </div>

          {/* Waiting for Performer */}
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800">
                <Clock className="h-5 w-5" />
                Waiting for Performance
              </CardTitle>
              <CardDescription className="text-yellow-700">
                No team is currently performing. Please wait for the admin to start a performance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-center py-8">
                  <Clock className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-yellow-800 mb-2">No Active Performance</h3>
                  <p className="text-yellow-700">
                    The admin will select which team is performing. You can only score the currently performing team.
                  </p>
                </div>

                {/* Show all participants and their status */}
                {event.participants && event.participants.length > 0 && (
                  <div>
                    <h4 className="font-medium text-yellow-800 mb-3">Event Participants:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {event.participants.map((participant) => (
                        <div
                          key={participant.id}
                          className="flex items-center gap-2 p-2 bg-white border border-yellow-200 rounded"
                        >
                          {participant.status === "performing" && <Play className="h-3 w-3 text-green-500" />}
                          {participant.status === "completed" && <CheckCircle className="h-3 w-3 text-blue-500" />}
                          {participant.status === "waiting" && <Clock className="h-3 w-3 text-yellow-500" />}
                          <span className="text-sm font-medium">{participant.name}</span>
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
    <div className="min-h-screen bg-gray-50">
      {/* Success Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
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
            <Button onClick={() => router.push("/")} className="bg-green-600 hover:bg-green-700">
              Return to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Button onClick={() => router.push("/")} variant="outline" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
              <Gavel className="h-8 w-8 text-gray-600" />
              Judging: {event.title}
            </h1>
            <p className="text-gray-600 mt-1">
              Currently scoring: <strong>{currentPerformer.name}</strong>
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading Scores Alert */}
        {loadingScores && (
          <Alert className="border-blue-200 bg-blue-50">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription className="text-blue-700">Loading your previous scores...</AlertDescription>
          </Alert>
        )}

        {/* Current Performer Card */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Play className="h-5 w-5" />
              Currently Performing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-green-900">{currentPerformer.name}</h3>
                <p className="text-green-700">This team is currently performing and available for scoring</p>
                {hasExistingScore && currentScore?.submittedAt && (
                  <p className="text-green-600 text-sm mt-1">
                    Previously scored on: {currentScore.submittedAt.toDate?.()?.toLocaleString() || "Unknown"}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-600 text-white text-lg px-4 py-2">LIVE</Badge>
                {hasExistingScore && (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Previously Scored
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scoring Interface */}
        {currentScore && (
          <Card className="border-gray-200 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Scoring: {currentPerformer.name}
                </div>
                <div className="flex items-center gap-2">
                  {hasExistingScore && (
                    <Button onClick={enableEditing} size="sm" variant="outline">
                      <Edit className="h-3 w-3 mr-1" />
                      Edit Score
                    </Button>
                  )}
                  {currentScore.submitted && !isEditing && (
                    <Badge className="bg-green-100 text-green-800 border-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Submitted
                    </Badge>
                  )}
                  {isEditing && (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                      <Edit className="h-3 w-3 mr-1" />
                      Editing
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pb-24">
              {/* Scoring Criteria */}
              {/* Regular Scoring Criteria */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Main Judging Criteria</h3>
                {criteria.criteria.map((criterion) => (
                  <div key={criterion.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{criterion.name}</h4>
                        <p className="text-gray-600 text-sm mt-1">{criterion.description}</p>
                        <div className="text-xs text-gray-500 mt-1">Weight: {criterion.percentage}%</div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-2xl font-bold text-gray-900">
                          {currentScore.scores[criterion.id] || 0}%
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Slider
                        value={[currentScore.scores[criterion.id] || 0]}
                        onValueChange={(value) => updateScore(currentPerformer.id, criterion.id, value[0])}
                        max={100}
                        min={0}
                        step={0.5}
                        className="w-full"
                        disabled={Boolean(hasExistingScore)}
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>0%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Special Award Criteria */}
              {specialAwardCriteria.length > 0 && (
                <div className="space-y-4 mt-8">
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="font-semibold text-purple-900 flex items-center gap-2">
                      <Award className="h-5 w-5 text-purple-500" />
                      Special Award Criteria
                    </h3>
                    <p className="text-purple-700 text-sm mt-1">These scores are used for special awards only</p>
                  </div>

                  {specialAwardCriteria.map((criterion) => (
                    <div key={criterion.id} className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-purple-900 flex items-center gap-2">
                            <Award className="h-4 w-4" />
                            {criterion.name}
                          </h4>
                          <p className="text-purple-700 text-sm mt-1">{criterion.description}</p>
                          <div className="text-xs text-purple-600 mt-1">Special Award: {criterion.awardName}</div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-2xl font-bold text-purple-900">
                            {currentScore.scores[criterion.id] || 0}%
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Slider
                          value={[currentScore.scores[criterion.id] || 0]}
                          onValueChange={(value) => updateScore(currentPerformer.id, criterion.id, value[0])}
                          max={100}
                          min={0}
                          step={0.5}
                          className="w-full"
                          disabled={Boolean(hasExistingScore)}
                        />
                        <div className="flex justify-between text-xs text-purple-600">
                          <span>0%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4 border-t border-gray-200">
                {hasExistingScore ? (
                  <div className="text-center">
                    <p className="text-gray-600 mb-4">
                      You have already scored this team. Click &quot;Edit Score&quot; above to make changes.
                    </p>
                    <Button onClick={() => router.push("/")} variant="outline" size="lg">
                      Return to Dashboard
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button onClick={submitScore} disabled={!canSubmit || submitting} className="w-full" size="lg">
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {currentScore.scoreDocId ? "Updating Score..." : "Submitting Score..."}
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          {currentScore.scoreDocId
                            ? `Update Score for ${currentPerformer.name}`
                            : `Submit Score for ${currentPerformer.name}`}
                        </>
                      )}
                    </Button>
                    {!canSubmit && (
                      <p className="text-red-600 text-sm mt-2 text-center">
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
          <div className="bg-white border-2 border-gray-300 rounded-lg p-4 shadow-lg">
            <div className="flex items-center justify-between min-w-[280px]">
              <span className="font-semibold text-gray-900 text-lg">Total Score:</span>
              <span className="text-3xl font-bold text-gray-900">{currentScore.totalScore.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

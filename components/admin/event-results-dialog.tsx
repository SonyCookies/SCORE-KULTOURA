"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart3, Trophy, Users, Download, Loader2, AlertCircle, Award, Star, Crown } from "lucide-react"

interface JudgingScore {
  id: string
  eventId: string
  judgeId: string
  judgeEmail: string
  participantId: string
  participantName: string
  scores: Record<string, number>
  totalScore: number
  submittedAt: any
  eventTitle: string
}

interface ParticipantResult {
  participantId: string
  participantName: string
  scores: JudgingScore[]
  averageScore: number
  judgeCount: number
  rank?: number
  criteriaAverages?: Record<string, number>
}

interface SpecialAward {
  awardName: string
  criterionId: string
  criterionName: string
  winner: {
    participantId: string
    participantName: string
    averageScore: number
  } | null
  description: string
  icon: React.ReactNode
}

interface Criterion {
  id: string
  name: string
  description: string
  percentage: number
  maxScore: number
}

interface EventResultsDialogProps {
  eventId: string
  eventTitle: string
}

export default function EventResultsDialog({ eventId, eventTitle }: EventResultsDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ParticipantResult[]>([])
  const [allScores, setAllScores] = useState<JudgingScore[]>([])
  const [specialAwards, setSpecialAwards] = useState<SpecialAward[]>([])
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [error, setError] = useState("")

  const loadResults = async () => {
    setLoading(true)
    setError("")

    try {
      // Load event criteria first
      const criteriaDoc = await getDoc(doc(db, "eventCriteria", eventId))
      let eventCriteria: Criterion[] = []

      if (criteriaDoc.exists()) {
        eventCriteria = criteriaDoc.data().criteria || []
        setCriteria(eventCriteria)
      }

      // Query all scores for this event
      const scoresQuery = query(collection(db, "judgingScores"), where("eventId", "==", eventId))
      const scoresSnapshot = await getDocs(scoresQuery)

      if (scoresSnapshot.empty) {
        setResults([])
        setAllScores([])
        setSpecialAwards([])
        setLoading(false)
        return
      }

      const scores: JudgingScore[] = scoresSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as JudgingScore[]

      setAllScores(scores)

      // Group scores by participant
      const participantMap = new Map<string, JudgingScore[]>()
      scores.forEach((score) => {
        if (!participantMap.has(score.participantId)) {
          participantMap.set(score.participantId, [])
        }
        participantMap.get(score.participantId)!.push(score)
      })

      // Calculate results for each participant
      const participantResults: ParticipantResult[] = Array.from(participantMap.entries()).map(
        ([participantId, participantScores]) => {
          const averageScore =
            participantScores.reduce((sum, score) => sum + score.totalScore, 0) / participantScores.length

          // Calculate average scores for each criterion including special awards
          const criteriaAverages: Record<string, number> = {}

          if (eventCriteria.length > 0) {
            eventCriteria.forEach((criterion) => {
              const criterionScores = participantScores
                .map((score) => score.scores[criterion.id] || 0)
                .filter((score) => score > 0)

              if (criterionScores.length > 0) {
                criteriaAverages[criterion.id] =
                  criterionScores.reduce((sum, score) => sum + score, 0) / criterionScores.length
              }
            })
          }

          // Also calculate averages for special award criteria
          const allCriterionIds = new Set()
          scores.forEach((score) => {
            Object.keys(score.scores).forEach((id) => allCriterionIds.add(id))
          })

          allCriterionIds.forEach((criterionId) => {
            if (typeof criterionId === "string" && !criteriaAverages[criterionId]) {
              const criterionScores = participantScores
                .map((score) => score.scores[criterionId] || 0)
                .filter((score) => score > 0)

              if (criterionScores.length > 0) {
                criteriaAverages[criterionId] =
                  criterionScores.reduce((sum, score) => sum + score, 0) / criterionScores.length
              }
            }
          })

          return {
            participantId,
            participantName: participantScores[0].participantName,
            scores: participantScores,
            averageScore,
            judgeCount: participantScores.length,
            criteriaAverages,
          }
        },
      )

      // Sort by average score (highest first) and assign ranks
      participantResults.sort((a, b) => b.averageScore - a.averageScore)
      participantResults.forEach((result, index) => {
        result.rank = index + 1
      })

      setResults(participantResults)

      // Calculate special awards for Mazurka events
      if (eventTitle.toUpperCase().includes("MAZURKA") && eventCriteria.length > 0) {
        calculateSpecialAwards(participantResults, eventCriteria)
      } else {
        setSpecialAwards([])
      }
    } catch (error) {
      console.error("Error loading results:", error)
      setError("Failed to load results. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const calculateSpecialAwards = async (results: ParticipantResult[], eventCriteria: Criterion[]) => {
    const awards: SpecialAward[] = []

    try {
      // Load custom special awards
      const specialAwardsDoc = await getDoc(doc(db, "specialAwards", eventId))
      let customSpecialAwards: any[] = []

      if (specialAwardsDoc.exists()) {
        customSpecialAwards = specialAwardsDoc.data().awards || []
      }

      // Process custom special awards
      for (const customAward of customSpecialAwards) {
        let winner = null
        let highestScore = 0
        let criterionId = ""

        if (customAward.type === "existing" && customAward.basedOnCriterion) {
          // Award based on existing criterion
          criterionId = customAward.basedOnCriterion

          results.forEach((result) => {
            const score = result.criteriaAverages?.[criterionId] || 0
            if (score > highestScore) {
              highestScore = score
              winner = {
                participantId: result.participantId,
                participantName: result.participantName,
                averageScore: score,
              }
            }
          })
        } else if (customAward.type === "new") {
          // Award based on new criterion
          criterionId = `special_${customAward.id}`

          results.forEach((result) => {
            const score = result.criteriaAverages?.[criterionId] || 0
            if (score > highestScore) {
              highestScore = score
              winner = {
                participantId: result.participantId,
                participantName: result.participantName,
                averageScore: score,
              }
            }
          })
        }

        awards.push({
          awardName: customAward.name,
          criterionId: criterionId,
          criterionName:
            customAward.type === "existing"
              ? eventCriteria.find((c) => c.id === customAward.basedOnCriterion)?.name || customAward.basedOnCriterion
              : customAward.criterionName,
          winner: winner,
          description: customAward.description,
          icon: getIconComponent(customAward.icon),
        })
      }

      // Fallback to default Mazurka awards if no custom awards exist
      if (customSpecialAwards.length === 0) {
        // Find choreography criterion (by name matching)
        const choreographyCriterion = eventCriteria.find(
          (c) => c.name.toLowerCase().includes("choreography") || c.id.toLowerCase().includes("choreography"),
        )

        // Find costume criterion (by name matching)
        const costumeCriterion = eventCriteria.find(
          (c) =>
            c.name.toLowerCase().includes("costume") ||
            c.name.toLowerCase().includes("props") ||
            c.id.toLowerCase().includes("costume"),
        )

        // Best in Choreography Award
        if (choreographyCriterion) {
          let bestChoreographyWinner = null
          let highestChoreographyScore = 0

          results.forEach((result) => {
            const choreographyScore = result.criteriaAverages?.[choreographyCriterion.id] || 0
            if (choreographyScore > highestChoreographyScore) {
              highestChoreographyScore = choreographyScore
              bestChoreographyWinner = {
                participantId: result.participantId,
                participantName: result.participantName,
                averageScore: choreographyScore,
              }
            }
          })

          awards.push({
            awardName: "Best in Choreography Award",
            criterionId: choreographyCriterion.id,
            criterionName: choreographyCriterion.name,
            winner: bestChoreographyWinner,
            description: "Exceptional originality, synchronization, and storytelling through movement",
            icon: <Star className="h-5 w-5 text-purple-500" />,
          })
        }

        // Best in Costume and Props Award
        if (costumeCriterion) {
          let bestCostumeWinner = null
          let highestCostumeScore = 0

          results.forEach((result) => {
            const costumeScore = result.criteriaAverages?.[costumeCriterion.id] || 0
            if (costumeScore > highestCostumeScore) {
              highestCostumeScore = costumeScore
              bestCostumeWinner = {
                participantId: result.participantId,
                participantName: result.participantName,
                averageScore: costumeScore,
              }
            }
          })

          awards.push({
            awardName: "Best in Costume and Props Award",
            criterionId: costumeCriterion.id,
            criterionName: costumeCriterion.name,
            winner: bestCostumeWinner,
            description: "Most authentic, well-designed, and culturally representative attire and props",
            icon: <Crown className="h-5 w-5 text-amber-500" />,
          })
        }
      }
    } catch (error) {
      console.error("Error calculating special awards:", error)
    }

    setSpecialAwards(awards)
  }

  useEffect(() => {
    if (isOpen) {
      loadResults()
    }
  }, [isOpen, eventId])

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Badge className="bg-yellow-500 text-white">🥇 1st Place</Badge>
      case 2:
        return <Badge className="bg-gray-400 text-white">🥈 2nd Place</Badge>
      case 3:
        return <Badge className="bg-amber-600 text-white">🥉 3rd Place</Badge>
      default:
        return <Badge variant="outline">{rank}th Place</Badge>
    }
  }

  const exportResults = () => {
    const csvContent = [
      [
        "Rank",
        "Participant",
        "Average Score",
        "Judge Count",
        "Individual Scores",
        ...(specialAwards.length > 0 ? ["Special Awards"] : []),
      ].join(","),
      ...results.map((result) => {
        const specialAwardsWon = specialAwards
          .filter((award) => award.winner?.participantId === result.participantId)
          .map((award) => award.awardName)
          .join("; ")

        return [
          result.rank,
          result.participantName,
          result.averageScore.toFixed(2),
          result.judgeCount,
          result.scores.map((s) => `${s.judgeEmail}: ${s.totalScore.toFixed(1)}`).join("; "),
          ...(specialAwards.length > 0 ? [specialAwardsWon] : []),
        ].join(",")
      }),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${eventTitle.replace(/[^a-z0-9]/gi, "_")}_results.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getUniqueJudges = () => {
    const judges = new Set(allScores.map((score) => score.judgeEmail))
    return Array.from(judges)
  }

  const isMazurkaEvent = eventTitle.toUpperCase().includes("MAZURKA")
  const hasSpecialAwards = specialAwards.length > 0

  const getIconComponent = (iconName: string): React.ReactNode => {
    switch (iconName) {
      case "Star":
        return <Star className="h-5 w-5 text-purple-500" />
      case "Crown":
        return <Crown className="h-5 w-5 text-amber-500" />
      case "Award":
        return <Award className="h-5 w-5 text-blue-500" />
      default:
        return <Award className="h-5 w-5 text-blue-500" /> // Default icon
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="flex items-center gap-1">
          <BarChart3 className="h-3 w-3" />
          View Results
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Event Results: {eventTitle}
          </DialogTitle>
          <DialogDescription>View judging scores, rankings, and special awards for this event</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <span className="ml-2 text-gray-600">Loading results...</span>
          </div>
        ) : error ? (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        ) : results.length === 0 ? (
          <div className="text-center py-8">
            <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Results Yet</h3>
            <p className="text-gray-500">No judges have submitted scores for this event.</p>
          </div>
        ) : (
          <Tabs defaultValue="rankings" className="w-full">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="rankings">Rankings</TabsTrigger>
                {hasSpecialAwards && <TabsTrigger value="awards">Special Awards</TabsTrigger>}
                <TabsTrigger value="detailed">Detailed Scores</TabsTrigger>
                <TabsTrigger value="judges">Judge Summary</TabsTrigger>
              </TabsList>
              <Button onClick={exportResults} size="sm" variant="outline">
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
            </div>

            {/* Rankings Tab */}
            <TabsContent value="rankings" className="space-y-4">
              <div className="grid gap-4">
                {results.map((result) => (
                  <Card key={result.participantId} className="border-gray-200">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="text-3xl font-bold text-gray-900">#{result.rank}</div>
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-gray-900">{result.participantName}</h3>
                            <p className="text-gray-600">
                              Average Score: <span className="font-medium">{result.averageScore.toFixed(2)}%</span>
                            </p>
                            <p className="text-gray-500 text-sm">Judged by {result.judgeCount} judge(s)</p>

                            {/* Show special awards won by this participant */}
                            {hasSpecialAwards && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {specialAwards
                                  .filter((award) => award.winner?.participantId === result.participantId)
                                  .map((award) => (
                                    <Badge
                                      key={award.awardName}
                                      className="bg-purple-100 text-purple-800 border-purple-300"
                                    >
                                      <Award className="h-3 w-3 mr-1" />
                                      {award.awardName}
                                    </Badge>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {getRankBadge(result.rank!)}
                          <div className="mt-2">
                            <div className="text-2xl font-bold text-gray-900">{result.averageScore.toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Special Awards Tab */}
            {hasSpecialAwards && (
              <TabsContent value="awards" className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">🏆 Mazurka Mindorena Special Awards</h3>
                  <p className="text-gray-600">Recognizing excellence in specific performance categories</p>
                </div>

                <div className="grid gap-6">
                  {specialAwards.map((award) => (
                    <Card
                      key={award.awardName}
                      className="border-purple-200 bg-gradient-to-r from-purple-50 to-amber-50"
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-purple-800">
                          {award.icon}
                          {award.awardName}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <p className="text-gray-700 italic">"{award.description}"</p>

                          <div className="bg-white rounded-lg p-4 border border-purple-200">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm text-gray-600">Based on: {award.criterionName}</span>
                              </div>
                            </div>
                          </div>

                          {award.winner ? (
                            <div className="bg-white rounded-lg p-6 border-2 border-purple-300">
                              <div className="text-center">
                                <div className="text-4xl mb-2">🏆</div>
                                <h4 className="text-2xl font-bold text-purple-900 mb-2">
                                  {award.winner.participantName}
                                </h4>
                                <p className="text-purple-700 text-lg font-semibold">
                                  Score: {award.winner.averageScore.toFixed(1)}%
                                </p>
                                <Badge className="mt-2 bg-purple-600 text-white text-lg px-4 py-2">
                                  🎖️ AWARD WINNER
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-50 rounded-lg p-6 text-center">
                              <p className="text-gray-500">No winner determined yet</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Award Ceremony Note */}
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <h4 className="font-semibold text-blue-800 mb-2">📜 Certificate Awards</h4>
                      <p className="text-blue-700 text-sm">
                        Certificates will be presented to the winning teams for each special award category.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* Detailed Scores Tab */}
            <TabsContent value="detailed" className="space-y-4">
              {results.map((result) => (
                <Card key={result.participantId} className="border-gray-200">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>{result.participantName}</span>
                      <div className="flex items-center gap-2">
                        {getRankBadge(result.rank!)}
                        <span className="text-lg font-bold">{result.averageScore.toFixed(1)}%</span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {result.scores.map((score) => (
                        <div key={score.id} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-medium text-gray-900">Judge: {score.judgeEmail}</span>
                              <p className="text-sm text-gray-500">
                                Submitted: {score.submittedAt?.toDate?.()?.toLocaleString() || "Unknown"}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold text-gray-900">{score.totalScore.toFixed(1)}%</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                            {Object.entries(score.scores).map(([criterionId, criterionScore]) => {
                              const criterion = criteria.find((c) => c.id === criterionId)
                              const criterionName = criterion?.name || criterionId
                              return (
                                <div key={criterionId} className="bg-gray-50 p-2 rounded">
                                  <span className="text-gray-600">{criterionName}: </span>
                                  <span className="font-medium">{criterionScore}%</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Judge Summary Tab */}
            <TabsContent value="judges" className="space-y-4">
              <Card className="border-gray-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Judge Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Participating Judges</h4>
                      <div className="space-y-2">
                        {getUniqueJudges().map((judge) => {
                          const judgeScores = allScores.filter((s) => s.judgeEmail === judge)
                          return (
                            <div key={judge} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                              <span className="text-gray-900">{judge}</span>
                              <Badge variant="outline">{judgeScores.length} scores</Badge>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Statistics</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Participants:</span>
                          <span className="font-medium">{results.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Judges:</span>
                          <span className="font-medium">{getUniqueJudges().length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Scores:</span>
                          <span className="font-medium">{allScores.length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Highest Score:</span>
                          <span className="font-medium">
                            {results.length > 0 ? `${results[0].averageScore.toFixed(1)}%` : "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Average Score:</span>
                          <span className="font-medium">
                            {results.length > 0
                              ? `${(results.reduce((sum, r) => sum + r.averageScore, 0) / results.length).toFixed(1)}%`
                              : "N/A"}
                          </span>
                        </div>
                        {isMazurkaEvent && hasSpecialAwards && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Special Awards:</span>
                            <span className="font-medium">{specialAwards.length}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <div className="flex justify-end pt-4">
          <Button onClick={() => setIsOpen(false)} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

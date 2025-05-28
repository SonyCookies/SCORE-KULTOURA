"use client"
import { useState, useEffect, useCallback } from "react"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Plus, Settings, Trash2, CheckCircle, AlertCircle } from "lucide-react"

interface Criterion {
  id: string
  name: string
  description: string
  percentage: number
  maxScore: number
}

interface EventCriteriaFormProps {
  eventId: string
  eventTitle: string
  onCriteriaSaved?: () => void
}

export default function EventCriteriaForm({ eventId, eventTitle, onCriteriaSaved }: EventCriteriaFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingCriteria, setLoadingCriteria] = useState(false)
  const [error, setError] = useState("")
  const [criteria, setCriteria] = useState<Criterion[]>([])

  // Predefined criteria for Mazurka Mindorena Dance
  const mazurkaCriteria: Criterion[] = [
    {
      id: "performance",
      name: "Performance",
      description: "Energy, enthusiasm, confidence, stage presence, and engagement with the audience.",
      percentage: 20,
      maxScore: 10,
    },
    {
      id: "choreography",
      name: "Choreography",
      description: "Creativity, originality, synchronization, proper execution, and complexity of movements.",
      percentage: 40,
      maxScore: 10,
    },
    {
      id: "costume_props",
      name: "Costume and Props",
      description: "Relevance to the festival theme, creativity, aesthetic appeal, and proper use of props.",
      percentage: 10,
      maxScore: 10,
    },
    {
      id: "musicality",
      name: "Musicality and Rhythm",
      description:
        "Synchronization of movements with music, clarity of festival beat/rhythm, and appropriateness of music selection.",
      percentage: 10,
      maxScore: 10,
    },
    {
      id: "relevance",
      name: "Relevance",
      description: "Connection to the festival's history or culture, authenticity, and storytelling.",
      percentage: 10,
      maxScore: 10,
    },
    {
      id: "audience_impact",
      name: "Audience Impact",
      description: "General impression of the performance, audience reaction, and lasting effect.",
      percentage: 10,
      maxScore: 10,
    },
  ]

  const loadExistingCriteria = useCallback(async () => {
    setLoadingCriteria(true)
    try {
      const criteriaDoc = await getDoc(doc(db, "eventCriteria", eventId))
      if (criteriaDoc.exists()) {
        setCriteria(criteriaDoc.data().criteria || [])
      } else {
        if (eventTitle.toUpperCase().includes("MAZURKA")) {
          setCriteria(mazurkaCriteria)
        } else {
          setCriteria([])
        }
      }
    } catch (error) {
      console.error("Error loading criteria:", error)
    } finally {
      setLoadingCriteria(false)
    }
  }, [eventId, eventTitle, mazurkaCriteria])

  useEffect(() => {
    if (isOpen) {
      loadExistingCriteria()
    }
  }, [isOpen, loadExistingCriteria])


  const addCriterion = () => {
    const newCriterion: Criterion = {
      id: `criterion_${Date.now()}`,
      name: "",
      description: "",
      percentage: 0,
      maxScore: 10,
    }
    setCriteria([...criteria, newCriterion])
  }

  const updateCriterion = (index: number, field: keyof Criterion, value: string | number) => {
    const updatedCriteria = [...criteria]
    updatedCriteria[index] = {
      ...updatedCriteria[index],
      [field]: value,
    }
    setCriteria(updatedCriteria)
  }

  const removeCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index))
  }

  const loadMazurkaCriteria = () => {
    setCriteria(mazurkaCriteria)
  }

  const getTotalPercentage = () => {
    return criteria.reduce((total, criterion) => total + criterion.percentage, 0)
  }

  const validateCriteria = () => {
    const totalPercentage = getTotalPercentage()

    if (criteria.length === 0) {
      setError("Please add at least one criterion")
      return false
    }

    for (const criterion of criteria) {
      if (!criterion.name.trim()) {
        setError("All criteria must have a name")
        return false
      }
      if (!criterion.description.trim()) {
        setError("All criteria must have a description")
        return false
      }
      if (criterion.percentage <= 0) {
        setError("All criteria must have a percentage greater than 0")
        return false
      }
    }

    if (totalPercentage !== 100) {
      setError(`Total percentage must equal 100%. Current total: ${totalPercentage}%`)
      return false
    }

    return true
  }

  const handleSave = async () => {
    if (!validateCriteria()) {
      return
    }

    setLoading(true)
    setError("")

    try {
      await setDoc(doc(db, "eventCriteria", eventId), {
        eventId,
        eventTitle,
        criteria,
        totalPercentage: getTotalPercentage(),
        updatedAt: new Date(),
        createdAt: new Date(),
      })

      setIsOpen(false)
      onCriteriaSaved?.()
    } catch (error) {
      console.error("Error saving criteria:", error)
      setError("Failed to save criteria. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const totalPercentage = getTotalPercentage()
  const isValidTotal = totalPercentage === 100

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="flex items-center gap-1">
          <Settings className="h-3 w-3" />
          Set Criteria
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Set Judging Criteria
          </DialogTitle>
          <DialogDescription>
            Configure the judging criteria for <strong>{eventTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Load for Mazurka */}
          {eventTitle.toUpperCase().includes("MAZURKA") && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-blue-800 text-lg">Mazurka Mindorena Dance Criteria</CardTitle>
                <CardDescription className="text-blue-700">
                  Load the official judging criteria for Mazurka Mindorena Dance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={loadMazurkaCriteria} className="bg-blue-600 hover:bg-blue-700">
                  Load Mazurka Criteria
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Criteria List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Judging Criteria</h3>
              <div className="flex items-center gap-4">
                <div className={`text-sm font-medium ${isValidTotal ? "text-green-600" : "text-red-600"}`}>
                  Total: {totalPercentage}%
                  {isValidTotal ? (
                    <CheckCircle className="inline h-4 w-4 ml-1" />
                  ) : (
                    <AlertCircle className="inline h-4 w-4 ml-1" />
                  )}
                </div>
                <Button onClick={addCriterion} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Criterion
                </Button>
              </div>
            </div>

            {loadingCriteria ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                <p className="text-gray-600 mt-2">Loading criteria...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {criteria.map((criterion, index) => (
                  <Card key={criterion.id} className="border-gray-200">
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-12 gap-4 items-start">
                        {/* Criterion Name */}
                        <div className="col-span-3">
                          <Label htmlFor={`name-${index}`} className="text-sm font-medium">
                            Criterion Name
                          </Label>
                          <Input
                            id={`name-${index}`}
                            value={criterion.name}
                            onChange={(e) => updateCriterion(index, "name", e.target.value)}
                            placeholder="e.g., Performance"
                            className="mt-1"
                          />
                        </div>

                        {/* Description */}
                        <div className="col-span-5">
                          <Label htmlFor={`description-${index}`} className="text-sm font-medium">
                            Description
                          </Label>
                          <Textarea
                            id={`description-${index}`}
                            value={criterion.description}
                            onChange={(e) => updateCriterion(index, "description", e.target.value)}
                            placeholder="Describe what this criterion evaluates..."
                            rows={2}
                            className="mt-1"
                          />
                        </div>

                        {/* Percentage */}
                        <div className="col-span-2">
                          <Label htmlFor={`percentage-${index}`} className="text-sm font-medium">
                            Percentage
                          </Label>
                          <Input
                            id={`percentage-${index}`}
                            type="number"
                            min="0"
                            max="100"
                            value={criterion.percentage}
                            onChange={(e) => updateCriterion(index, "percentage", Number.parseInt(e.target.value) || 0)}
                            className="mt-1"
                          />
                        </div>

                        {/* Max Score */}
                        <div className="col-span-1">
                          <Label htmlFor={`maxScore-${index}`} className="text-sm font-medium">
                            Max Score
                          </Label>
                          <Input
                            id={`maxScore-${index}`}
                            type="number"
                            min="1"
                            max="100"
                            value={criterion.maxScore}
                            onChange={(e) => updateCriterion(index, "maxScore", Number.parseInt(e.target.value) || 10)}
                            className="mt-1"
                          />
                        </div>

                        {/* Remove Button */}
                        <div className="col-span-1 flex items-end">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeCriterion(index)}
                            className="mt-6"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {criteria.length === 0 && (
                  <Card className="border-dashed border-2 border-gray-300">
                    <CardContent className="text-center py-8">
                      <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">No criteria added yet</p>
                      <Button onClick={addCriterion} variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Criterion
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          {/* Summary Table */}
          {criteria.length > 0 && (
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg">Criteria Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Criteria</th>
                        <th className="text-left py-2">Description</th>
                        <th className="text-center py-2">Percentage</th>
                        <th className="text-center py-2">Max Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {criteria.map((criterion) => (
                        <tr key={criterion.id} className="border-b">
                          <td className="py-2 font-medium">{criterion.name}</td>
                          <td className="py-2 text-gray-600">{criterion.description}</td>
                          <td className="py-2 text-center">{criterion.percentage}%</td>
                          <td className="py-2 text-center">{criterion.maxScore}</td>
                        </tr>
                      ))}
                      <tr className="border-b-2 border-gray-400 font-bold">
                        <td className="py-2">Total</td>
                        <td className="py-2"></td>
                        <td className={`py-2 text-center ${isValidTotal ? "text-green-600" : "text-red-600"}`}>
                          {totalPercentage}%
                        </td>
                        <td className="py-2 text-center">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={loading || !isValidTotal} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Criteria...
                </>
              ) : (
                "Save Criteria"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

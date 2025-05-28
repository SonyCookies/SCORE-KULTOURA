"use client"

import { useState, useEffect, useCallback } from "react"
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Plus, Award, Star, Crown, Trophy, Trash2, CheckCircle, AlertCircle } from "lucide-react"

interface SpecialAward {
  id: string
  name: string
  description: string
  icon: string
  type: "existing" | "new"
  basedOnCriterion?: string // For existing criteria
  criterionName?: string // For new criteria
  criterionDescription?: string // For new criteria
  maxScore: number
  createdAt: Date
}

interface Criterion {
  id: string
  name: string
  description: string
  percentage: number
  maxScore: number
  isSpecialAward?: boolean
  specialAwardId?: string
}

interface SpecialAwardsManagementProps {
  eventId: string
  eventTitle: string
  onAwardsUpdated?: () => void
}

export default function SpecialAwardsManagement({
  eventId,
  eventTitle,
  onAwardsUpdated,
}: SpecialAwardsManagementProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingAwards, setLoadingAwards] = useState(false)
  const [error, setError] = useState("")
  const [specialAwards, setSpecialAwards] = useState<SpecialAward[]>([])
  const [existingCriteria, setExistingCriteria] = useState<Criterion[]>([])
  const [activeTab, setActiveTab] = useState("manage")

  // Form state for new award
  const [newAward, setNewAward] = useState({
    name: "",
    description: "",
    icon: "star",
    type: "existing" as "existing" | "new",
    basedOnCriterion: "",
    criterionName: "",
    criterionDescription: "",
    maxScore: 10,
  })

  const iconOptions = [
    { value: "star", label: "⭐ Star", icon: <Star className="h-4 w-4" /> },
    { value: "crown", label: "👑 Crown", icon: <Crown className="h-4 w-4" /> },
    { value: "trophy", label: "🏆 Trophy", icon: <Trophy className="h-4 w-4" /> },
    { value: "award", label: "🏅 Award", icon: <Award className="h-4 w-4" /> },
  ]

  const predefinedAwards = [
    {
      name: "Best in Choreography Award",
      description: "Exceptional originality, synchronization, and storytelling through movement",
      icon: "star",
      type: "existing" as const,
      basedOnCriterion: "choreography",
    },
    {
      name: "Best in Costume and Props Award",
      description: "Most authentic, well-designed, and culturally representative attire and props",
      icon: "crown",
      type: "existing" as const,
      basedOnCriterion: "costume_props",
    },
    {
      name: "People&apos;s Choice Award",
      description: "Most popular performance as voted by the audience",
      icon: "trophy",
      type: "new" as const,
      criterionName: "Audience Vote",
      criterionDescription: "Audience appreciation and engagement with the performance",
      maxScore: 10,
    },
    {
      name: "Most Creative Performance",
      description: "Most innovative and creative interpretation of the cultural theme",
      icon: "award",
      type: "new" as const,
      criterionName: "Creativity",
      criterionDescription: "Innovation, uniqueness, and creative interpretation",
      maxScore: 10,
    },
  ]

  const loadSpecialAwards = useCallback(async () => {
    setLoadingAwards(true)
    try {
      const awardsDoc = await getDoc(doc(db, "specialAwards", eventId))
      if (awardsDoc.exists()) {
        setSpecialAwards(awardsDoc.data().awards || [])
      } else {
        setSpecialAwards([])
      }
    } catch (error) {
      console.error("Error loading special awards:", error)
      setError("Failed to load special awards")
    } finally {
      setLoadingAwards(false)
    }
  }, [eventId])

  const loadExistingCriteria = useCallback(async () => {
    try {
      const criteriaDoc = await getDoc(doc(db, "eventCriteria", eventId))
      if (criteriaDoc.exists()) {
        setExistingCriteria(criteriaDoc.data().criteria || [])
      }
    } catch (error) {
      console.error("Error loading criteria:", error)
    }
  }, [eventId])

  useEffect(() => {
    if (isOpen) {
      loadSpecialAwards()
      loadExistingCriteria()
    }
  }, [isOpen, loadSpecialAwards, loadExistingCriteria])

  const addPredefinedAward = (predefined: (typeof predefinedAwards)[0]) => {
    setNewAward({
      name: predefined.name,
      description: predefined.description,
      icon: predefined.icon,
      type: predefined.type,
      basedOnCriterion: predefined.basedOnCriterion || "",
      criterionName: predefined.criterionName || "",
      criterionDescription: predefined.criterionDescription || "",
      maxScore: predefined.maxScore || 10,
    })
  }

  const addSpecialAward = async () => {
    if (!newAward.name.trim() || !newAward.description.trim()) {
      setError("Please fill in all required fields")
      return
    }

    if (newAward.type === "existing" && !newAward.basedOnCriterion) {
      setError("Please select a criterion for existing-based awards")
      return
    }

    if (
      newAward.type === "new" &&
      (!newAward.criterionName.trim() || !newAward.criterionDescription.trim())
    ) {
      setError("Please fill in criterion details for new awards")
      return
    }

    setLoading(true)
    setError("")

    try {
      const award: SpecialAward = {
        id: `award_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: newAward.name.trim(),
        description: newAward.description.trim(),
        icon: newAward.icon,
        type: newAward.type,
        ...(newAward.type === "existing" &&
          newAward.basedOnCriterion && {
            basedOnCriterion: newAward.basedOnCriterion,
          }),
        ...(newAward.type === "new" &&
          newAward.criterionName.trim() && {
            criterionName: newAward.criterionName.trim(),
            criterionDescription: newAward.criterionDescription.trim(),
          }),
        maxScore: newAward.maxScore,
        createdAt: new Date(),
      }

      const updatedAwards = [...specialAwards, award]
      setSpecialAwards(updatedAwards)

      // Save to Firestore
      await setDoc(doc(db, "specialAwards", eventId), {
        eventId,
        eventTitle,
        awards: updatedAwards,
        updatedAt: new Date(),
      })

      if (newAward.type === "new") {
        await addNewCriterionToEvent(award)
      }

      setNewAward({
        name: "",
        description: "",
        icon: "star",
        type: "existing",
        basedOnCriterion: "",
        criterionName: "",
        criterionDescription: "",
        maxScore: 10,
      })

      onAwardsUpdated?.()
    } catch (error) {
      console.error("Error adding special award:", error)
      setError("Failed to add special award. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const addNewCriterionToEvent = async (award: SpecialAward) => {
    try {
      const criteriaDoc = await getDoc(doc(db, "eventCriteria", eventId))

      if (criteriaDoc.exists()) {
        const currentCriteria: Criterion[] = criteriaDoc.data().criteria || []

        const newCriterion: Criterion = {
          id: `special_${award.id}`,
          name: award.criterionName || "Special Criterion",
          description: award.criterionDescription || "Special award criterion",
          percentage: 0,
          maxScore: award.maxScore,
          isSpecialAward: true,
          specialAwardId: award.id,
        }

        const updatedCriteria = [...currentCriteria, newCriterion]

        await updateDoc(doc(db, "eventCriteria", eventId), {
          criteria: updatedCriteria,
          updatedAt: new Date(),
        })
      }
    } catch (error) {
      console.error("Error adding new criterion:", error)
      // Intentionally no throw since award was already saved
    }
  }

  const removeSpecialAward = async (awardId: string) => {
    if (!confirm("Are you sure you want to remove this special award?")) return

    setLoading(true)
    try {
      const updatedAwards = specialAwards.filter((award) => award.id !== awardId)
      setSpecialAwards(updatedAwards)

      await setDoc(doc(db, "specialAwards", eventId), {
        eventId,
        eventTitle,
        awards: updatedAwards,
        updatedAt: new Date(),
      })

      const removedAward = specialAwards.find((award) => award.id === awardId)
      if (removedAward?.type === "new") {
        await removeNewCriterionFromEvent(awardId)
      }

      onAwardsUpdated?.()
    } catch (error) {
      console.error("Error removing special award:", error)
      setError("Failed to remove special award")
    } finally {
      setLoading(false)
    }
  }

  const removeNewCriterionFromEvent = async (awardId: string) => {
    try {
      const criteriaDoc = await getDoc(doc(db, "eventCriteria", eventId))

      if (criteriaDoc.exists()) {
        const currentCriteria: Criterion[] = criteriaDoc.data().criteria || []
        const updatedCriteria = currentCriteria.filter((c) => c.specialAwardId !== awardId)

        await updateDoc(doc(db, "eventCriteria", eventId), {
          criteria: updatedCriteria,
          updatedAt: new Date(),
        })
      }
    } catch (error) {
      console.error("Error removing criterion:", error)
    }
  }

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case "crown":
        return <Crown className="h-4 w-4" />
      case "trophy":
        return <Trophy className="h-4 w-4" />
      case "award":
        return <Award className="h-4 w-4" />
      default:
        return <Star className="h-4 w-4" />
    }
  }

  const getCriterionName = (criterionId: string) => {
    const criterion = existingCriteria.find((c) => c.id === criterionId)
    return criterion?.name || criterionId
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="flex items-center gap-1">
          <Award className="h-3 w-3" />
          Special Awards ({specialAwards.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-purple-500" />
            Special Awards Management - {eventTitle}
          </DialogTitle>
          <DialogDescription>
            Create custom special awards for this event. Awards can be based on existing criteria or add new judging
            criteria.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manage">Manage Awards</TabsTrigger>
            <TabsTrigger value="add">Add New Award</TabsTrigger>
          </TabsList>

          {/* Manage Awards Tab */}
          <TabsContent value="manage" className="space-y-4">
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            {loadingAwards ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                <p className="text-gray-600 mt-2">Loading special awards...</p>
              </div>
            ) : specialAwards.length === 0 ? (
              <Card className="border-dashed border-2 border-gray-300">
                <CardContent className="text-center py-8">
                  <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 mb-4">No special awards created yet</p>
                  <Button onClick={() => setActiveTab("add")} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Special Award
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {specialAwards.map((award) => (
                  <Card key={award.id} className="border-purple-200 bg-purple-50">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-purple-800">
                          {getIconComponent(award.icon)}
                          {award.name}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              award.type === "existing" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"
                            }
                          >
                            {award.type === "existing" ? "Based on Existing" : "New Criterion"}
                          </Badge>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeSpecialAward(award.id)}
                            disabled={loading}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-purple-700 mb-3 italic">&quot;{award.description}&quot;</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-purple-800">Type:</span>
                          <p className="text-purple-700">
                            {award.type === "existing" ? "Based on existing criterion" : "New judging criterion"}
                          </p>
                        </div>

                        {award.type === "existing" && award.basedOnCriterion && (
                          <div>
                            <span className="font-medium text-purple-800">Based on:</span>
                            <p className="text-purple-700">{getCriterionName(award.basedOnCriterion)}</p>
                          </div>
                        )}

                        {award.type === "new" && (
                          <>
                            <div>
                              <span className="font-medium text-purple-800">Criterion Name:</span>
                              <p className="text-purple-700">{award.criterionName}</p>
                            </div>
                            <div>
                              <span className="font-medium text-purple-800">Max Score:</span>
                              <p className="text-purple-700">{award.maxScore} points</p>
                            </div>
                            <div className="md:col-span-2">
                              <span className="font-medium text-purple-800">Criterion Description:</span>
                              <p className="text-purple-700">{award.criterionDescription}</p>
                            </div>
                          </>
                        )}
                      </div>

                      {award.type === "new" && (
                        <Alert className="mt-3 border-green-200 bg-green-50">
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription className="text-green-700">
                            This award adds a new criterion to the judging interface. Judges will score this criterion
                            separately.
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Add New Award Tab */}
          <TabsContent value="add" className="space-y-6">
            {/* Quick Add Predefined Awards */}
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-800">Quick Add Predefined Awards</CardTitle>
                <CardDescription className="text-blue-700">
                  Add common special awards with pre-filled details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {predefinedAwards.map((predefined, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => addPredefinedAward(predefined)}
                      className="justify-start text-left h-auto p-3"
                    >
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {getIconComponent(predefined.icon)}
                          {predefined.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{predefined.description}</div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Custom Award Form */}
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle>Create Custom Special Award</CardTitle>
                <CardDescription>Design your own special award for this event</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="awardName">Award Name *</Label>
                  <Input
                    id="awardName"
                    value={newAward.name}
                    onChange={(e) => setNewAward({ ...newAward, name: e.target.value })}
                    placeholder="e.g., Best in Choreography Award"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="awardDescription">Award Description *</Label>
                  <Textarea
                    id="awardDescription"
                    value={newAward.description}
                    onChange={(e) => setNewAward({ ...newAward, description: e.target.value })}
                    placeholder="Describe what this award recognizes..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Award Icon</Label>
                  <Select value={newAward.icon} onValueChange={(value) => setNewAward({ ...newAward, icon: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {iconOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            {option.icon}
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Award Type *</Label>
                  <Select
                    value={newAward.type}
                    onValueChange={(value: "existing" | "new") => setNewAward({ ...newAward, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="existing">Based on Existing Criterion</SelectItem>
                      <SelectItem value="new">Create New Judging Criterion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newAward.type === "existing" && (
                  <div className="space-y-2">
                    <Label>Select Existing Criterion *</Label>
                    <Select
                      value={newAward.basedOnCriterion}
                      onValueChange={(value) => setNewAward({ ...newAward, basedOnCriterion: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a criterion" />
                      </SelectTrigger>
                      <SelectContent>
                        {existingCriteria.map((criterion) => (
                          <SelectItem key={criterion.id} value={criterion.id}>
                            {criterion.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {existingCriteria.length === 0 && (
                      <p className="text-sm text-red-600">
                        No existing criteria found. Please set up event criteria first.
                      </p>
                    )}
                  </div>
                )}

                {newAward.type === "new" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="criterionName">New Criterion Name *</Label>
                      <Input
                        id="criterionName"
                        value={newAward.criterionName}
                        onChange={(e) => setNewAward({ ...newAward, criterionName: e.target.value })}
                        placeholder="e.g., Audience Engagement"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="criterionDescription">Criterion Description *</Label>
                      <Textarea
                        id="criterionDescription"
                        value={newAward.criterionDescription}
                        onChange={(e) => setNewAward({ ...newAward, criterionDescription: e.target.value })}
                        placeholder="Describe what judges should evaluate for this criterion..."
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxScore">Maximum Score</Label>
                      <Input
                        id="maxScore"
                        type="number"
                        min={1}
                        max={100}
                        value={newAward.maxScore}
                        onChange={(e) =>
                          setNewAward({ ...newAward, maxScore: Number.parseInt(e.target.value) || 10 })
                        }
                      />
                    </div>

                    <Alert className="border-yellow-200 bg-yellow-50">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-yellow-700">
                        Creating a new criterion will add it to the judging interface. You may need to adjust the
                        percentage weights in the criteria settings.
                      </AlertDescription>
                    </Alert>
                  </>
                )}

                {error && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-red-700">{error}</AlertDescription>
                  </Alert>
                )}

                <Button onClick={addSpecialAward} disabled={loading} className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding Special Award...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Special Award
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4">
          <Button onClick={() => setIsOpen(false)} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

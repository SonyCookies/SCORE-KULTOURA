"use client"

import type React from "react"

import { useState } from "react"
import { addDoc, collection } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Loader2, Plus, Calendar } from "lucide-react"

interface EventCreationFormProps {
  onEventCreated?: () => void
}

export default function EventCreationForm({ onEventCreated }: EventCreationFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    maxParticipants: "",
    duration: "",
    venue: "",
    requirements: "",
  })

  const categories = [
    "Dance",
    "Exhibit",
    "Video Competition",
    "Speech/Performance",
    "Fashion",
    "Music",
    "Arts & Crafts",
    "Cultural Heritage",
    "Other",
  ]

  const predefinedEvents = [
    {
      title: "MAZURKA MINDORENA DANCE",
      description: "Traditional Mazurka dance performance showcasing the cultural heritage of Mindoro",
      category: "Dance",
      maxParticipants: "20",
      duration: "5-7 minutes per performance",
      venue: "Main Stage",
      requirements: "Traditional costume, minimum 4 dancers per group",
    },
    {
      title: "MINI-MUSEUM EXHIBIT",
      description: "Cultural artifacts and historical displays representing local heritage and traditions",
      category: "Exhibit",
      maxParticipants: "15",
      duration: "All day display",
      venue: "Exhibition Hall",
      requirements: "Authentic artifacts, informational displays, interactive elements",
    },
    {
      title: "ADVOCACY VIDEO COMPETITION",
      description: "Short video presentations promoting cultural awareness and heritage preservation",
      category: "Video Competition",
      maxParticipants: "25",
      duration: "3-5 minutes per video",
      venue: "Multimedia Room",
      requirements: "Original content, cultural theme, maximum 5 minutes duration",
    },
    {
      title: "SPEECH CHOIR",
      description: "Coordinated group recitation showcasing Filipino literature and cultural narratives",
      category: "Speech/Performance",
      maxParticipants: "30",
      duration: "4-6 minutes per performance",
      venue: "Main Stage",
      requirements: "Minimum 8 members, Filipino literary piece, coordinated movements",
    },
    {
      title: "CULTURAL FASHION WALK",
      description: "Fashion showcase featuring traditional Filipino attire and modern interpretations",
      category: "Fashion",
      maxParticipants: "40",
      duration: "10-15 minutes",
      venue: "Runway Stage",
      requirements: "Traditional or culturally-inspired outfits, brief description of attire",
    },
  ]

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const loadPredefinedEvent = (event: (typeof predefinedEvents)[0]) => {
    setFormData({
      title: event.title,
      description: event.description,
      category: event.category,
      maxParticipants: event.maxParticipants,
      duration: event.duration,
      venue: event.venue,
      requirements: event.requirements,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.description || !formData.category) {
      setError("Please fill in all required fields")
      return
    }

    setLoading(true)
    setError("")

    try {
      await addDoc(collection(db, "events"), {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        maxParticipants: Number.parseInt(formData.maxParticipants) || 0,
        duration: formData.duration,
        venue: formData.venue,
        requirements: formData.requirements,
        status: "draft",
        adminActivated: false,
        showToJudges: false,
        participants: [],
        createdAt: new Date(),
        createdBy: "admin",
      })

      // Reset form
      setFormData({
        title: "",
        description: "",
        category: "",
        maxParticipants: "",
        duration: "",
        venue: "",
        requirements: "",
      })

      setIsOpen(false)
      onEventCreated?.()
    } catch (error) {
      console.error("Error creating event:", error)
      setError("Failed to create event. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const createAllPredefinedEvents = async () => {
    setLoading(true)
    setError("")

    try {
      const promises = predefinedEvents.map((event) =>
        addDoc(collection(db, "events"), {
          title: event.title,
          description: event.description,
          category: event.category,
          maxParticipants: Number.parseInt(event.maxParticipants) || 0,
          duration: event.duration,
          venue: event.venue,
          requirements: event.requirements,
          status: "draft",
          adminActivated: false,
          showToJudges: false,
          participants: [],
          createdAt: new Date(),
          createdBy: "admin",
        }),
      )

      await Promise.all(promises)
      setIsOpen(false)
      onEventCreated?.()
    } catch (error) {
      console.error("Error creating events:", error)
      setError("Failed to create events. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4 mr-2" />
          Create Event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create New Event
          </DialogTitle>
          <DialogDescription>Create a new cultural event for KULTOURA platform</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Add Predefined Events */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-blue-800 text-lg">Quick Add KULTOURA Events</CardTitle>
              <CardDescription className="text-blue-700">Add all predefined cultural events at once</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button
                  onClick={createAllPredefinedEvents}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating All Events...
                    </>
                  ) : (
                    "Create All 5 KULTOURA Events"
                  )}
                </Button>
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">This will create:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {predefinedEvents.map((event, index) => (
                      <li key={index}>{event.title}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Manual Event Creation Form */}
          <Card>
            <CardHeader>
              <CardTitle>Manual Event Creation</CardTitle>
              <CardDescription>Create a custom event or use predefined templates</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Predefined Event Templates */}
                <div className="space-y-2">
                  <Label>Quick Templates</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {predefinedEvents.map((event, index) => (
                      <Button
                        key={index}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => loadPredefinedEvent(event)}
                        className="justify-start text-left h-auto p-2"
                      >
                        <div>
                          <div className="font-medium">{event.title}</div>
                          <div className="text-xs text-gray-500">{event.category}</div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Event Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Event Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => handleInputChange("title", e.target.value)}
                    placeholder="Enter event title"
                    required
                  />
                </div>

                {/* Event Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                    placeholder="Describe the event..."
                    rows={3}
                    required
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => handleInputChange("category", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Additional Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxParticipants">Max Participants</Label>
                    <Input
                      id="maxParticipants"
                      type="number"
                      value={formData.maxParticipants}
                      onChange={(e) => handleInputChange("maxParticipants", e.target.value)}
                      placeholder="e.g., 20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration</Label>
                    <Input
                      id="duration"
                      value={formData.duration}
                      onChange={(e) => handleInputChange("duration", e.target.value)}
                      placeholder="e.g., 5-7 minutes"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venue">Venue</Label>
                  <Input
                    id="venue"
                    value={formData.venue}
                    onChange={(e) => handleInputChange("venue", e.target.value)}
                    placeholder="Event location"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requirements">Requirements</Label>
                  <Textarea
                    id="requirements"
                    value={formData.requirements}
                    onChange={(e) => handleInputChange("requirements", e.target.value)}
                    placeholder="List any requirements for participants..."
                    rows={2}
                  />
                </div>

                {error && (
                  <Alert className="border-red-200 bg-red-50">
                    <AlertDescription className="text-red-700">{error}</AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Event"
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}

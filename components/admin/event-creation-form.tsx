"use client"

import type React from "react"

import { useState } from "react"
import { collection, addDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Loader2, AlertCircle } from "lucide-react"

interface EventCreationFormProps {
  onEventCreated: () => void
}

export default function EventCreationForm({ onEventCreated }: EventCreationFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    venue: "",
    duration: "",
    maxParticipants: "",
    requirements: "",
  })

  const categories = ["Dance", "Music", "Drama", "Poetry", "Art", "Cultural Fashion Walk", "Other"]

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      // Determine judging mode based on event title/category
      const isCulturalFashionWalk =
        formData.title.toLowerCase().includes("cultural fashion walk") || formData.category === "Cultural Fashion Walk"

      const eventData = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        venue: formData.venue || null,
        duration: formData.duration || null,
        maxParticipants: formData.maxParticipants ? Number.parseInt(formData.maxParticipants) : null,
        requirements: formData.requirements || null,
        participants: [],
        adminActivated: false,
        showToJudges: false,
        startTime: null,
        currentPerformer: null,
        createdAt: new Date(),
        // Set judging mode based on event type
        judgingMode: isCulturalFashionWalk ? "free-roam" : "sequential",
      }

      await addDoc(collection(db, "events"), eventData)

      // Reset form
      setFormData({
        title: "",
        description: "",
        category: "",
        venue: "",
        duration: "",
        maxParticipants: "",
        requirements: "",
      })

      setIsOpen(false)
      onEventCreated()
    } catch (error) {
      console.error("Error creating event:", error)
      setError("Failed to create event. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-red-600 hover:bg-red-700 text-white">
          <Plus className="h-4 w-4 mr-2" />
          Create New Event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Event</DialogTitle>
          <DialogDescription>
            Fill in the details to create a new judging event. Cultural Fashion Walk events will allow free-roam
            judging.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="e.g., Cultural Fashion Walk 2024"
                required
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Describe the event..."
                required
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="category">Category *</Label>
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

            <div>
              <Label htmlFor="venue">Venue</Label>
              <Input
                id="venue"
                value={formData.venue}
                onChange={(e) => handleInputChange("venue", e.target.value)}
                placeholder="e.g., Main Auditorium"
              />
            </div>

            <div>
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                value={formData.duration}
                onChange={(e) => handleInputChange("duration", e.target.value)}
                placeholder="e.g., 2 hours"
              />
            </div>

            <div>
              <Label htmlFor="maxParticipants">Max Participants</Label>
              <Input
                id="maxParticipants"
                type="number"
                value={formData.maxParticipants}
                onChange={(e) => handleInputChange("maxParticipants", e.target.value)}
                placeholder="e.g., 20"
                min="1"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="requirements">Requirements</Label>
              <Textarea
                id="requirements"
                value={formData.requirements}
                onChange={(e) => handleInputChange("requirements", e.target.value)}
                placeholder="Any special requirements or rules..."
                rows={2}
              />
            </div>
          </div>

          {/* Judging Mode Info */}
          {(formData.title.toLowerCase().includes("cultural fashion walk") ||
            formData.category === "Cultural Fashion Walk") && (
            <Card className="border-purple-200 bg-purple-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-purple-800 text-sm">Special Judging Mode</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-purple-700 text-sm">
                  This event will use <strong>Free-Roam Judging</strong> mode. Judges can score any participant at any
                  time without waiting for the admin to set a current performer.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-red-600 hover:bg-red-700">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Event"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

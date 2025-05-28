"use client"

import { useState, useEffect } from "react"
import { doc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Users, Plus, Play, Pause, CheckCircle, Clock, Loader2, Trash2 } from "lucide-react"

interface Participant {
  id: string
  name: string
  status: "waiting" | "performing" | "completed"
  addedAt: Date
}

interface Event {
  id: string
  title: string
  participants: Participant[]
  currentPerformer?: string | null
  adminActivated: boolean
  showToJudges: boolean
}

interface ParticipantManagementProps {
  event: Event
  onEventUpdated?: () => void
}

export default function ParticipantManagement({ event, onEventUpdated }: ParticipantManagementProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>(event.participants || [])
  const [currentPerformer, setCurrentPerformer] = useState<string | null>(event.currentPerformer || null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [newParticipantName, setNewParticipantName] = useState("")

  // Predefined participants for quick add
  const predefinedParticipants = ["3F1", "2C1", "2C2", "2C3", "2D1", "2D2", "2D3", "2D4"]

  useEffect(() => {
    setParticipants(event.participants || [])
    setCurrentPerformer(event.currentPerformer || null)
  }, [event])

  const addParticipant = async (participantName: string) => {
    if (!participantName.trim()) return

    const newParticipant: Participant = {
      id: `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: participantName.trim(),
      status: "waiting",
      addedAt: new Date(),
    }

    const updatedParticipants = [...participants, newParticipant]
    setParticipants(updatedParticipants)
    await updateEventParticipants(updatedParticipants)
    setNewParticipantName("")
  }

  const removeParticipant = async (participantId: string) => {
    const updatedParticipants = participants.filter((p) => p.id !== participantId)
    setParticipants(updatedParticipants)

    // If removing the current performer, clear current performer
    if (currentPerformer === participantId) {
      setCurrentPerformer(null)
      await updateCurrentPerformer(null)
    }

    await updateEventParticipants(updatedParticipants)
  }

  const addAllPredefined = async () => {
    setLoading(true)
    try {
      const newParticipants: Participant[] = predefinedParticipants.map((name) => ({
        id: `participant_${Date.now()}_${name}`,
        name,
        status: "waiting" as const,
        addedAt: new Date(),
      }))

      const updatedParticipants = [...participants, ...newParticipants]
      setParticipants(updatedParticipants)
      await updateEventParticipants(updatedParticipants)
    } catch (error) {
      setError("Failed to add participants")
    } finally {
      setLoading(false)
    }
  }

  const setCurrentPerformerHandler = async (participantId: string | null) => {
    setLoading(true)
    try {
      // Update participant statuses
      const updatedParticipants = participants.map((p) => ({
        ...p,
        status:
          p.id === participantId
            ? ("performing" as const)
            : p.id === currentPerformer
              ? ("completed" as const)
              : p.status,
      }))

      setParticipants(updatedParticipants)
      setCurrentPerformer(participantId)

      await updateCurrentPerformer(participantId)
      await updateEventParticipants(updatedParticipants)
    } catch (error) {
      setError("Failed to update current performer")
    } finally {
      setLoading(false)
    }
  }

  const updateEventParticipants = async (updatedParticipants: Participant[]) => {
    try {
      await updateDoc(doc(db, "events", event.id), {
        participants: updatedParticipants,
        updatedAt: new Date(),
      })
      onEventUpdated?.()
    } catch (error) {
      console.error("Error updating participants:", error)
      setError("Failed to update participants")
    }
  }

  const updateCurrentPerformer = async (performerId: string | null) => {
    try {
      await updateDoc(doc(db, "events", event.id), {
        currentPerformer: performerId,
        updatedAt: new Date(),
      })
      onEventUpdated?.()
    } catch (error) {
      console.error("Error updating current performer:", error)
      setError("Failed to update current performer")
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "performing":
        return <Play className="h-4 w-4 text-green-500" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-blue-500" />
      case "waiting":
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "performing":
        return <Badge className="bg-green-100 text-green-800 border-green-300">Performing</Badge>
      case "completed":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Completed</Badge>
      case "waiting":
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Waiting</Badge>
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          Manage Participants ({participants.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Participants - {event.title}
          </DialogTitle>
          <DialogDescription>Add participants and control which team is currently performing</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Error Alert */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}

          {/* Quick Add All */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-blue-800 text-lg">Quick Add All Teams</CardTitle>
              <CardDescription className="text-blue-700">
                Add all predefined teams: {predefinedParticipants.join(", ")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={addAllPredefined} disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Teams...
                  </>
                ) : (
                  "Add All 8 Teams"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Add Individual Participant */}
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle>Add Individual Participant</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="participantName">Team Name</Label>
                  <Input
                    id="participantName"
                    value={newParticipantName}
                    onChange={(e) => setNewParticipantName(e.target.value)}
                    placeholder="Enter team name (e.g., 3F1)"
                    onKeyPress={(e) => e.key === "Enter" && addParticipant(newParticipantName)}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={() => addParticipant(newParticipantName)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>

              {/* Quick add buttons for predefined teams */}
              <div className="mt-3">
                <Label>Quick Add:</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {predefinedParticipants.map((name) => (
                    <Button
                      key={name}
                      size="sm"
                      variant="outline"
                      onClick={() => addParticipant(name)}
                      disabled={participants.some((p) => p.name === name)}
                    >
                      {name}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Performer Selection */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-800">Current Performer</CardTitle>
              <CardDescription className="text-green-700">
                Select which team is currently performing (only this team can be scored by judges)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <Select value={currentPerformer || ""} onValueChange={setCurrentPerformerHandler}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select current performer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No one performing</SelectItem>
                      {participants
                        .filter((p) => p.status !== "completed")
                        .map((participant) => (
                          <SelectItem key={participant.id} value={participant.id}>
                            {participant.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {currentPerformer && (
                  <Button variant="outline" onClick={() => setCurrentPerformerHandler(null)} disabled={loading}>
                    <Pause className="h-4 w-4 mr-1" />
                    Stop Performance
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Participants List */}
          <Card className="border-gray-200">
            <CardHeader>
              <CardTitle>Participants ({participants.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No participants added yet. Add teams to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <div
                      key={participant.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        participant.id === currentPerformer
                          ? "border-green-300 bg-green-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(participant.status)}
                        <div>
                          <div className="font-medium text-gray-900">{participant.name}</div>
                          <div className="text-sm text-gray-500">Added: {participant.addedAt.toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(participant.status)}
                        {participant.id === currentPerformer && <Badge className="bg-green-600 text-white">LIVE</Badge>}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeParticipant(participant.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Summary */}
          {participants.length > 0 && (
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {participants.filter((p) => p.status === "waiting").length}
                    </div>
                    <div className="text-sm text-gray-600">Waiting</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {participants.filter((p) => p.status === "performing").length}
                    </div>
                    <div className="text-sm text-gray-600">Performing</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {participants.filter((p) => p.status === "completed").length}
                    </div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Close Button */}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setIsOpen(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

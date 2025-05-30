import type { Timestamp } from "firebase/firestore"

// Participant interface
export interface Participant {
  id: string
  name: string
  status: "waiting" | "performing" | "completed"
  addedAt: Date | Timestamp
}

// Event interface
export interface Event {
  id: string
  title: string
  description: string
  category: string
  participants: Participant[]
  maxParticipants?: number
  duration?: string
  venue?: string
  requirements?: string
  startTime: Timestamp | null
  adminActivated: boolean
  showToJudges: boolean
  createdAt: Timestamp
  currentPerformer?: string | null
  // Add judging mode to distinguish between different types of events
  judgingMode: "sequential" | "free-roam" // sequential = normal mode, free-roam = cultural fashion walk
}

// Criterion interface
export interface Criterion {
  id: string
  name: string
  description: string
  percentage: number
  maxScore: number
  isSpecialAward?: boolean
  specialAwardId?: string
  awardName?: string
}

// Criteria interface
export interface Criteria {
  eventId: string
  eventTitle: string
  criteria: Criterion[]
  totalPercentage: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Judging Score interface
export interface JudgingScore {
  id: string
  eventId: string
  judgeId: string
  judgeEmail: string
  participantId: string
  participantName: string
  scores: Record<string, number>
  totalScore: number
  submittedAt: Timestamp
  eventTitle: string
  updatedAt?: Timestamp
}

// Special Award interface
export interface SpecialAward {
  id: string
  name: string
  description: string
  icon: string
  type: "existing" | "new"
  basedOnCriterion?: string
  criterionName?: string
  criterionDescription?: string
  maxScore: number
  createdAt: Date | Timestamp
}

// Admin interface
export interface Admin {
  id: string
  email: string
  fullName?: string
  role: "admin"
  status: "active" | "inactive"
  createdAt: Timestamp
  permissions: {
    manageEvents: boolean
    manageJudges: boolean
    manageParticipants: boolean
    viewReports: boolean
  }
}

// Judge interface
export interface Judge {
  id: string
  email: string
  fullName?: string
  status: "active" | "inactive"
  lastLogin?: Timestamp
  createdAt: Timestamp
}

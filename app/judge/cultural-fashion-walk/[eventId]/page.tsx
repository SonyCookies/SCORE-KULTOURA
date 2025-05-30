"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import KultouraLoading from "@/components/kultoura-loading";
import type {
  Event,
  Criteria,
  Participant,
  Criterion,
  SpecialAward,
} from "@/types";

interface ParticipantScore {
  participantId: string;
  participantName: string;
  scores: Record<string, number>;
  feedback: string;
  totalScore: number;
  submitted: boolean;
  scoreDocId?: string;
  submittedAt?: any;
}

interface CriteriaProgressCircleProps {
  progress: number; // between 0 and 1
  size?: number;
}

function CriteriaProgressCircle({
  progress,
  size = 32,
}: CriteriaProgressCircleProps) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <svg width={size} height={size} className="inline-block mr-2">
      <circle
        stroke="#e5e7eb" // gray-200 background circle
        fill="transparent"
        strokeWidth="4"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      <circle
        stroke="#7c3aed" // purple-600 progress circle
        fill="transparent"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        r={radius}
        cx={size / 2}
        cy={size / 2}
        style={{ transition: "stroke-dashoffset 0.35s ease" }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={size * 0.4}
        fill="#4c1d95" // purple-900
        fontWeight="600"
      >
        {Math.round(progress * 100)}%
      </text>
    </svg>
  );
}

export default function CulturalFashionWalkJudging() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<Event | null>(null);
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [selectedParticipant, setSelectedParticipant] =
    useState<Participant | null>(null);
  const [scores, setScores] = useState<Record<string, ParticipantScore>>({});
  const [loadingScores, setLoadingScores] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [specialAwardCriteria, setSpecialAwardCriteria] = useState<Criterion[]>(
    []
  );
  const [allParticipantScores, setAllParticipantScores] = useState<
    Record<string, boolean>
  >({});

  // Draft score management functions
  const saveDraftScore = async (
    participantId: string,
    criterionId: string,
    score: number
  ) => {
    if (!event || !user) return;

    try {
      const draftKey = `draft_${event.id}_${user.uid}_${participantId}`;
      const currentDrafts = JSON.parse(localStorage.getItem(draftKey) || "{}");

      currentDrafts[criterionId] = score;
      localStorage.setItem(draftKey, JSON.stringify(currentDrafts));
    } catch (error) {
      console.error("Error saving draft score:", error);
    }
  };

  const loadDraftScores = (participantId: string): Record<string, number> => {
    if (!event || !user) return {};

    try {
      const draftKey = `draft_${event.id}_${user.uid}_${participantId}`;
      return JSON.parse(localStorage.getItem(draftKey) || "{}");
    } catch (error) {
      console.error("Error loading draft scores:", error);
      return {};
    }
  };

  const clearDraftScores = (participantId: string) => {
    if (!event || !user) return;

    try {
      const draftKey = `draft_${event.id}_${user.uid}_${participantId}`;
      localStorage.removeItem(draftKey);
    } catch (error) {
      console.error("Error clearing draft scores:", error);
    }
  };

  const hasDraftScores = (participantId: string): boolean => {
    if (!event || !user) return false;

    try {
      const draftKey = `draft_${event.id}_${user.uid}_${participantId}`;
      const drafts = JSON.parse(localStorage.getItem(draftKey) || "{}");
      return Object.keys(drafts).length > 0;
    } catch {
      return false;
    }
  };

  // Load event data including participants and criteria
  const loadEventData = useCallback(async () => {
    try {
      const eventId = params.eventId as string;

      // Load event data
      const eventDoc = await getDoc(doc(db, "events", eventId));
      if (!eventDoc.exists()) {
        setError("Event not found");
        setLoading(false);
        return;
      }

      const eventData = { id: eventDoc.id, ...eventDoc.data() } as Event;

      // Verify this is a Cultural Fashion Walk event
      const isCulturalFashionWalk =
        eventData.judgingMode === "free-roam" ||
        eventData.title?.toLowerCase().includes("cultural fashion walk") ||
        eventData.category?.toLowerCase().includes("cultural fashion walk");

      if (!isCulturalFashionWalk) {
        setError("This page is only for Cultural Fashion Walk events");
        setLoading(false);
        return;
      }

      // Check if event is active and visible to judges
      if (!eventData.adminActivated || !eventData.showToJudges) {
        setError("This event is not currently active for judging");
        setLoading(false);
        return;
      }

      // Fetch participants, either from eventData.participants or Firestore subcollection
      let participants: Participant[] = [];
      if (eventData.participants && eventData.participants.length > 0) {
        participants = eventData.participants;
      } else {
        const participantsQuery = query(
          collection(db, "events", eventId, "participants")
        );
        const participantsSnapshot = await getDocs(participantsQuery);
        participants = participantsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Participant[];
      }

      setEvent({ ...eventData, participants });

      // Load criteria
      const criteriaDoc = await getDoc(doc(db, "eventCriteria", eventId));
      if (criteriaDoc.exists()) {
        setCriteria(criteriaDoc.data() as Criteria);
      }

      // Load all participant scores for this judge
      await loadAllParticipantScores(eventId);

      setLoading(false);
    } catch (error) {
      console.error("[Judging] Error loading event data:", error);
      setError("Failed to load event data");
      setLoading(false);
    }
  }, [params.eventId]);

  // Load participant scores submitted by the current judge
  const loadAllParticipantScores = async (eventId: string) => {
    if (!user) return;

    try {
      const scoresQuery = query(
        collection(db, "judgingScores"),
        where("eventId", "==", eventId),
        where("judgeId", "==", user.uid)
      );

      const scoresSnapshot = await getDocs(scoresQuery);
      const scoredParticipants: Record<string, boolean> = {};

      scoresSnapshot.docs.forEach((doc) => {
        const scoreData = doc.data();
        scoredParticipants[scoreData.participantId] = true;
      });

      setAllParticipantScores(scoredParticipants);
    } catch (error) {
      console.error("[Judging] Error loading participant scores:", error);
    }
  };

  // Load scores (existing or draft) for selected participant
  const loadExistingScores = async (participant: Participant) => {
    if (!participant || !criteria || !user || !event) return;

    setLoadingScores(true);
    try {
      // Load special awards criteria
      const specialAwardsDoc = await getDoc(doc(db, "specialAwards", event.id));
      let additionalCriteria: Criterion[] = [];

      if (specialAwardsDoc.exists()) {
        const specialAwards = specialAwardsDoc.data().awards || [];
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
          }));
      }

      setSpecialAwardCriteria(additionalCriteria);

      // Combine regular criteria with special award criteria
      const allCriteria = [...(criteria?.criteria || [])]; // only main criteria

      // Query for existing scores
      const scoresQuery = query(
        collection(db, "judgingScores"),
        where("eventId", "==", event.id),
        where("judgeId", "==", user.uid),
        where("participantId", "==", participant.id)
      );

      const scoresSnapshot = await getDocs(scoresQuery);

      if (!scoresSnapshot.empty) {
        const existingScore = scoresSnapshot.docs[0];
        const scoreData = existingScore.data();

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
        }));
      } else {
        // Initialize new scores
        const participantScores: Record<string, number> = {};
        allCriteria.forEach((criterion) => {
          participantScores[criterion.id] = 0;
        });

        // Load draft scores if they exist
        const draftScores = loadDraftScores(participant.id);
        Object.keys(draftScores).forEach((criterionId) => {
          if (allCriteria.find((c) => c.id === criterionId)) {
            participantScores[criterionId] = draftScores[criterionId];
          }
        });

        // Calculate total score from draft
        let totalScore = 0;
        for (const criterionId in participantScores) {
          const criterion = criteria?.criteria.find(
            (c) => c.id === criterionId
          );
          if (criterion) {
            totalScore +=
              (participantScores[criterionId] * criterion.percentage) / 100;
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
        }));
      }
    } catch (error) {
      console.error("Error loading existing scores:", error);
      setError("Failed to load existing scores");
    } finally {
      setLoadingScores(false);
    }
  };

  const updateScore = (
    participantId: string,
    criterionId: string,
    score: number
  ) => {
    setScores((prev) => {
      const updated = { ...prev };
      if (!updated[participantId]) return prev;

      updated[participantId] = {
        ...updated[participantId],
        scores: {
          ...updated[participantId].scores,
          [criterionId]: score,
        },
      };

      // Calculate total score
      let totalScore = 0;
      for (const criterionId in updated[participantId].scores) {
        const criterion = criteria?.criteria.find((c) => c.id === criterionId);
        if (criterion) {
          totalScore +=
            (updated[participantId].scores[criterionId] *
              criterion.percentage) /
            100;
        }
      }
      updated[participantId].totalScore = totalScore;

      return updated;
    });

    // Save draft score automatically
    saveDraftScore(participantId, criterionId, score);
  };

  const submitScore = async () => {
    if (!event || !selectedParticipant) return false;

    setSubmitting(true);
    try {
      const participantScore = scores[selectedParticipant.id];
      if (!participantScore) return false;

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
      };

      if (participantScore.scoreDocId) {
        await updateDoc(
          doc(db, "judgingScores", participantScore.scoreDocId),
          scoreData
        );
      } else {
        const docRef = await addDoc(collection(db, "judgingScores"), {
          ...scoreData,
          submittedAt: new Date(),
        });

        setScores((prev) => ({
          ...prev,
          [selectedParticipant.id]: {
            ...prev[selectedParticipant.id],
            scoreDocId: docRef.id,
          },
        }));
      }

      setScores((prev) => ({
        ...prev,
        [selectedParticipant.id]: {
          ...prev[selectedParticipant.id],
          submitted: true,
        },
      }));

      clearDraftScores(selectedParticipant.id);

      setAllParticipantScores((prev) => ({
        ...prev,
        [selectedParticipant.id]: true,
      }));

      setIsEditing(false);
      setShowSubmitDialog(true);
      return true;
    } catch (error) {
      console.error("Error submitting score:", error);
      setError("Failed to submit score. Please try again.");
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const enableEditing = () => {
    if (!selectedParticipant) return;

    setIsEditing(true);
    setScores((prev) => ({
      ...prev,
      [selectedParticipant.id]: {
        ...prev[selectedParticipant.id],
        submitted: false,
      },
    }));
  };

  const selectParticipant = (participant: Participant) => {
    setSelectedParticipant(participant);
    loadExistingScores(participant);
  };

  const returnToParticipantSelection = () => {
    setSelectedParticipant(null);
    setIsEditing(false);
  };

  useEffect(() => {
    if (!user || !params.eventId) {
      router.push("/");
      return;
    }

    loadEventData();
  }, [user, params.eventId, router, loadEventData]);

  if (loading) {
    return <KultouraLoading />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button
            onClick={() => router.push("/")}
            className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-800"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!criteria || !criteria.criteria.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            No Judging Criteria
          </h1>
          <p className="text-gray-600 mb-4">
            This event does not have judging criteria set up.
          </p>
          <Button onClick={() => router.push("/")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Calculate total number of criteria including special awards
  const totalCriteriaCount =
    (criteria?.criteria.length || 0) + specialAwardCriteria.length;

  // Helper to calculate progress for participant based on scores
  function getParticipantProgress(participantId: string): number {
    const participantScore = scores[participantId];
    if (!participantScore) return 0;

    const scoredCount = Object.values(participantScore.scores).filter(
      (score) => score > 0
    ).length;
    return totalCriteriaCount === 0 ? 0 : scoredCount / totalCriteriaCount;
  }

  // Helper to extract number after "#" in participant name
  function getParticipantNumber(name: string): number | null {
    const match = name.match(/#(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  // Participant groups
  const participants = event?.participants || [];
  const msParticipants = participants.filter((p) =>
    p.name.trim().toUpperCase().includes("MS.")
  );
  const mrParticipants = participants.filter((p) =>
    p.name.trim().toUpperCase().includes("MR.")
  );

  msParticipants.sort((a, b) => {
    const numA = getParticipantNumber(a.name);
    const numB = getParticipantNumber(b.name);

    if (numA === null && numB === null) return a.name.localeCompare(b.name);
    if (numA === null) return 1;
    if (numB === null) return -1;

    return numA - numB;
  });

  mrParticipants.sort((a, b) => {
    const numA = getParticipantNumber(a.name);
    const numB = getParticipantNumber(b.name);

    if (numA === null && numB === null) return a.name.localeCompare(b.name);
    if (numA === null) return 1;
    if (numB === null) return -1;

    return numA - numB;
  });

  // Participant selection screen
  if (!selectedParticipant) {
    return (
      <div className="min-h-screen bg-white p-6 max-w-7xl mx-auto">
        {/* Success Dialog */}
        <Dialog open={showSubmitDialog} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                Score Submitted Successfully!
              </DialogTitle>
              <DialogDescription>
                Your score has been submitted. You can continue scoring other
                participants or return to the dashboard.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center gap-3 pt-4">
              <Button
                onClick={() => setShowSubmitDialog(false)}
                variant="outline"
              >
                Score Another Participant
              </Button>
              <Button
                onClick={() => router.push("/")}
                className="bg-green-600 hover:bg-green-700"
              >
                Return to Dashboard
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="mb-6 flex items-center gap-4">
          <Button onClick={() => router.push("/")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-4xl font-bold flex items-center gap-3 text-gray-900">
            <Sparkles className="h-10 w-10 text-purple-600" />
            {event?.title}
          </h1>
        </div>

        {error && (
          <Alert className="border-red-200 bg-red-50 mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <Badge className="bg-gray-100 text-gray-800 border border-gray-300 mb-6 text-lg px-4 py-2">
          Cultural Fashion Walk - Free Selection Judging
        </Badge>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* MS Participants */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-pink-700">
              MS. Participants
            </h2>
            {msParticipants.length === 0 ? (
              <p className="text-pink-700 text-center py-10">
                No MS. participants available
              </p>
            ) : (
              <ul className="space-y-4">
                {msParticipants.map((p) => (
                  <li
                    key={p.id}
                    className={`cursor-pointer flex items-center justify-between border border-pink-300 rounded-lg px-4 py-3 hover:bg-pink-50 ${
                      allParticipantScores[p.id] ? "bg-pink-100" : "bg-white"
                    }`}
                    onClick={() => selectParticipant(p)}
                    title="Click to score"
                  >
                    <div className="flex items-center gap-3">
                      <CriteriaProgressCircle
                        progress={getParticipantProgress(p.id)}
                        size={36}
                      />
                      <span className="font-medium text-pink-800">
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-pink-700">
                        {Math.round(
                          getParticipantProgress(p.id) * totalCriteriaCount
                        )}{" "}
                        / {totalCriteriaCount}
                      </span>
                      {allParticipantScores[p.id] ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          Scored
                        </Badge>
                      ) : hasDraftScores(p.id) ? (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                          Draft
                        </Badge>
                      ) : (
                        <Badge className="bg-pink-100 text-pink-800 border-pink-300">
                          Ready
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* MR Participants */}
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-blue-700">
              MR. Participants
            </h2>
            {mrParticipants.length === 0 ? (
              <p className="text-blue-700 text-center py-10">
                No MR. participants available
              </p>
            ) : (
              <ul className="space-y-4">
                {mrParticipants.map((p) => (
                  <li
                    key={p.id}
                    className={`cursor-pointer flex items-center justify-between border border-blue-300 rounded-lg px-4 py-3 hover:bg-blue-50 ${
                      allParticipantScores[p.id] ? "bg-blue-100" : "bg-white"
                    }`}
                    onClick={() => selectParticipant(p)}
                    title="Click to score"
                  >
                    <div className="flex items-center gap-3">
                      <CriteriaProgressCircle
                        progress={getParticipantProgress(p.id)}
                        size={36}
                      />
                      <span className="font-medium text-blue-800">
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-blue-700">
                        {Math.round(
                          getParticipantProgress(p.id) * totalCriteriaCount
                        )}{" "}
                        / {totalCriteriaCount}
                      </span>
                      {allParticipantScores[p.id] ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          Scored
                        </Badge>
                      ) : hasDraftScores(p.id) ? (
                        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                          Draft
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                          Ready
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    );
  }

  // Scoring interface for selected participant
  const currentScore = scores[selectedParticipant.id];
  const canSubmit =
    currentScore &&
    Object.values(currentScore.scores).every((s) => s > 0) &&
    !currentScore.submitted;
  const hasExistingScore = Boolean(
    currentScore?.scoreDocId && currentScore?.submitted && !isEditing
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Button
              onClick={returnToParticipantSelection}
              variant="outline"
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Participant Selection
            </Button>
            <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900">
              <Sparkles className="h-8 w-8 text-purple-600" />
              Cultural Fashion Walk
            </h1>
            <p className="text-gray-600 mt-1">
              Currently scoring: <strong>{selectedParticipant.name}</strong>
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Loading Scores Alert */}
        {loadingScores && (
          <Alert className="border-blue-200 bg-blue-50">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription className="text-blue-700">
              Loading your previous scores...
            </AlertDescription>
          </Alert>
        )}

        {/* Selected Participant Card */}
        <Card className="border border-gray-300 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Users className="h-5 w-5" />
              Selected Participant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">
                  {selectedParticipant.name}
                </h3>
                <p className="text-gray-700">
                  You can score this participant at any time
                </p>
                {hasExistingScore && currentScore?.submittedAt && (
                  <p className="text-gray-600 text-sm mt-1">
                    Previously scored on:{" "}
                    {currentScore.submittedAt.toDate?.()?.toLocaleString() ||
                      "Unknown"}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-gray-700 text-white text-lg px-4 py-2">
                  SELECTED
                </Badge>
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
          <Card className="border border-gray-300 bg-white">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Scoring: {selectedParticipant.name}
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
              {/* Regular Scoring Criteria */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Main Judging Criteria</h3>
                {criteria.criteria
                  .filter(
                    (criterion) =>
                      !specialAwardCriteria.some(
                        (special) => special.id === criterion.id
                      )
                  )
                  .map((criterion) => (
                    <div
                      key={criterion.id}
                      className="border border-gray-300 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{criterion.name}</h4>
                          <p className="text-gray-600 text-sm mt-1">{criterion.description}</p>
                          <div className="text-xs text-gray-500 mt-1">
                            Weight: {criterion.percentage}%
                          </div>
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
                          onValueChange={(value) =>
                            updateScore(selectedParticipant.id, criterion.id, value[0])
                          }
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
                  <div className="border-t border-gray-300 pt-6">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <Award className="h-5 w-5 text-purple-600" />
                      Special Award Criteria
                    </h3>
                    <p className="text-gray-700 text-sm mt-1">
                      These scores are used for special awards and sashes - they
                      do not count toward the main score
                    </p>
                  </div>

                  {specialAwardCriteria.map((criterion) => (
                    <div
                      key={criterion.id}
                      className="border border-gray-300 rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">
                            {criterion.name}
                          </h4>
                          <p className="text-gray-700 text-sm mt-1">
                            {criterion.description}
                          </p>
                          <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                            <Award className="h-3 w-3 text-purple-600" />
                            Special Award: {criterion.awardName} (Sash)
                          </div>
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
                          onValueChange={(value) =>
                            updateScore(
                              selectedParticipant.id,
                              criterion.id,
                              value[0]
                            )
                          }
                          max={100}
                          min={0}
                          step={0.5}
                          className="w-full"
                          disabled={Boolean(hasExistingScore)}
                        />
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>0%</span>
                          <span>100%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-4 border-t border-gray-300">
                {hasExistingScore ? (
                  <div className="text-center">
                    <p className="text-gray-600 mb-4">
                      You have already scored this participant. Click "Edit
                      Score" above to make changes.
                    </p>
                    <div className="flex justify-center gap-3">
                      <Button
                        onClick={returnToParticipantSelection}
                        variant="outline"
                        size="lg"
                      >
                        Score Another Participant
                      </Button>
                      <Button
                        onClick={() => router.push("/")}
                        variant="outline"
                        size="lg"
                      >
                        Return to Dashboard
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button
                      onClick={submitScore}
                      disabled={!canSubmit || submitting}
                      className="w-full"
                      size="lg"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {currentScore.scoreDocId
                            ? "Updating Score..."
                            : "Submitting Score..."}
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          {currentScore.scoreDocId
                            ? `Update Score for ${selectedParticipant.name}`
                            : `Submit Score for ${selectedParticipant.name}`}
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
          <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-lg">
            <div className="flex items-center justify-between min-w-[280px]">
              <span className="font-semibold text-gray-900 text-lg">
                Total Score:
              </span>
              <span className="text-3xl font-bold text-purple-600">
                {currentScore.totalScore.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface CourseSchedule {
  courseId: string;
  courseTitle: string;
  mode: "online" | "onsite" | "blended";
  trainingDays: string[];
  startDate?: string;
  endDate?: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflictingCourses: { courseId: string; courseTitle: string; sharedDays: string[] }[];
}

/** Detects overlapping training days between a candidate course and already-enrolled courses. */
export function detectScheduleConflicts(
  candidate: CourseSchedule,
  enrolled: CourseSchedule[],
): ConflictResult {
  const conflicting: ConflictResult["conflictingCourses"] = [];
  const candDays = new Set(candidate.trainingDays.map((d) => d.toLowerCase()));
  for (const c of enrolled) {
    if (c.courseId === candidate.courseId) continue;
    // Only online courses have selectable training days; onsite/blended follow term dates.
    const otherDays = new Set(c.trainingDays.map((d) => d.toLowerCase()));
    const shared = [...candDays].filter((d) => otherDays.has(d));
    if (shared.length > 0) {
      conflicting.push({ courseId: c.courseId, courseTitle: c.courseTitle, sharedDays: shared });
    }
  }
  return { hasConflict: conflicting.length > 0, conflictingCourses: conflicting };
}

/** Returns true if two date ranges overlap. */
export function dateRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as <= be && bs <= ae;
}
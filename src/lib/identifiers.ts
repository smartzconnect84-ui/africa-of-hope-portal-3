import type { Program, User } from "@/types";

// Never truncate or hash a UUID into a supposedly unique ID number.
// Records from an older backend retain their full existing ID until upgraded.
export function accountId(user: Pick<User, "id" | "accountNumber">): string {
  return user.accountNumber ? `AOH-ACC-${user.accountNumber.padStart(6, "0")}` : user.id;
}
export function courseId(program: Pick<Program, "id" | "courseNumber">): string {
  return program.courseNumber ? `AOH-CRS-${program.courseNumber.padStart(6, "0")}` : program.id;
}

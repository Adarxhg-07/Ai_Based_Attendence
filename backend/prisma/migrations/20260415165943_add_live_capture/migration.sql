-- CreateTable
CREATE TABLE "attendance_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "captured_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "image_path" TEXT,
    "faces_detected" INTEGER NOT NULL DEFAULT 0,
    "faces_recognized" INTEGER NOT NULL DEFAULT 0,
    "recognized_ids" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_snapshots_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_attendance_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schedule_id" TEXT,
    "course_offering_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "classroom_id" TEXT,
    "session_date" DATETIME NOT NULL,
    "actual_start_time" DATETIME,
    "actual_end_time" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "detection_method" TEXT,
    "recognition_threshold" REAL,
    "notes" TEXT,
    "marked_by" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "submitted_at" DATETIME,
    "finalized_at" DATETIME,
    "live_capture_active" BOOLEAN NOT NULL DEFAULT false,
    "live_capture_started_at" DATETIME,
    "live_capture_stopped_at" DATETIME,
    CONSTRAINT "attendance_sessions_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "attendance_sessions_course_offering_id_fkey" FOREIGN KEY ("course_offering_id") REFERENCES "course_offerings" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "attendance_sessions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "attendance_sessions_classroom_id_fkey" FOREIGN KEY ("classroom_id") REFERENCES "classrooms" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "attendance_sessions_marked_by_fkey" FOREIGN KEY ("marked_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_attendance_sessions" ("actual_end_time", "actual_start_time", "classroom_id", "course_offering_id", "created_at", "detection_method", "finalized_at", "id", "marked_by", "notes", "recognition_threshold", "schedule_id", "session_date", "status", "submitted_at", "teacher_id", "updated_at") SELECT "actual_end_time", "actual_start_time", "classroom_id", "course_offering_id", "created_at", "detection_method", "finalized_at", "id", "marked_by", "notes", "recognition_threshold", "schedule_id", "session_date", "status", "submitted_at", "teacher_id", "updated_at" FROM "attendance_sessions";
DROP TABLE "attendance_sessions";
ALTER TABLE "new_attendance_sessions" RENAME TO "attendance_sessions";
CREATE UNIQUE INDEX "attendance_sessions_course_offering_id_session_date_schedule_id_key" ON "attendance_sessions"("course_offering_id", "session_date", "schedule_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "attendance_snapshots_session_id_idx" ON "attendance_snapshots"("session_id");

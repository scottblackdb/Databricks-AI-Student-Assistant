"""Selectable students (ported from the iOS `Student` enum)."""

STUDENTS = [
    {"id": "0a784c0c-2ea1-449d-ab24-b25f3237631d", "display_name": "Kimberly Dudley", "first_name": "Kimberly"},
    {"id": "710044ee-8b1c-45b0-8565-af3c4bd4167a", "display_name": "Zachary Hicks", "first_name": "Zachary"},
    {"id": "de35a670-1a12-4e2b-a9db-7abc77b1e503", "display_name": "Michael Brown", "first_name": "Michael"},
]

DEFAULT_STUDENT_ID = STUDENTS[0]["id"]

_BY_ID = {s["id"]: s for s in STUDENTS}


def require_student(student_id: str) -> dict[str, str]:
    """Return the student record or raise ValueError for unknown ids."""
    student = _BY_ID.get(student_id)
    if not student:
        raise ValueError(f"Unknown student_id: {student_id}")
    return student

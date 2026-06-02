"""Request/response schemas for the API."""
from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    """One prior chat turn, mapped to an agent input role."""

    is_from_user: bool = Field(alias="isFromUser")
    text: str

    model_config = {"populate_by_name": True}


class ScheduleRequest(BaseModel):
    student_id: str


class MissingAssignmentsRequest(BaseModel):
    student_id: str
    conversation_id: str | None = None


class AskRequest(BaseModel):
    student_id: str
    message: str
    prior_turns: list[ChatTurn] = Field(default_factory=list)
    conversation_id: str | None = None


class TextResponse(BaseModel):
    text: str


class AgentResponse(BaseModel):
    text: str
    conversation_id: str


class StudentOut(BaseModel):
    id: str
    display_name: str
    first_name: str

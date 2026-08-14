from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class DataResponse(BaseModel, Generic[T]):
    data: T


class Pagination(BaseModel):
    page: int
    page_size: int
    total: int


class ListResponse(BaseModel, Generic[T]):
    data: list[T]
    pagination: Pagination | None = None


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorDetail

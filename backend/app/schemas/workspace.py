from pydantic import BaseModel


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    created_at: str

    model_config = {"from_attributes": True}


class WorkspaceUpdate(BaseModel):
    name: str

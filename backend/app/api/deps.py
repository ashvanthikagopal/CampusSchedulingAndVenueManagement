"""
FastAPI dependencies for authentication, database sessions, and role-based access control.
Strictly enforces Section 4 (ROLES AND PRIORITY) of the CIT Problem Statement:
1. Admin (Dean's Office)
2. Department Coordinator
3. Faculty
4. Club Representative
"""
from typing import List, Optional, Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.core.security import decode_access_token
from backend.app.models.entities import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_user_optional(token: Optional[str] = Depends(oauth2_scheme_optional), db: Session = Depends(get_db)) -> Optional[User]:
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


get_optional_user = get_current_user_optional


def block_roles(forbidden_roles: List[str]) -> Callable:
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role in forbidden_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied for role '{current_user.role}'"
            )
        return current_user
    return checker


def require_role(allowed_roles: List[str]) -> Callable:
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role '{current_user.role}'. Required one of: {allowed_roles}"
            )
        return current_user
    return role_checker


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Strictly requires Admin role (Dean's Office)."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user


def require_department_coordinator(current_user: User = Depends(get_current_user)) -> User:
    """Strictly requires Department Coordinator role."""
    if current_user.role != "department_coordinator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Department Coordinator privileges required"
        )
    return current_user


def require_faculty(current_user: User = Depends(get_current_user)) -> User:
    """Strictly requires Faculty role."""
    if current_user.role != "faculty":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Faculty privileges required"
        )
    return current_user


def require_club_representative(current_user: User = Depends(get_current_user)) -> User:
    """Strictly requires Club Representative role."""
    if current_user.role != "club":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Club Representative privileges required"
        )
    return current_user


def require_admin_or_coordinator(current_user: User = Depends(get_current_user)) -> User:
    """Allows Admin or Department Coordinator."""
    if current_user.role not in ("admin", "department_coordinator"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted to Admin or Department Coordinator"
        )
    return current_user


def require_admin_or_faculty(current_user: User = Depends(get_current_user)) -> User:
    """Allows Admin or Faculty."""
    if current_user.role not in ("admin", "faculty"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operation restricted to Admin or Faculty"
        )
    return current_user

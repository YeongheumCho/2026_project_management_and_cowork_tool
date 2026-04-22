"""
모든 SQLAlchemy 모델을 한 번에 등록하기 위한 모듈.

`Base.metadata.create_all` 호출 시 여기서 import 된 모델들만 테이블이 생성된다.
"""
from app.models.base import Base  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.project import (  # noqa: F401
    Project,
    SubProject,
    SubTask,
    STATUS_PLANNED,
    STATUS_IN_PROGRESS,
    STATUS_COMPLETED,
    DEFAULT_SUBTASK_TEMPLATE,
)
from app.models.progress_log import ProgressLog  # noqa: F401
from app.models.workflow import (  # noqa: F401
    ProjectTemplate,
    UserSetting,
    WorkLog,
    WORKLOG_COMPLETED,
    WORKLOG_PAUSED,
    WORKLOG_RUNNING,
)

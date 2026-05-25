"""
Re-export every model module so SQLAlchemy's class registry is fully
populated as soon as `app.models` is imported anywhere. Without this,
lazy imports of individual models (e.g. just `User`) leave inter-model
relationships dangling — `Challan.notifications` can't resolve
`Notification` if its module hasn't been loaded yet.
"""
from app.models import user as user            # noqa: F401
from app.models import vehicle as vehicle      # noqa: F401
from app.models import camera as camera        # noqa: F401
from app.models import detection as detection  # noqa: F401
from app.models import challan as challan      # noqa: F401
from app.models import notification as notification  # noqa: F401
from app.models import system_setting as system_setting  # noqa: F401

from app.models.user import User, RefreshToken, AuditLog  # noqa: F401
from app.models.vehicle import Vehicle  # noqa: F401
from app.models.camera import Camera  # noqa: F401
from app.models.detection import Detection  # noqa: F401
from app.models.challan import Challan  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.system_setting import SystemSetting  # noqa: F401

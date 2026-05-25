from fastapi import APIRouter

from app.api.v1.routers import auth, cameras, challans, detections, analytics, websocket, admin, settings

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(cameras.router)
api_router.include_router(challans.router)
api_router.include_router(detections.router)
api_router.include_router(analytics.router)
api_router.include_router(websocket.router)
api_router.include_router(admin.router)
api_router.include_router(settings.router)

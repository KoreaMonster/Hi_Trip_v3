"""schedules 앱에서 공통으로 사용하는 상수를 모아두는 모듈입니다."""

from typing import Tuple

# Google Places API의 type 값 중 여행 계획에서 가장 자주 사용하는 5가지를 고정으로 제공합니다.
# 이후 ViewSet에서 바로 import 하여 반복 선언을 피하고, 프론트엔드에서도 동일한 순서를 기대할 수 있게 합니다.
FIXED_RECOMMENDATION_PLACE_TYPES: Tuple[str, ...] = (
    "tourist_attraction",  # 대표 관광지
    "museum",              # 박물관
    "park",                # 공원
    "restaurant",          # 식당
    "cafe",                # 카페
)

# Google Routes API가 지원하는 이동 수단 중, 이번 프로젝트에서 사용할 대표 4가지를 고정합니다.
# - DRIVE  : 자동차/택시 이동
# - WALK   : 도보 이동
# - BICYCLE: 자전거 이동
# - TRANSIT: 대중교통 (버스/지하철 등)
# Serializer와 ViewSet에서 동일한 선택지를 사용하기 위해 Tuple 상수로 선언합니다.
SUPPORTED_TRAVEL_MODES: Tuple[str, ...] = (
    "DRIVE",
    "WALK",
    "BICYCLE",
    "TRANSIT",
)

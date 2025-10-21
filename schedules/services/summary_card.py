"""장소 요약 카드 생성을 담당하는 서비스 계층.

- Google API 연동 패턴과 동일하게 "서비스 → Validator → 캐시" 구조를 유지합니다.
- Perplexity 호출은 requests 기반의 간단한 래퍼로 감싸고, 모든 응답을 DB에 저장해 재사용합니다.
- 초보 개발자도 흐름을 추적할 수 있도록 상세한 주석과 docstring을 제공합니다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

import requests
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from schedules.models import Place, PlaceSummaryCard, PlaceUpdate

logger = logging.getLogger(__name__)


class PerplexityError(Exception):
    """Perplexity API 호출 실패를 의미하는 커스텀 예외."""


class SummaryValidationError(Exception):
    """Validator 단계에서 규칙을 위반했을 때 발생하는 예외."""


@dataclass
class SummaryResult:
    """요약 카드 생성을 통해 확보한 핵심 데이터 묶음."""

    lines: List[str]
    sources: List[str]
    raw: Dict[str, Any]
    model: str


class PerplexityClient:
    """Perplexity API 호출을 단일 클래스로 추상화."""

    ENDPOINT = "https://api.perplexity.ai/chat/completions"
    DEFAULT_MODEL = "sonar-small-chat"

    def __init__(self, *, timeout: int = 15):
        self.timeout = timeout

    # ------------------------------------------------------------------
    # 내부 유틸: API 키 확인
    # ------------------------------------------------------------------
    def _require_api_key(self) -> str:
        api_key = getattr(settings, "PERPLEXITY_API_KEY", "")
        if not api_key:
            raise PerplexityError(
                "PERPLEXITY_API_KEY가 설정되어 있지 않습니다. 환경 변수를 확인해주세요."
            )
        return api_key

    # ------------------------------------------------------------------
    # 실제 요청 전송
    # ------------------------------------------------------------------
    def generate_summary(
        self,
        *,
        place: Place,
        base_lines: List[str],
        update_lines: List[str],
        model: Optional[str] = None,
    ) -> SummaryResult:
        """Perplexity에게 요약 생성을 요청하고 결과를 가공합니다."""

        api_key = self._require_api_key()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        model_name = model or getattr(settings, "PERPLEXITY_MODEL", self.DEFAULT_MODEL)

        # 요청 메시지는 "필수 필드 → 기본 설명 → 최신 소식" 순서로 구성합니다.
        hint_url = None
        if isinstance(place.ai_alternative_place, dict):
            hint_url = place.ai_alternative_place.get("hint_url")

        messages = [
            {
                "role": "system",
                "content": (
                    "당신은 여행지 정보를 6줄 이하의 한국어 카드로 요약하는 어시스턴트입니다. "
                    "각 줄은 150자를 넘기지 말고, 마지막 줄에는 반드시 '세부 운영 정보는 앱 내 최신 정보를 참고하세요.'라고 안내하세요."
                ),
            },
            {
                "role": "user",
                "content": {
                    "place_name": place.name,
                    "address": place.address,
                    "category": getattr(place.category, "name", None),
                    "coordinates": {
                        "latitude": float(place.latitude) if place.latitude is not None else None,
                        "longitude": float(place.longitude) if place.longitude is not None else None,
                    },
                    "hint_url": hint_url,
                    "base_lines": base_lines,
                    "recent_updates": update_lines,
                },
            },
        ]

        payload = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.2,
        }

        try:
            response = requests.post(
                self.ENDPOINT, json=payload, headers=headers, timeout=self.timeout
            )
        except requests.RequestException as exc:  # pragma: no cover - 네트워크 예외는 런타임에서만 발생
            logger.exception("Perplexity 요청 중 네트워크 오류", exc_info=exc)
            raise PerplexityError("Perplexity API와 통신할 수 없습니다.") from exc

        if response.status_code != 200:
            raise PerplexityError(
                f"Perplexity 응답 코드가 200이 아닙니다: {response.status_code} / {response.text}"
            )

        data = response.json()
        lines = self._extract_lines(data)
        sources = self._extract_sources(data)
        logger.debug("Perplexity 응답 정제 완료: lines=%s, sources=%s", lines, sources)
        return SummaryResult(lines=lines, sources=sources, raw=data, model=model_name)

    # ------------------------------------------------------------------
    # 응답 파싱 도우미
    # ------------------------------------------------------------------
    def _extract_lines(self, payload: Dict[str, Any]) -> List[str]:
        """choices[0].message.content를 줄 단위로 정제."""

        choices = payload.get("choices") or []
        if not choices:
            raise PerplexityError("Perplexity 응답에 choices 항목이 없습니다.")

        message = choices[0].get("message", {})
        content = message.get("content") or ""
        if isinstance(content, list):
            # 일부 모델은 [{'type': 'text', 'text': '...'}] 형태로 반환합니다.
            text_chunks = [chunk.get("text", "") for chunk in content]
            content = "\n".join(text_chunks)

        lines: List[str] = []
        for raw_line in content.splitlines():
            cleaned = raw_line.strip().lstrip("-•·")
            cleaned = cleaned.strip()
            if cleaned:
                lines.append(cleaned)

        if not lines:
            raise PerplexityError("Perplexity 응답에서 문장을 추출할 수 없습니다.")
        return lines

    def _extract_sources(self, payload: Dict[str, Any]) -> List[str]:
        """응답 내부의 출처 URL을 최대한 수집합니다."""

        sources: List[str] = []
        for field in ("citations", "sources"):
            raw_sources = payload.get(field)
            if isinstance(raw_sources, list):
                for item in raw_sources:
                    if isinstance(item, dict):
                        url = item.get("url") or item.get("source")
                        if url:
                            sources.append(str(url))
                    elif isinstance(item, str):
                        sources.append(item)

        for choice in payload.get("choices", []):
            grounding = choice.get("grounding", {})
            citations = grounding.get("citations")
            if isinstance(citations, list):
                for citation in citations:
                    url = citation.get("url") if isinstance(citation, dict) else None
                    if url:
                        sources.append(str(url))
        # 중복 제거
        seen = set()
        unique_sources = []
        for src in sources:
            if src not in seen:
                seen.add(src)
                unique_sources.append(src)
        return unique_sources


class SummaryValidator:
    """Perplexity 결과물이 팀 규칙을 따르는지 검사."""

    SAFE_SENTENCE = "세부 운영 정보는 앱 내 최신 정보를 참고하세요."
    MIN_LINES = 1
    MAX_LINES = 6
    MAX_LINE_LENGTH = 150

    def __init__(self, *, recent_updates: Iterable[PlaceUpdate]):
        self.recent_updates = list(recent_updates)

    def validate(self, result: SummaryResult) -> None:
        errors: List[str] = []
        self._validate_line_counts(result.lines, errors)
        self._validate_line_length(result.lines, errors)
        self._validate_safe_sentence(result.lines, errors)
        self._validate_sources(result.sources, errors)
        self._validate_recent_updates(errors)
        if errors:
            raise SummaryValidationError("; ".join(errors))

    # ------------------------------------------------------------------
    # 세부 검증 메서드
    # ------------------------------------------------------------------
    def _validate_line_counts(self, lines: List[str], errors: List[str]) -> None:
        if not (self.MIN_LINES <= len(lines) <= self.MAX_LINES):
            errors.append(
                f"줄 수는 {self.MIN_LINES}~{self.MAX_LINES} 범위여야 합니다. 현재: {len(lines)}줄"
            )

    def _validate_line_length(self, lines: List[str], errors: List[str]) -> None:
        for idx, line in enumerate(lines, start=1):
            if len(line) > self.MAX_LINE_LENGTH:
                errors.append(f"{idx}번째 줄이 150자를 초과했습니다 ({len(line)}자).")

    def _validate_safe_sentence(self, lines: List[str], errors: List[str]) -> None:
        if not lines:
            return
        if self.SAFE_SENTENCE not in lines[-1]:
            errors.append("마지막 줄에 안전 안내 문구가 포함되어야 합니다.")

    def _validate_sources(self, sources: List[str], errors: List[str]) -> None:
        for url in sources:
            if not isinstance(url, str) or not url.startswith("http"):
                errors.append("출처 URL 형식이 올바르지 않습니다.")
                break

    def _validate_recent_updates(self, errors: List[str]) -> None:
        if not self.recent_updates:
            return
        if not any(update.is_recent for update in self.recent_updates):
            errors.append("14일 이내의 최신 소식이 존재하지 않습니다.")


class SummaryCardService:
    """PlaceSummaryCard 모델을 중심으로 한 고수준 서비스."""

    def __init__(self, *, client: Optional[PerplexityClient] = None):
        self.client = client or PerplexityClient()

    # ------------------------------------------------------------------
    # 외부 인터페이스
    # ------------------------------------------------------------------
    def get_or_create_card(self, place: Place) -> PlaceSummaryCard:
        card, _ = PlaceSummaryCard.objects.get_or_create(place=place)
        return card

    def generate(
        self,
        *,
        place: Place,
        requested_by,
        force_refresh: bool = False,
    ) -> PlaceSummaryCard:
        """캐시 확인 → 필요 시 Perplexity 호출 → Validator → 저장 순서."""

        card = self.get_or_create_card(place)
        if card.is_cache_valid and not force_refresh:
            logger.info("요약 카드 캐시 재사용: place_id=%s", place.pk)
            return card

        recent_updates = list(card.updates.recent().order_by("-published_at"))
        base_lines = self.build_basic_lines(place)
        update_lines = self.build_recent_updates_lines(recent_updates)

        try:
            result = self.client.generate_summary(
                place=place, base_lines=base_lines, update_lines=update_lines
            )
        except PerplexityError as exc:
            logger.warning("Perplexity 호출 실패. 기존 캐시를 반환합니다: %s", exc)
            if card.generated_lines:
                return card
            raise

        validator = SummaryValidator(recent_updates=recent_updates)
        try:
            validator.validate(result)
        except SummaryValidationError as exc:
            logger.error("Validator 실패. 기존 캐시를 반환합니다: %s", exc)
            if card.generated_lines:
                return card
            raise

        with transaction.atomic():
            card.generated_lines = result.lines
            card.sources = result.sources
            card.ai_response = result.raw
            card.generator = result.model
            card.generated_at = timezone.now()
            card.cached_at = card.generated_at
            card.created_by = requested_by
            card.save()
        return card

    def get_cached(self, place: Place) -> Optional[PlaceSummaryCard]:
        try:
            return place.summary_card
        except PlaceSummaryCard.DoesNotExist:
            return None

    # ------------------------------------------------------------------
    # 빌더 메서드: 프롬프트 구조 정리
    # ------------------------------------------------------------------
    @staticmethod
    def build_basic_lines(place: Place) -> List[str]:
        lines: List[str] = []
        lines.append(f"장소명: {place.name}")
        if place.address:
            lines.append(f"주소: {place.address}")
        if place.category:
            lines.append(f"카테고리: {place.category.name}")
        if place.latitude is not None and place.longitude is not None:
            lines.append(f"좌표: {place.latitude}, {place.longitude}")
        hint_url = None
        if isinstance(place.ai_alternative_place, dict):
            hint_url = place.ai_alternative_place.get("hint_url")
        if hint_url:
            lines.append(f"hint_url: {hint_url}")
        return lines

    @staticmethod
    def build_recent_updates_lines(updates: Iterable[PlaceUpdate]) -> List[str]:
        results: List[str] = []
        for update in updates:
            line = f"{update.title} - {update.description.strip()}"
            if update.source_url:
                line += f" (출처: {update.source_url})"
            results.append(line)
        return results


__all__ = [
    "PerplexityClient",
    "PerplexityError",
    "SummaryCardService",
    "SummaryResult",
    "SummaryValidationError",
    "SummaryValidator",
]
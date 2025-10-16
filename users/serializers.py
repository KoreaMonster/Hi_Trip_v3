from rest_framework import serializers
from django.contrib.auth import get_user_model

from users.models import Traveler

User = get_user_model()

class UserSerialization(serializers.ModelSerializer):
    """직원 회원가입 및 정보 직렬화"""
    password = serializers.CharField(write_only=True, min_length=8)
    # 보안 설정 -> 서버가 사용자에게 응답 보낼 때, 비밀번호를 포함하지 않도록
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    # 사용자에게 '총괄담당자', '담당자' 같은 한글로 보여주기 위함

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "phone",
            "first_name",
            "last_name",  # 영문 분리
            "first_name_kr",
            "last_name_kr",  # 한글 분리
            "full_name_kr",
            "full_name_en",  # 전체 이름 (추가)
            "role",
            "role_display",
            "is_approved",
        ]
        read_only_fields = [
            "id",
            "role_display",
            "is_approved",
            "full_name_kr",
            "full_name_en",
        ]

    def create(self, validated_data):
        """새 사용자를 생성할 때 필요한 전처리를 담당합니다."""

        # 초보자를 위한 설명:
        # - ``validated_data``에는 serializer에서 허용한 모든 필드가 들어옵니다.
        # - ``create_user``는 비밀번호를 자동으로 해싱하므로 ``pop``으로 꺼내 전달합니다.
        password = validated_data.pop("password")

        # - ``create_user``는 나머지 키워드 인자를 그대로 받아 DB 필드에 채워 줍니다.
        #   (role, phone, first_name_kr 등 커스텀 필드 포함)
        user = User.objects.create_user(password=password, **validated_data)

        # - ``create`` 메서드는 ``serializer.save()``에서 호출되며, 반환값이 응답에 쓰입니다.
        return user

class UserDetailSerializer(serializers.ModelSerializer):
    """직원 정보를 조회 응답으로 제공할 때 사용하는 읽기 전용 Serializer."""

    # 초보 개발자도 헷갈리지 않도록 "회원가입"과 "정보 조회"가 서로 다른
    # 목적을 가진다는 점을 코드 수준에서 명시합니다. ViewSet에서 이 클래스를
    # 사용하면 작성(create)과 조회(read) 단계가 자연스럽게 분리되어, 향후
    # 권한별 응답 정책을 조정하기가 훨씬 수월해집니다.

    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "phone",
            "first_name",
            "last_name",
            "first_name_kr",
            "last_name_kr",
            "full_name_kr",
            "full_name_en",
            "role",
            "role_display",
            "is_approved",
        ]
        read_only_fields = fields


class LoginSerializer(serializers.Serializer):
    """로그인 요청 검증"""
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class TravelerSerializer(serializers.ModelSerializer):
    """
    여행자 정보 직렬화
    TripParticipant에서 참가자 정보 표시용
    """

    class Meta:
        model = Traveler
        fields = [
            'id',
            'last_name_kr',
            'first_name_kr',
            'full_name_kr',
            'first_name_en',
            'last_name_en',
            'phone',
            'email',
            'birth_date',
            'gender'
        ]
        read_only_fields = ['id', 'full_name_kr']
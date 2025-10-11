from rest_framework import serializers
from django.contrib.auth import get_user_model

from users.models import Traveler

User = get_user_model()

class UserSerialization(serializers.ModelSerializer):
    """직원 회원가입 및 정보 직렬화"""
    password = serializers.CharField(write_only=True, min_length=8)
    #보안 설정 -> 서버가 사용자에게 응답 보낼 때, 비밀번호를 포함하지 않도록
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    # 사용자에게 '총괄담당자', '담당자' 같은 한글로 보여주기 위함

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password', 'phone',
            'first_name', 'last_name',  # 영문 분리
            'first_name_kr', 'last_name_kr',  # 한글 분리
            'full_name_kr', 'full_name_en',  # 전체 이름 (추가)
            'role', 'role_display', 'is_approved',
        ]

        read_only_fields = ['id', 'role_display', 'is_approved', 'full_name_kr', 'full_name_en']

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
            phone=validated_data.get('phone', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            first_name_kr = validated_data.get('first_name_kr', ''),
            last_name_kr = validated_data.get('last_name_kr', '')
        )
        return user


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
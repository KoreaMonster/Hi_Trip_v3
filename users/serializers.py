from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerialization(serializers.ModelSerializer):
    """직원 회원가입 및 정보 직렬화"""
    password = serializers.CharField(write_only=True, min_length=8)
    #보안 설정 -> 서버가 사용자에게 응답 보낼 때, 비밀번호를 포함하지 않도록

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'phone',
                  'first_name', 'last_name', 'first_name_kr', 'last_name_kr',]


        read_only_fields = ['id']

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
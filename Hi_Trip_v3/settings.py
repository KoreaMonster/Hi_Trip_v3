from pathlib import Path
from decouple import config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = 'django-insecure-l(i$#zrc*y$ry$5pm&0eef5q$=_7jvfmiy7xz=5h6dpkr7kj7)'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    'diphthongic-unluxuriantly-elle.ngrok-free.dev',
    '18.194.229.54',
    '*',
]


# 로컬 개발 시 사용할 수 있는 기본 프런트엔드 오리진 목록입니다.
# 필요하다면 FRONTEND_ORIGINS 환경 변수에 콤마로 구분해 추가 값을 지정하세요.
DEFAULT_FRONTEND_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://0.0.0.0:3000",
    "http://[::1]:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def _parse_origin_list(raw_value: str | None, fallback: list[str]) -> list[str]:
    if not raw_value:
        return fallback

    parsed = [item.strip() for item in raw_value.split(",") if item.strip()]
    return parsed or fallback


FRONTEND_ORIGINS = _parse_origin_list(
    config("FRONTEND_ORIGINS", default=",".join(DEFAULT_FRONTEND_ORIGINS)),
    DEFAULT_FRONTEND_ORIGINS,
)

# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party apps
    'rest_framework',
    'corsheaders',
    'drf_spectacular',
    'django_extensions',
    #Local Apps
    "users.apps.UsersConfig",
    'trips.apps.TripsConfig',
    'schedules.apps.SchedulesConfig',
    "notices.apps.NoticesConfig",
    'locations.apps.LocationsConfig',
    'monitoring.apps.MonitoringConfig',  # 건강/위치 모니터링 전용 앱

]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # CORS 최상단 배치
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# PostgreSQL 설정
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME', default='hitrip_db'),
        'USER': config('DB_USER', default='postgres'),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='5432'),
    }
}


# CORS 설정
CORS_ALLOWED_ORIGINS = FRONTEND_ORIGINS
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://(?:10|192\.168)\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}:[0-9]{2,5}$",
    r"^http://172\.(?:1[6-9]|2[0-9]|3[0-1])\.[0-9]{1,3}\.[0-9]{1,3}:[0-9]{2,5}$",
]
CORS_ALLOW_CREDENTIALS = True  # 🔑 이게 핵심!

CSRF_TRUSTED_ORIGINS = list(dict.fromkeys(FRONTEND_ORIGINS + ["http://localhost:8000"]))

# REST Framework 설정
REST_FRAMEWORK = {
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
}

# Swagger 설정
SPECTACULAR_SETTINGS = {
    'TITLE': 'Hi Trip API',
    'DESCRIPTION': 'Hi Trip MVP API Documentation',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

AUTH_USER_MODEL = 'users.User'

ROOT_URLCONF = 'Hi_Trip_v3.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates']
        ,
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'Hi_Trip_v3.wsgi.application'


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = 'static/'

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Google Maps API 키를 모든 앱에서 공통으로 사용할 수 있도록 설정 파일에서 불러옵니다.
# .env 파일에 GOOGLE_MAPS_API_KEY 값을 추가한 뒤, config 함수가 값을 찾지 못하면
# 기본값으로 빈 문자열을 반환해 개발 환경에서도 안전하게 동작하도록 합니다.
GOOGLE_MAPS_API_KEY = config("GOOGLE_MAPS_API_KEY", default="")
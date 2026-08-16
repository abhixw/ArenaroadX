from app.core.config import Settings, validate_production_config


def _base_kwargs(**overrides) -> dict:
    kwargs = dict(
        ENVIRONMENT="production",
        DEBUG=False,
        MONGODB_URL="mongodb+srv://user:pass@cluster.example.mongodb.net/",
        JWT_SECRET_KEY="a" * 64,
        COOKIE_SECURE=True,
        COOKIE_SAMESITE="none",
        CORS_ORIGINS="https://arenaroadx.vercel.app",
        RAZORPAY_KEY_ID="rzp_live_abcdefghijklmn",
        RAZORPAY_KEY_SECRET="a_real_looking_live_secret_value",
        RAZORPAY_WEBHOOK_SECRET="a_real_looking_webhook_secret",
        SMTP_HOST="smtp.example.com",
        FRONTEND_URL="https://arenaroadx.vercel.app",
    )
    kwargs.update(overrides)
    return kwargs


def test_development_environment_is_never_flagged():
    s = Settings(ENVIRONMENT="development", MONGODB_URL="mongodb://localhost", JWT_SECRET_KEY="short")
    assert validate_production_config(s) == []


def test_fully_valid_production_config_passes():
    s = Settings(**_base_kwargs())
    assert validate_production_config(s) == []


def test_debug_true_in_production_is_flagged():
    s = Settings(**_base_kwargs(DEBUG=True))
    problems = validate_production_config(s)
    assert any("DEBUG" in p for p in problems)


def test_short_or_placeholder_jwt_secret_is_flagged():
    s = Settings(**_base_kwargs(JWT_SECRET_KEY="dev-secret-change-me"))
    problems = validate_production_config(s)
    assert any("JWT_SECRET_KEY" in p for p in problems)


def test_insecure_cookie_is_flagged():
    s = Settings(**_base_kwargs(COOKIE_SECURE=False))
    problems = validate_production_config(s)
    assert any("COOKIE_SECURE" in p for p in problems)


def test_placeholder_webhook_secret_is_flagged():
    s = Settings(**_base_kwargs(RAZORPAY_WEBHOOK_SECRET="placeholder_webhook_secret"))
    problems = validate_production_config(s)
    assert any("RAZORPAY_WEBHOOK_SECRET" in p for p in problems)


def test_razorpay_test_mode_key_is_flagged():
    s = Settings(**_base_kwargs(RAZORPAY_KEY_ID="rzp_test_TQBDJAUwwIjXDn"))
    problems = validate_production_config(s)
    assert any("TEST-mode" in p for p in problems)


def test_localhost_cors_origin_is_flagged():
    s = Settings(**_base_kwargs(CORS_ORIGINS="http://localhost:5173"))
    problems = validate_production_config(s)
    assert any("CORS_ORIGINS" in p for p in problems)


def test_missing_smtp_host_is_flagged():
    s = Settings(**_base_kwargs(SMTP_HOST=""))
    problems = validate_production_config(s)
    assert any("SMTP_HOST" in p for p in problems)


def test_localhost_frontend_url_is_flagged():
    s = Settings(**_base_kwargs(FRONTEND_URL="http://localhost:5173"))
    problems = validate_production_config(s)
    assert any("FRONTEND_URL" in p for p in problems)

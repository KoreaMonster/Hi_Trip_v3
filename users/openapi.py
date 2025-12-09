from drf_spectacular.extensions import OpenApiAuthenticationExtension
from drf_spectacular.plumbing import build_bearer_security_scheme_object

from .authentication import DemoAuthentication


class DemoAuthenticationScheme(OpenApiAuthenticationExtension):
    """Expose DemoAuthentication as a bearer-like scheme for docs."""

    target_class = "users.authentication.DemoAuthentication"
    name = "DemoAuth"

    def get_security_definition(self, auto_schema):
        # Mark as HTTP bearer for visibility; token value is ignored in DEMO_MODE.
        return build_bearer_security_scheme_object(
            header_name="Authorization",
            token_prefix="Bearer",
        )


__all__ = ["DemoAuthenticationScheme"]

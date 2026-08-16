from app.integrations.base import GameIntegration
from app.integrations.chess_com import ChessComIntegration

# Add a new provider by implementing GameIntegration and registering it here -- everything
# above this file (game_account_service, the routers) is written against the abstract
# GameIntegration interface, not this specific provider.
REGISTRY: dict[str, GameIntegration] = {
    "chess_com": ChessComIntegration(),
}


def get_integration(key: str) -> GameIntegration | None:
    return REGISTRY.get(key)

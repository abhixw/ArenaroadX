"""Seed the reference set of games. Safe to run multiple times (idempotent by name).

Usage:
    python -m scripts.seed_games
"""

import asyncio

from app.core.database import init_db
from app.models import ALL_DOCUMENT_MODELS
from app.repositories import game_repository

GAMES = [
    {"name": "Chess", "description": "Classic strategy board game.", "game_type": "STRATEGY", "image_url": None},
    {
        "name": "Smash Karts",
        "description": "Fast-paced multiplayer kart battle arena.",
        "game_type": "RACING",
        "image_url": None,
    },
    {
        "name": "BGMI",
        "description": "Battlegrounds Mobile India, a battle royale shooter.",
        "game_type": "BATTLE_ROYALE",
        "image_url": None,
    },
    {
        "name": "Free Fire",
        "description": "Fast-paced mobile battle royale shooter.",
        "game_type": "BATTLE_ROYALE",
        "image_url": None,
    },
]


async def seed_games() -> None:
    await init_db(document_models=ALL_DOCUMENT_MODELS)

    for game_data in GAMES:
        existing = await game_repository.get_by_name(game_data["name"])
        if existing is not None:
            print(f"Skipping existing game: {game_data['name']}")
            continue
        game = await game_repository.create(**game_data)
        print(f"Created game: {game.name} (id={game.id})")


if __name__ == "__main__":
    asyncio.run(seed_games())

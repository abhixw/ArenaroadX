"""Create one demo tournament with an open registration window so the player frontend has
something to show. `seed_games.py` only seeds games -- there's no tournament until an admin
creates one via the API, which is what this script automates for local/dev use. Safe to run
multiple times (skips if a tournament with this name exists).

Deliberately does NOT create a match: match_service.create_match() snapshots its roster from
confirmed registrations at creation time (MVP simplification, see that function's docstring),
so a match created before anyone has registered would end up with an empty roster forever.
Register as a player first, then create the match afterwards via /docs
(POST /api/admin/tournaments/{tournament_id}/matches) if you want to test match/room access.

Usage:
    python -m scripts.seed_demo_tournament
"""

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.core.database import init_db
from app.models import ALL_DOCUMENT_MODELS
from app.repositories import game_repository, tournament_repository
from app.schemas.tournament import TournamentCreate
from app.services import tournament_service

DEMO_TOURNAMENT_NAME = "BGMI Night Cup (Demo)"


async def seed_demo_tournament() -> None:
    await init_db(document_models=ALL_DOCUMENT_MODELS)

    game = await game_repository.get_by_name("BGMI")
    if game is None:
        print("Game 'BGMI' not found -- run `python -m scripts.seed_games` first.")
        raise SystemExit(1)

    existing = await tournament_repository.list_all(game_id=None, status=None)
    if any(t.name == DEMO_TOURNAMENT_NAME for t in existing):
        print(f"Demo tournament already exists: {DEMO_TOURNAMENT_NAME}")
        return

    now = datetime.now(timezone.utc)
    start_time = now + timedelta(hours=2)
    registration_deadline = now + timedelta(hours=1, minutes=45)

    tournament = await tournament_service.create_tournament(
        TournamentCreate(
            game_id=game.id,
            name=DEMO_TOURNAMENT_NAME,
            description="Prime-time squad showdown across Erangel and Miramar.",
            entry_fee=Decimal("25"),
            prize_pool=Decimal("20000"),
            max_players=100,
            start_time=start_time,
            registration_deadline=registration_deadline,
            rules="Squad mode, 4 players per team.\nNo teaming across squads.\nEmulator use is prohibited.",
            instructions="Room ID/password are shared here once the join window opens.",
        )
    )
    tournament = await tournament_service.open_registration(tournament.id)
    print(f"Created tournament: {tournament.name} (id={tournament.id}), status={tournament.status.value}")
    print("Registration is open. To test match/room access (as admin, via /docs):")
    print(f"  POST /api/admin/tournaments/{tournament.id}/matches")
    print("Confirmed registrants are picked up automatically even if they register after the")
    print("match is created (match_service.get_match_access lazily joins them in).")
    print("To progress the tournament toward LIVE (as admin, via /docs), in order:")
    print(f"  POST /api/admin/tournaments/{tournament.id}/close-registration")
    print(f"  POST /api/admin/tournaments/{tournament.id}/mark-ready")
    print(f"  POST /api/admin/tournaments/{tournament.id}/start")


if __name__ == "__main__":
    asyncio.run(seed_demo_tournament())

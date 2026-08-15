import pytest
from beanie import PydanticObjectId

from app.models.payment import Payment, PaymentStatus

pytestmark = pytest.mark.asyncio


async def test_admin_users_list_is_paginated(client, as_admin, user_factory):
    for i in range(5):
        await user_factory(email=f"paged{i}@example.com")

    first_page = await client.get("/api/admin/users", params={"page": 1, "page_size": 3})
    assert first_page.status_code == 200
    body = first_page.json()
    assert len(body["data"]) == 3
    # as_admin's own user plus the 5 created here.
    assert body["pagination"] == {"page": 1, "page_size": 3, "total": 6}

    second_page = await client.get("/api/admin/users", params={"page": 2, "page_size": 3})
    assert len(second_page.json()["data"]) == 3

    third_page = await client.get("/api/admin/users", params={"page": 3, "page_size": 3})
    assert third_page.json()["data"] == []


async def test_admin_payments_list_is_paginated(client, as_admin, user_factory):
    player = await user_factory(email="payer@example.com")
    tournament_id = PydanticObjectId()
    registration_id = PydanticObjectId()

    for i in range(4):
        await Payment(
            user_id=player.id,
            tournament_id=tournament_id,
            registration_id=registration_id,
            amount_paise=5000,
            razorpay_order_id=f"order_{i}",
            status=PaymentStatus.CAPTURED,
        ).insert()

    first_page = await client.get("/api/admin/payments", params={"page": 1, "page_size": 2})
    assert first_page.status_code == 200
    body = first_page.json()
    assert len(body["data"]) == 2
    assert body["pagination"] == {"page": 1, "page_size": 2, "total": 4}

    second_page = await client.get("/api/admin/payments", params={"page": 2, "page_size": 2})
    assert len(second_page.json()["data"]) == 2

    third_page = await client.get("/api/admin/payments", params={"page": 3, "page_size": 2})
    assert third_page.json()["data"] == []

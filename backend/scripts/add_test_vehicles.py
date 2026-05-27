import asyncio
from datetime import date, timedelta
from app.db.session import AsyncSessionFactory
from app.models.vehicle import Vehicle, Owner
from app.core.constants import VehicleCategory
from sqlalchemy import select

async def add_vehicles():
    async with AsyncSessionFactory() as session:
        # Check if vehicles exist
        for plate, reg_d, ins_d, pol_d in [
            ("MH12AB1234", 180, 180, 90),
            ("MH14CD5678", -30, -30, -15)
        ]:
            res = await session.execute(select(Vehicle).where(Vehicle.plate_number == plate))
            v = res.scalar_one_or_none()
            if not v:
                # get any owner or create one
                ores = await session.execute(select(Owner).limit(1))
                owner = ores.scalar_one_or_none()
                if not owner:
                    owner = Owner(name="Test Owner", phone="9876543210")
                    session.add(owner)
                    await session.flush()
                
                v = Vehicle(
                    plate_number=plate,
                    category=VehicleCategory.CAR,
                    make="Test",
                    model_name="TestModel",
                    color="White",
                    year=2020,
                    registration_expiry=date.today() + timedelta(days=reg_d),
                    insurance_expiry=date.today() + timedelta(days=ins_d),
                    pollution_expiry=date.today() + timedelta(days=pol_d),
                    owner_id=owner.id
                )
                session.add(v)
                print(f"Added {plate}")
        await session.commit()

if __name__ == "__main__":
    asyncio.run(add_vehicles())

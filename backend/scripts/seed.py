"""Seed demo data for development/demo purposes.

Usage: cd backend && python -m scripts.seed
"""

import io
import csv
import math
import random
import uuid
from datetime import datetime, timedelta, date

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.models.user import User
from app.models.workspace import Workspace
from app.models.dataset import Dataset


def generate_sample_csv(n_weeks: int = 104) -> str:
    """Generate a realistic marketing CSV with known patterns."""
    random.seed(42)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["date", "revenue", "google_ads", "facebook", "tv", "email", "is_holiday"])

    start = datetime(2023, 1, 2)  # First Monday of 2023

    for i in range(n_weeks):
        dt = start + timedelta(weeks=i)
        week_of_year = dt.isocalendar()[1]

        # Seasonality (peak in Q4)
        season = 1 + 0.3 * math.sin(2 * math.pi * (week_of_year - 13) / 52)

        # Channel spends with some correlation
        google = max(0, random.gauss(5000, 1500) * season)
        facebook = max(0, random.gauss(3000, 1000) * season)
        tv = max(0, random.gauss(8000, 3000)) if week_of_year % 4 == 0 else max(0, random.gauss(2000, 800))
        email_spend = max(0, random.gauss(500, 200))

        # Holiday flag (Black Friday week, Christmas, etc.)
        is_holiday = 1 if week_of_year in [47, 48, 51, 52, 1] else 0

        # Revenue = base + channel effects + noise
        base = 50000 * season
        google_effect = google * 2.5 * (1 - google / 20000)  # Diminishing returns
        facebook_effect = facebook * 1.8 * (1 - facebook / 15000)
        tv_effect = tv * 1.2 * (1 - tv / 30000)
        email_effect = email_spend * 3.0
        holiday_effect = 15000 * is_holiday

        revenue = base + google_effect + facebook_effect + tv_effect + email_effect + holiday_effect
        revenue += random.gauss(0, 3000)  # Noise
        revenue = max(0, revenue)

        writer.writerow([
            dt.strftime("%Y-%m-%d"),
            round(revenue, 2),
            round(google, 2),
            round(facebook, 2),
            round(tv, 2),
            round(email_spend, 2),
            is_holiday,
        ])

    return buf.getvalue()


def seed():
    settings = get_settings()
    engine = create_engine(settings.database_url_sync)

    with Session(engine) as db:
        # Check if demo user already exists
        existing = db.execute(select(User).where(User.email == "demo@mixmodel.app")).scalar_one_or_none()
        if existing:
            print("Demo user already exists. Skipping seed.")
            return

        # Create workspace
        workspace_id = str(uuid.uuid4())
        workspace = Workspace(
            id=workspace_id,
            name="Demo Marketing Team",
        )
        db.add(workspace)
        db.flush()
        print(f"Created workspace: {workspace.name} ({workspace_id})")

        # Create demo user
        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            email="demo@mixmodel.app",
            hashed_password=hash_password("demo123"),
            full_name="Demo User",
            role="admin",
            workspace_id=workspace_id,
        )
        db.add(user)
        db.flush()
        print(f"Created user: {user.email} (password: demo123)")

        # Generate and upload CSV
        csv_content = generate_sample_csv()
        dataset_id = str(uuid.uuid4())
        s3_key = f"datasets/{workspace_id}/{dataset_id}/demo_marketing_data.csv"

        try:
            from app.services.storage import StorageService

            storage = StorageService()
            storage.upload_file(s3_key, csv_content.encode(), "text/csv")
            print(f"Uploaded CSV to S3: {s3_key}")
        except Exception as e:
            print(f"Warning: Could not upload to S3 ({e}). Dataset record created without S3 file.")

        # Create dataset record
        dataset = Dataset(
            id=dataset_id,
            workspace_id=workspace_id,
            uploaded_by=user_id,
            filename="demo_marketing_data.csv",
            s3_key=s3_key,
            row_count=104,
            date_range_start=date(2023, 1, 2),
            date_range_end=date(2024, 12, 30),
            frequency="weekly",
            status="validated",
            column_mapping={
                "date_column": "date",
                "target_column": "revenue",
                "media_columns": {
                    "google_ads": {"channel_name": "Google Ads", "spend_type": "spend"},
                    "facebook": {"channel_name": "Facebook", "spend_type": "spend"},
                    "tv": {"channel_name": "TV", "spend_type": "spend"},
                    "email": {"channel_name": "Email", "spend_type": "spend"},
                },
                "control_columns": ["is_holiday"],
            },
        )
        db.add(dataset)
        db.commit()
        print(f"Created dataset: {dataset.filename} ({dataset.id})")
        print("\nSeed complete! Login with demo@mixmodel.app / demo123")


if __name__ == "__main__":
    seed()

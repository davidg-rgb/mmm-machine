"""S3/MinIO storage service for file uploads and model artifacts."""

import io
import logging

import boto3
from botocore.exceptions import ClientError

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class StorageService:
    def __init__(self):
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            region_name=settings.s3_region,
        )
        self.bucket = settings.s3_bucket_name
        self._ensure_bucket()

    def _ensure_bucket(self):
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError:
            self.client.create_bucket(Bucket=self.bucket)
            logger.info(f"Created bucket: {self.bucket}")

    def upload_file(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return key

    def download_file(self, key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()

    def download_csv(self, key: str):
        """Download a CSV file from S3 and return as a pandas DataFrame."""
        import pandas as pd

        data = self.download_file(key)
        return pd.read_csv(io.BytesIO(data))

    def delete_file(self, key: str):
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except ClientError:
            logger.warning(f"Failed to delete S3 object: {key}")

    def delete_prefix(self, prefix: str):
        """Delete all objects under a given prefix."""
        try:
            paginator = self.client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
                for obj in page.get("Contents", []):
                    self.client.delete_object(Bucket=self.bucket, Key=obj["Key"])
        except ClientError:
            logger.warning(f"Failed to delete S3 prefix: {prefix}")

    def generate_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

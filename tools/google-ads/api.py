#!/usr/bin/env python3
"""
Google Ads API wrapper for nonprofit automation.

Handles authentication and common operations against the Google Ads API.
Designed to work with the Yeshua Academy nonprofit Google Ad Grants account.
"""

import json
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    # Ensure setuptools is available for pkg_resources
    import setuptools  # noqa: F401
    from google.ads.googleads.client import GoogleAdsClient
    from google.api_core.exceptions import InvalidArgument, NotFound
    GOOGLE_ADS_AVAILABLE = True
except ImportError as err:
    # Fall back to mock for testing or if library isn't installed
    GOOGLE_ADS_AVAILABLE = False
    GoogleAdsClient = None


class GoogleAdsAPIError(Exception):
    """Base exception for Google Ads API errors."""
    pass


class GoogleAdsAuthError(GoogleAdsAPIError):
    """Authentication/credential error."""
    pass


class GoogleAdsQueryError(GoogleAdsAPIError):
    """Query or API call error."""
    pass


class CampaignSnapshot:
    """Snapshot of a campaign at a point in time."""

    def __init__(
        self,
        google_campaign_id: str,
        campaign_name: str,
        status: str,
        budget_usd: float,
        campaign_type: str,
    ):
        self.google_campaign_id = google_campaign_id
        self.campaign_name = campaign_name
        self.status = status
        self.budget_usd = budget_usd
        self.campaign_type = campaign_type
        self.fetched_at = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "google_campaign_id": self.google_campaign_id,
            "campaign_name": self.campaign_name,
            "status": self.status,
            "budget_usd": self.budget_usd,
            "campaign_type": self.campaign_type,
            "fetched_at": self.fetched_at,
        }


class DailyMetrics:
    """Daily metrics for the account or a specific campaign."""

    def __init__(
        self,
        metrics_date: str,
        campaign_id: Optional[str] = None,
        clicks: int = 0,
        impressions: int = 0,
        spend_usd: float = 0.0,
        conversions: float = 0.0,
        conversion_value: float = 0.0,
    ):
        self.metrics_date = metrics_date
        self.campaign_id = campaign_id
        self.clicks = clicks
        self.impressions = impressions
        self.spend_usd = spend_usd
        self.conversions = conversions
        self.conversion_value = conversion_value
        self.fetched_at = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "metrics_date": self.metrics_date,
            "campaign_id": self.campaign_id,
            "clicks": self.clicks,
            "impressions": self.impressions,
            "spend_usd": self.spend_usd,
            "conversions": self.conversions,
            "conversion_value": self.conversion_value,
            "fetched_at": self.fetched_at,
        }


class SearchTerm:
    """A search term from the account."""

    def __init__(
        self,
        search_term: str,
        campaign_id: str,
        clicks: int,
        impressions: int,
        conversions: float,
        spend_usd: float,
        status: str,
    ):
        self.search_term = search_term
        self.campaign_id = campaign_id
        self.clicks = clicks
        self.impressions = impressions
        self.conversions = conversions
        self.spend_usd = spend_usd
        self.status = status
        self.fetched_at = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "search_term": self.search_term,
            "campaign_id": self.campaign_id,
            "clicks": self.clicks,
            "impressions": self.impressions,
            "conversions": self.conversions,
            "spend_usd": self.spend_usd,
            "status": self.status,
            "fetched_at": self.fetched_at,
        }


class Recommendation:
    """A Google Ads recommendation."""

    def __init__(
        self,
        recommendation_type: str,
        campaign_id: Optional[str],
        priority: str,
        description: str,
        impact_estimate: float,
    ):
        self.recommendation_type = recommendation_type
        self.campaign_id = campaign_id
        self.priority = priority
        self.description = description
        self.impact_estimate = impact_estimate
        self.status = "pending"
        self.fetched_at = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "recommendation_type": self.recommendation_type,
            "campaign_id": self.campaign_id,
            "priority": self.priority,
            "description": self.description,
            "impact_estimate": self.impact_estimate,
            "status": self.status,
            "fetched_at": self.fetched_at,
        }


class GoogleAdsAPI:
    """Wrapper around Google Ads API client."""

    def __init__(
        self,
        developer_token: str,
        customer_id: str,
        login_customer_id: str,
        oauth_client_id: str,
        oauth_client_secret: str,
        refresh_token: str,
    ):
        """
        Initialize the Google Ads API client.

        Args:
            developer_token: Google Ads API developer token
            customer_id: Customer ID (without hyphens)
            login_customer_id: Login/manager customer ID (without hyphens)
            oauth_client_id: OAuth 2.0 client ID
            oauth_client_secret: OAuth 2.0 client secret
            refresh_token: OAuth 2.0 refresh token
        """
        self.developer_token = developer_token
        self.customer_id = customer_id
        self.login_customer_id = login_customer_id
        self.client = None

        if not GOOGLE_ADS_AVAILABLE:
            # In test mode without google-ads library
            return

        # Build credentials dict for GoogleAdsClient
        credentials = {
            "developer_token": developer_token,
            "client_id": oauth_client_id,
            "client_secret": oauth_client_secret,
            "refresh_token": refresh_token,
            "use_proto_plus": True,
        }

        try:
            self.client = GoogleAdsClient.load_from_dict(credentials)
        except Exception as err:
            raise GoogleAdsAuthError(f"Failed to initialize Google Ads client: {err}")

    def fetch_campaigns(self) -> List[CampaignSnapshot]:
        """Fetch all campaigns from the account."""
        query = """
            SELECT campaign.id, campaign.name, campaign.status, campaign.budget_set.base_budget_amount_micros, campaign.advertising_channel_type
            FROM campaign
            ORDER BY campaign.id
        """

        try:
            ga_service = self.client.get_service("GoogleAdsService")
            results = ga_service.search_stream(
                customer_id=self.customer_id,
                query=query,
            )

            campaigns = []
            for batch in results:
                for row in batch.results:
                    campaign = row.campaign
                    budget_usd = (campaign.budget_set.base_budget_amount_micros or 0) / 1_000_000
                    campaigns.append(
                        CampaignSnapshot(
                            google_campaign_id=str(campaign.id),
                            campaign_name=campaign.name or "Unknown",
                            status=campaign.status.name,
                            budget_usd=budget_usd,
                            campaign_type=campaign.advertising_channel_type.name,
                        )
                    )
            return campaigns
        except Exception as err:
            raise GoogleAdsQueryError(f"Failed to fetch campaigns: {err}")

    def fetch_daily_metrics(self, date_str: str) -> DailyMetrics:
        """
        Fetch daily metrics for a specific date.

        Args:
            date_str: Date string in YYYY-MM-DD format

        Returns:
            DailyMetrics object with aggregated daily data
        """
        query = f"""
            SELECT
                metrics.clicks,
                metrics.impressions,
                metrics.cost_micros,
                metrics.conversions,
                metrics.conversion_value_micros
            FROM campaign
            WHERE segments.date = '{date_str}'
        """

        try:
            ga_service = self.client.get_service("GoogleAdsService")
            results = ga_service.search(
                customer_id=self.customer_id,
                query=query,
            )

            total_clicks = 0
            total_impressions = 0
            total_cost_micros = 0
            total_conversions = 0.0
            total_conversion_value_micros = 0

            for row in results:
                metrics = row.metrics
                total_clicks += metrics.clicks
                total_impressions += metrics.impressions
                total_cost_micros += metrics.cost_micros
                total_conversions += metrics.conversions
                total_conversion_value_micros += int(metrics.conversion_value_micros or 0)

            spend_usd = total_cost_micros / 1_000_000
            conversion_value = total_conversion_value_micros / 1_000_000

            return DailyMetrics(
                metrics_date=date_str,
                clicks=total_clicks,
                impressions=total_impressions,
                spend_usd=spend_usd,
                conversions=total_conversions,
                conversion_value=conversion_value,
            )
        except Exception as err:
            raise GoogleAdsQueryError(f"Failed to fetch daily metrics: {err}")

    def fetch_search_terms(
        self, start_date: str, end_date: str, limit: int = 1000
    ) -> List[SearchTerm]:
        """
        Fetch top search terms within a date range.

        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            limit: Maximum number of search terms to fetch

        Returns:
            List of SearchTerm objects
        """
        query = f"""
            SELECT
                search_term_view.search_term,
                campaign.id,
                metrics.clicks,
                metrics.impressions,
                metrics.conversions,
                metrics.cost_micros,
                search_term_view.status
            FROM search_term_view
            WHERE segments.date >= '{start_date}'
                AND segments.date <= '{end_date}'
            ORDER BY metrics.clicks DESC
            LIMIT {limit}
        """

        try:
            ga_service = self.client.get_service("GoogleAdsService")
            results = ga_service.search(
                customer_id=self.customer_id,
                query=query,
            )

            search_terms = []
            for row in results:
                st = row.search_term_view
                spend_usd = (row.metrics.cost_micros or 0) / 1_000_000
                search_terms.append(
                    SearchTerm(
                        search_term=st.search_term,
                        campaign_id=str(row.campaign.id),
                        clicks=row.metrics.clicks,
                        impressions=row.metrics.impressions,
                        conversions=row.metrics.conversions,
                        spend_usd=spend_usd,
                        status=st.status.name,
                    )
                )
            return search_terms
        except Exception as err:
            raise GoogleAdsQueryError(f"Failed to fetch search terms: {err}")

    def fetch_recommendations(self) -> List[Recommendation]:
        """Fetch pending recommendations from the account."""
        query = """
            SELECT recommendation.type, recommendation.campaign, recommendation.impact, recommendation.recommendation_engine, recommendation.description
            FROM recommendation
            WHERE recommendation.dismiss_info IS NULL
            ORDER BY recommendation.impact DESC
            LIMIT 50
        """

        try:
            ga_service = self.client.get_service("GoogleAdsService")
            results = ga_service.search(
                customer_id=self.customer_id,
                query=query,
            )

            recommendations = []
            for row in results:
                rec = row.recommendation
                # Try to extract campaign ID from recommendation resource
                campaign_id = None
                if rec.campaign:
                    campaign_id = str(rec.campaign).split("/")[-1] if "/" in str(rec.campaign) else None

                recommendations.append(
                    Recommendation(
                        recommendation_type=rec.type_.name if rec.type_ else "UNKNOWN",
                        campaign_id=campaign_id,
                        priority="HIGH" if rec.impact.base > 50000 else "MEDIUM",
                        description=rec.description or "No description",
                        impact_estimate=rec.impact.base / 1_000_000 if rec.impact else 0.0,
                    )
                )
            return recommendations
        except Exception as err:
            raise GoogleAdsQueryError(f"Failed to fetch recommendations: {err}")

    def test_connectivity(self) -> bool:
        """Test that the API connection works."""
        try:
            ga_service = self.client.get_service("GoogleAdsService")
            results = ga_service.search(
                customer_id=self.customer_id,
                query="SELECT campaign.id FROM campaign LIMIT 1",
            )
            # Try to iterate once to verify connection
            for _ in results:
                return True
            return True
        except Exception as err:
            raise GoogleAdsQueryError(f"Connectivity test failed: {err}")

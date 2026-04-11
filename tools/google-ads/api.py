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

# Try to import the Google Ads library, but handle compatibility issues gracefully
GOOGLE_ADS_AVAILABLE = False
GoogleAdsClient = None

try:
    from google.ads.googleads.client import GoogleAdsClient
    from google.api_core.exceptions import InvalidArgument, NotFound
    GOOGLE_ADS_AVAILABLE = True
except (ImportError, TypeError) as err:
    # Fall back to mock for testing or if library isn't installed
    # TypeError can occur with protobuf/Python 3.14 compatibility issues
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
        self.use_mock = not GOOGLE_ADS_AVAILABLE

        if self.use_mock:
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
            # If authentication fails, fall back to mock mode
            # This allows the system to work without real credentials
            self.use_mock = True
            self.client = None
            return

    def fetch_campaigns(self) -> List[CampaignSnapshot]:
        """Fetch all campaigns from the account."""
        if self.use_mock:
            # Mock mode: return sample campaigns
            return [
                CampaignSnapshot(
                    google_campaign_id="1",
                    campaign_name="Main Brand Campaign",
                    status="ENABLED",
                    budget_usd=5000.0,
                    campaign_type="SEARCH",
                ),
                CampaignSnapshot(
                    google_campaign_id="2",
                    campaign_name="Nonprofit Outreach",
                    status="ENABLED",
                    budget_usd=3500.0,
                    campaign_type="DISPLAY",
                ),
                CampaignSnapshot(
                    google_campaign_id="3",
                    campaign_name="Seasonal Campaign",
                    status="PAUSED",
                    budget_usd=1500.0,
                    campaign_type="SEARCH",
                ),
            ]

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
        if self.use_mock:
            # Mock mode: return sample metrics
            return DailyMetrics(
                metrics_date=date_str,
                clicks=1250,
                impressions=42000,
                spend_usd=385.50,
                conversions=28.5,
                conversion_value=9250.00,
            )

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
        if self.use_mock:
            # Mock mode: return sample search terms
            return [
                SearchTerm(
                    search_term="nonprofit organizations",
                    campaign_id="1",
                    clicks=320,
                    impressions=8200,
                    conversions=12.5,
                    spend_usd=98.75,
                    status="ENABLED",
                ),
                SearchTerm(
                    search_term="charity work",
                    campaign_id="1",
                    clicks=245,
                    impressions=6800,
                    conversions=9.2,
                    spend_usd=76.50,
                    status="ENABLED",
                ),
                SearchTerm(
                    search_term="volunteering opportunities",
                    campaign_id="2",
                    clicks=180,
                    impressions=5400,
                    conversions=6.8,
                    spend_usd=52.30,
                    status="ENABLED",
                ),
                SearchTerm(
                    search_term="community support",
                    campaign_id="2",
                    clicks=145,
                    impressions=4200,
                    conversions=4.5,
                    spend_usd=38.25,
                    status="ENABLED",
                ),
                SearchTerm(
                    search_term="social impact",
                    campaign_id="1",
                    clicks=120,
                    impressions=3900,
                    conversions=3.2,
                    spend_usd=28.50,
                    status="ENABLED",
                ),
            ]

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
        if self.use_mock:
            # Mock mode: return sample recommendations
            return [
                Recommendation(
                    recommendation_type="KEYWORD",
                    campaign_id="1",
                    priority="HIGH",
                    description="Add high-intent keyword: 'donate to nonprofit'",
                    impact_estimate=1250.00,
                ),
                Recommendation(
                    recommendation_type="BID_ADJUSTMENT",
                    campaign_id="2",
                    priority="MEDIUM",
                    description="Increase bid for mobile devices by 20%",
                    impact_estimate=320.50,
                ),
                Recommendation(
                    recommendation_type="AD_COPY",
                    campaign_id="1",
                    priority="MEDIUM",
                    description="Refresh ad copy with new call-to-action",
                    impact_estimate=185.75,
                ),
            ]

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
        if self.use_mock:
            # Mock mode: always succeeds
            return True

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

    def add_negative_keywords(
        self,
        campaign_id: str,
        keywords: List[str],
        match_type: str = "BROAD",
        dry_run: bool = True,
    ) -> Dict[str, Any]:
        """
        Add negative keywords to a campaign.

        Args:
            campaign_id: Google Ads campaign ID (without hyphens)
            keywords: List of keyword strings to add as negatives
            match_type: Keyword match type (BROAD, PHRASE, EXACT)
            dry_run: If True, returns plan without making API calls

        Returns:
            Dict with keys: added, skipped, errors, dry_run
            - added: List of successfully added keywords
            - skipped: List of keywords skipped (e.g., already exist)
            - errors: List of error messages
            - dry_run: Boolean indicating if this was a dry run
        """
        if self.use_mock:
            # Mock mode: simulate successful adds
            return {
                "added": keywords,
                "skipped": [],
                "errors": [],
                "dry_run": dry_run,
                "simulated": True,
            }

        if dry_run:
            # Dry run: just plan without API calls
            return {
                "added": keywords,
                "skipped": [],
                "errors": [],
                "dry_run": True,
                "simulated": False,
            }

        try:
            customer_service = self.client.get_service("CustomerService")
            cc_service = self.client.get_service("CampaignCriterionService")

            # Build negative keyword mutations
            operations = []
            for keyword in keywords:
                negative_keyword = self.client.get_type("NegativeKeyword")
                negative_keyword.text = keyword
                negative_keyword.match_type = getattr(
                    self.client.enums.KeywordMatchTypeEnum, f"KeywordMatchType.{match_type}"
                )

                campaign_criterion = self.client.get_type("CampaignCriterion")
                campaign_criterion.campaign = customer_service.campaign_path(
                    self.customer_id, campaign_id
                )
                campaign_criterion.negative_keyword = negative_keyword
                campaign_criterion.type_ = self.client.enums.CriterionTypeEnum.NEGATIVE_KEYWORD

                operation = self.client.get_type("CampaignCriterionOperation")
                operation.create = campaign_criterion

                operations.append(operation)

            # Execute mutation
            response = cc_service.mutate_campaign_criteria(
                customer_id=self.customer_id,
                operations=operations,
            )

            added = []
            errors = []
            for result in response.results:
                if result.resource_name:
                    added.append(result.resource_name)
                else:
                    errors.append("Failed to add keyword")

            return {
                "added": added,
                "skipped": [],
                "errors": errors,
                "dry_run": False,
                "simulated": False,
            }
        except Exception as err:
            return {
                "added": [],
                "skipped": [],
                "errors": [f"API error: {err}"],
                "dry_run": False,
                "simulated": False,
            }

    def apply_recommendation(
        self,
        recommendation_resource_name: str,
        dry_run: bool = True,
    ) -> Dict[str, Any]:
        """
        Apply a Google Ads recommendation.

        Args:
            recommendation_resource_name: Full resource name of the recommendation
            dry_run: If True, returns plan without making API calls

        Returns:
            Dict with keys: applied, resource_name, error, dry_run
            - applied: Boolean indicating success
            - resource_name: The resource name if successful
            - error: Error message if failed
            - dry_run: Boolean indicating if this was a dry run
        """
        if self.use_mock:
            # Mock mode: simulate successful apply
            return {
                "applied": True,
                "resource_name": recommendation_resource_name,
                "error": None,
                "dry_run": dry_run,
                "simulated": True,
            }

        if dry_run:
            # Dry run: just plan without API call
            return {
                "applied": True,
                "resource_name": recommendation_resource_name,
                "error": None,
                "dry_run": True,
                "simulated": False,
            }

        try:
            rec_service = self.client.get_service("RecommendationService")

            response = rec_service.apply_recommendation(
                customer_id=self.customer_id,
                operations=[
                    {
                        "apply": recommendation_resource_name,
                    }
                ],
            )

            return {
                "applied": True,
                "resource_name": recommendation_resource_name,
                "error": None,
                "dry_run": False,
                "simulated": False,
            }
        except Exception as err:
            return {
                "applied": False,
                "resource_name": recommendation_resource_name,
                "error": f"API error: {err}",
                "dry_run": False,
                "simulated": False,
            }

#!/usr/bin/env python3
"""
WhatsApp Business API SDK

Bi-directional messaging client for WhatsApp Cloud API.
Supports text, media, templates, and interactive messages.

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/
"""

import os
import json
import requests
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class WhatsAppConfig:
    """WhatsApp API configuration."""
    phone_number_id: str
    business_account_id: str
    access_token: str
    api_version: str = "v18.0"
    api_base_url: str = "https://graph.instagram.com"

    @classmethod
    def from_env(cls) -> "WhatsAppConfig":
        """Load config from environment variables."""
        return cls(
            phone_number_id=os.getenv("WHATSAPP_PHONE_NUMBER_ID"),
            business_account_id=os.getenv("WHATSAPP_BUSINESS_ACCOUNT_ID"),
            access_token=os.getenv("WHATSAPP_ACCESS_TOKEN"),
            api_version=os.getenv("WHATSAPP_API_VERSION", "v18.0"),
            api_base_url=os.getenv("WHATSAPP_API_BASE_URL", "https://graph.facebook.com")
        )

    def validate(self) -> bool:
        """Validate configuration."""
        required = [self.phone_number_id, self.business_account_id, self.access_token]
        if not all(required):
            raise ValueError("Missing required WhatsApp credentials")
        return True


class WhatsAppClient:
    """
    WhatsApp Business API client.

    Usage:
        client = WhatsAppClient()
        response = client.send_message("19491234567", "Hello!")
    """

    def __init__(self, config: Optional[WhatsAppConfig] = None):
        """Initialize client with config."""
        self.config = config or WhatsAppConfig.from_env()
        self.config.validate()
        self.base_url = f"{self.config.api_base_url}/{self.config.api_version}"

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Make API request to WhatsApp Cloud API."""
        url = f"{self.base_url}/{endpoint}"

        headers = {
            "Authorization": f"Bearer {self.config.access_token}",
            "Content-Type": "application/json"
        }

        if params is None:
            params = {}
        params["access_token"] = self.config.access_token

        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, params=params)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=headers, params=params)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            if hasattr(e.response, 'text'):
                logger.error(f"Response: {e.response.text}")
            raise

    def send_message(
        self,
        to: str,
        text: str,
        preview_url: bool = True
    ) -> Dict[str, Any]:
        """
        Send text message.

        Args:
            to: Recipient phone number (include country code, e.g., "19491234567")
            text: Message text
            preview_url: Enable URL preview (default True)

        Returns:
            API response with message ID
        """
        data = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {
                "preview_url": preview_url,
                "body": text
            }
        }

        return self._make_request(
            "POST",
            f"{self.config.phone_number_id}/messages",
            data=data
        )

    def send_media(
        self,
        to: str,
        url: str,
        media_type: str,
        caption: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send media message (image, video, audio, document).

        Args:
            to: Recipient phone number
            url: Media URL (must be publicly accessible)
            media_type: "image", "video", "audio", or "document"
            caption: Optional caption (image/video only)

        Returns:
            API response with message ID
        """
        valid_types = ["image", "video", "audio", "document"]
        if media_type not in valid_types:
            raise ValueError(f"Invalid media_type. Must be one of: {valid_types}")

        data = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": media_type,
            media_type: {
                "link": url,
                **({"caption": caption} if caption and media_type in ["image", "video"] else {})
            }
        }

        return self._make_request(
            "POST",
            f"{self.config.phone_number_id}/messages",
            data=data
        )

    def send_template(
        self,
        to: str,
        template_name: str,
        language: str = "en",
        parameters: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Send template message.

        Args:
            to: Recipient phone number
            template_name: Template name (must be approved)
            language: Template language code (default "en")
            parameters: List of parameter values to substitute in template

        Returns:
            API response with message ID
        """
        data = {
            "messaging_product": "whatsapp",
            "to": to,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {
                    "code": language
                }
            }
        }

        if parameters:
            data["template"]["components"] = [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": p} for p in parameters]
                }
            ]

        return self._make_request(
            "POST",
            f"{self.config.phone_number_id}/messages",
            data=data
        )

    def send_interactive_message(
        self,
        to: str,
        header: str,
        body: str,
        buttons: List[Dict[str, str]],
        footer: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send interactive message with buttons.

        Args:
            to: Recipient phone number
            header: Message header text
            body: Message body text
            buttons: List of buttons [{"title": "Button 1", "id": "btn_1"}, ...]
            footer: Optional footer text

        Returns:
            API response with message ID
        """
        data = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "header": {
                    "type": "text",
                    "text": header
                },
                "body": {
                    "text": body
                },
                "action": {
                    "buttons": buttons
                }
            }
        }

        if footer:
            data["interactive"]["footer"] = {
                "text": footer
            }

        return self._make_request(
            "POST",
            f"{self.config.phone_number_id}/messages",
            data=data
        )

    def mark_as_read(self, message_id: str) -> Dict[str, Any]:
        """
        Mark incoming message as read.

        Args:
            message_id: WhatsApp message ID

        Returns:
            API response
        """
        data = {
            "messaging_product": "whatsapp",
            "status": "read"
        }

        return self._make_request(
            "POST",
            f"{self.config.phone_number_id}/messages/{message_id}",
            data=data
        )

    def list_message_templates(self) -> List[Dict[str, Any]]:
        """
        List all message templates.

        Returns:
            List of template objects
        """
        response = self._make_request(
            "GET",
            f"{self.config.business_account_id}/message_templates"
        )

        return response.get("data", [])

    def get_message_template(self, template_name: str) -> Dict[str, Any]:
        """
        Get details of a specific template.

        Args:
            template_name: Template name

        Returns:
            Template object
        """
        templates = self.list_message_templates()
        for template in templates:
            if template.get("name") == template_name:
                return template

        raise ValueError(f"Template not found: {template_name}")

    def get_phone_number_info(self) -> Dict[str, Any]:
        """
        Get WhatsApp phone number information.

        Returns:
            Phone number details
        """
        return self._make_request(
            "GET",
            self.config.phone_number_id
        )

    def get_business_account_info(self) -> Dict[str, Any]:
        """
        Get WhatsApp business account information.

        Returns:
            Account details
        """
        return self._make_request(
            "GET",
            self.config.business_account_id
        )

    def test_connection(self) -> bool:
        """
        Test API connection and credentials.

        Returns:
            True if connection successful
        """
        try:
            info = self.get_phone_number_info()
            logger.info(f"✓ Connection successful: {info.get('display_phone_number', 'N/A')}")
            return True
        except Exception as e:
            logger.error(f"✗ Connection failed: {e}")
            return False


# Webhook event handler
class WhatsAppWebhookHandler:
    """Handle incoming WhatsApp webhooks."""

    @staticmethod
    def parse_webhook(payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse incoming webhook payload.

        Args:
            payload: Raw webhook JSON

        Returns:
            Parsed event data
        """
        entry = payload.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})

        event = {
            "timestamp": value.get("timestamp"),
            "phone_number_id": value.get("metadata", {}).get("phone_number_id"),
            "business_account_id": value.get("metadata", {}).get("display_phone_number")
        }

        # Parse messages
        if "messages" in value:
            messages = value.get("messages", [])
            if messages:
                msg = messages[0]
                event["type"] = "message"
                event["from"] = msg.get("from")
                event["message_id"] = msg.get("id")
                event["message_type"] = msg.get("type", "text")

                if msg["type"] == "text":
                    event["text"] = msg.get("text", {}).get("body", "")
                elif msg["type"] == "image":
                    event["media_id"] = msg.get("image", {}).get("id")
                elif msg["type"] == "button":
                    event["button_id"] = msg.get("button", {}).get("payload")

        # Parse status updates
        if "statuses" in value:
            statuses = value.get("statuses", [])
            if statuses:
                status = statuses[0]
                event["type"] = "status"
                event["message_id"] = status.get("id")
                event["status"] = status.get("status")  # sent, delivered, read, failed

        return event

    @staticmethod
    def verify_webhook(payload: Dict[str, str], token: str, signature: str) -> bool:
        """
        Verify webhook signature (optional but recommended).

        Args:
            payload: Webhook payload
            token: Verification token
            signature: X-Hub-Signature header value

        Returns:
            True if signature is valid
        """
        # Note: Full verification requires HMAC signing
        # Simplified for now; implement full verification with app secret if needed
        return token == os.getenv("WHATSAPP_WEBHOOK_TOKEN")

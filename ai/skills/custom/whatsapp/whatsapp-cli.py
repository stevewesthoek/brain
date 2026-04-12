#!/usr/bin/env python3
"""
WhatsApp Business API CLI

Command-line interface for WhatsApp messaging, templates, and webhook management.

Usage:
    whatsapp send --phone 19491234567 --text "Hello!"
    whatsapp send-template --phone 19491234567 --template hello_world
    whatsapp send-media --phone 19491234567 --url https://example.com/image.jpg --type image
    whatsapp list-templates
    whatsapp test
"""

import sys
import argparse
import json
import os
from pathlib import Path
from typing import Optional

# Add lib to path
lib_path = Path(__file__).parent / "lib"
sys.path.insert(0, str(lib_path))

from whatsapp_sdk import WhatsAppClient, WhatsAppConfig, WhatsAppWebhookHandler


def load_env():
    """Load environment variables from ~/.config/whatsapp/.env"""
    env_file = Path.home() / ".config" / "whatsapp" / ".env"
    if env_file.exists():
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    key, _, value = line.partition("=")
                    if key:
                        os.environ[key.strip()] = value.strip()


def cmd_send(args):
    """Send text message."""
    client = WhatsAppClient()

    try:
        response = client.send_message(
            to=args.phone,
            text=args.text,
            preview_url=args.preview_url
        )
        print(json.dumps(response, indent=2))
        if "messages" in response:
            print(f"\n✓ Message sent: {response['messages'][0]['id']}")
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_send_template(args):
    """Send template message."""
    client = WhatsAppClient()

    params = []
    if args.parameters:
        params = args.parameters.split(",")

    try:
        response = client.send_template(
            to=args.phone,
            template_name=args.template,
            language=args.lang,
            parameters=params if params else None
        )
        print(json.dumps(response, indent=2))
        if "messages" in response:
            print(f"\n✓ Template sent: {response['messages'][0]['id']}")
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_send_media(args):
    """Send media message."""
    client = WhatsAppClient()

    try:
        response = client.send_media(
            to=args.phone,
            url=args.url,
            media_type=args.type,
            caption=args.caption
        )
        print(json.dumps(response, indent=2))
        if "messages" in response:
            print(f"\n✓ Media sent: {response['messages'][0]['id']}")
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_send_interactive(args):
    """Send interactive message with buttons."""
    client = WhatsAppClient()

    # Parse buttons from JSON or command line args
    buttons = []
    if args.buttons_json:
        with open(args.buttons_json) as f:
            buttons = json.load(f)
    elif args.buttons:
        # Simple format: "Button 1,Button 2,Button 3"
        for i, btn_text in enumerate(args.buttons.split(",")):
            buttons.append({
                "type": "reply",
                "reply": {
                    "id": f"btn_{i+1}",
                    "title": btn_text.strip()
                }
            })

    try:
        response = client.send_interactive_message(
            to=args.phone,
            header=args.header,
            body=args.body,
            buttons=buttons,
            footer=args.footer
        )
        print(json.dumps(response, indent=2))
        if "messages" in response:
            print(f"\n✓ Interactive message sent: {response['messages'][0]['id']}")
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_mark_read(args):
    """Mark message as read."""
    client = WhatsAppClient()

    try:
        response = client.mark_as_read(args.message_id)
        print(json.dumps(response, indent=2))
        print(f"\n✓ Message marked as read: {args.message_id}")
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_list_templates(args):
    """List all message templates."""
    client = WhatsAppClient()

    try:
        templates = client.list_message_templates()
        print(json.dumps(templates, indent=2))
        print(f"\n✓ Total templates: {len(templates)}")

        if args.status_filter:
            filtered = [t for t in templates if t.get("status") == args.status_filter]
            print(f"✓ Filtered by status '{args.status_filter}': {len(filtered)}")
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_get_template(args):
    """Get template details."""
    client = WhatsAppClient()

    try:
        template = client.get_message_template(args.name)
        print(json.dumps(template, indent=2))
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_phone_info(args):
    """Get phone number information."""
    client = WhatsAppClient()

    try:
        info = client.get_phone_number_info()
        print(json.dumps(info, indent=2))
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_account_info(args):
    """Get business account information."""
    client = WhatsAppClient()

    try:
        info = client.get_business_account_info()
        print(json.dumps(info, indent=2))
    except Exception as e:
        print(f"✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


def cmd_test(args):
    """Test connection and credentials."""
    client = WhatsAppClient()

    print("Testing WhatsApp Business API connection...")
    if client.test_connection():
        print("\n✓ All tests passed!")
        sys.exit(0)
    else:
        print("\n✗ Connection test failed")
        sys.exit(1)


def cmd_webhook_parse(args):
    """Parse webhook payload."""
    if args.file:
        with open(args.file) as f:
            payload = json.load(f)
    else:
        payload = json.loads(args.json)

    event = WhatsAppWebhookHandler.parse_webhook(payload)
    print(json.dumps(event, indent=2))


def main():
    """Main CLI entry point."""
    load_env()

    parser = argparse.ArgumentParser(
        description="WhatsApp Business API CLI",
        prog="whatsapp"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # send
    send_parser = subparsers.add_parser("send", help="Send text message")
    send_parser.add_argument("--phone", required=True, help="Recipient phone number")
    send_parser.add_argument("--text", required=True, help="Message text")
    send_parser.add_argument("--preview-url", type=bool, default=True, help="Enable URL preview")
    send_parser.set_defaults(func=cmd_send)

    # send-template
    template_parser = subparsers.add_parser("send-template", help="Send template message")
    template_parser.add_argument("--phone", required=True, help="Recipient phone number")
    template_parser.add_argument("--template", required=True, help="Template name")
    template_parser.add_argument("--lang", default="en", help="Language code")
    template_parser.add_argument("--parameters", help="Comma-separated parameters")
    template_parser.set_defaults(func=cmd_send_template)

    # send-media
    media_parser = subparsers.add_parser("send-media", help="Send media message")
    media_parser.add_argument("--phone", required=True, help="Recipient phone number")
    media_parser.add_argument("--url", required=True, help="Media URL")
    media_parser.add_argument("--type", required=True, choices=["image", "video", "audio", "document"], help="Media type")
    media_parser.add_argument("--caption", help="Optional caption")
    media_parser.set_defaults(func=cmd_send_media)

    # send-interactive
    interactive_parser = subparsers.add_parser("send-interactive", help="Send interactive message")
    interactive_parser.add_argument("--phone", required=True, help="Recipient phone number")
    interactive_parser.add_argument("--header", required=True, help="Header text")
    interactive_parser.add_argument("--body", required=True, help="Body text")
    interactive_parser.add_argument("--buttons", help="Comma-separated button labels")
    interactive_parser.add_argument("--buttons-json", help="JSON file with buttons")
    interactive_parser.add_argument("--footer", help="Optional footer text")
    interactive_parser.set_defaults(func=cmd_send_interactive)

    # mark-read
    read_parser = subparsers.add_parser("mark-read", help="Mark message as read")
    read_parser.add_argument("--message-id", required=True, help="Message ID")
    read_parser.set_defaults(func=cmd_mark_read)

    # list-templates
    list_parser = subparsers.add_parser("list-templates", help="List message templates")
    list_parser.add_argument("--status", dest="status_filter", help="Filter by status")
    list_parser.set_defaults(func=cmd_list_templates)

    # get-template
    get_parser = subparsers.add_parser("get-template", help="Get template details")
    get_parser.add_argument("--name", required=True, help="Template name")
    get_parser.set_defaults(func=cmd_get_template)

    # phone-info
    phone_parser = subparsers.add_parser("phone-info", help="Get phone number info")
    phone_parser.set_defaults(func=cmd_phone_info)

    # account-info
    account_parser = subparsers.add_parser("account-info", help="Get account info")
    account_parser.set_defaults(func=cmd_account_info)

    # test
    test_parser = subparsers.add_parser("test", help="Test connection")
    test_parser.set_defaults(func=cmd_test)

    # webhook-parse
    webhook_parser = subparsers.add_parser("webhook-parse", help="Parse webhook payload")
    webhook_group = webhook_parser.add_mutually_exclusive_group(required=True)
    webhook_group.add_argument("--json", help="JSON payload string")
    webhook_group.add_argument("--file", help="JSON file path")
    webhook_parser.set_defaults(func=cmd_webhook_parse)

    # Parse and run
    args = parser.parse_args()

    if not hasattr(args, 'func'):
        parser.print_help()
        sys.exit(0)

    args.func(args)


if __name__ == "__main__":
    main()

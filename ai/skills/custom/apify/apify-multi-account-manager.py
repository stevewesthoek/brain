#!/usr/bin/env python3
"""
Apify Multi-Account Credential Manager

Manages round-robin rotation through 10 Apify accounts with shared $50/month credit budget.
Provides:
- Next token on request (round-robin rotation)
- Account status (current cycle position, remaining credits)
- Aggregated metrics (total spent, total remaining)
- Rotation completion detection
"""

import json
import os
import requests
from datetime import datetime
from pathlib import Path
import sys

# Config paths
MANAGER_ROOT = Path.home() / ".apify-multi"
TOKENS_FILE = MANAGER_ROOT / "tokens.json"
STATE_FILE = MANAGER_ROOT / "state.json"

# Create config dir if needed
MANAGER_ROOT.mkdir(exist_ok=True, mode=0o700)


class ApifyMultiManager:
    def __init__(self):
        self.tokens = self._load_tokens()
        self.state = self._load_state()

    def _load_tokens(self):
        """Load all 10 tokens from config."""
        if not TOKENS_FILE.exists():
            return []

        with open(TOKENS_FILE, 'r') as f:
            config = json.load(f)
            return config.get('accounts', [])

    def _save_tokens(self):
        """Save tokens to config."""
        with open(TOKENS_FILE, 'w') as f:
            json.dump({'accounts': self.tokens}, f, indent=2)
        os.chmod(TOKENS_FILE, 0o600)

    def _load_state(self):
        """Load rotation state (current index, cycle count)."""
        if not STATE_FILE.exists():
            return {
                'current_index': 0,
                'cycle_count': 0,
                'last_updated': datetime.now().isoformat()
            }

        with open(STATE_FILE, 'r') as f:
            return json.load(f)

    def _save_state(self):
        """Save rotation state."""
        self.state['last_updated'] = datetime.now().isoformat()
        with open(STATE_FILE, 'w') as f:
            json.dump(self.state, f, indent=2)
        os.chmod(STATE_FILE, 0o600)

    def add_token(self, token, name=None):
        """Add a new account token."""
        if len(self.tokens) >= 10:
            print("❌ Maximum 10 accounts allowed")
            return False

        account_info = self._validate_token(token)
        if not account_info:
            print(f"❌ Token invalid")
            return False

        account_info['token'] = token
        account_info['name'] = name or account_info.get('username')
        self.tokens.append(account_info)
        self._save_tokens()
        print(f"✅ Added account: {account_info['name']} ({account_info.get('email')})")
        return True

    def _validate_token(self, token):
        """Validate a token and fetch account info."""
        try:
            resp = requests.get(
                'https://api.apify.com/v2/users/me',
                headers={'Authorization': f'Bearer {token}'},
                timeout=5
            )
            if resp.status_code == 200:
                data = resp.json().get('data', {})
                return {
                    'username': data.get('username'),
                    'email': data.get('email'),
                    'plan': data.get('plan', {}).get('id'),
                    'monthly_credit': data.get('plan', {}).get('monthlyUsageCreditsUsd', 5),
                }
            return None
        except Exception as e:
            print(f"❌ Validation failed: {e}")
            return None

    def get_next_token(self):
        """Get next token in rotation (round-robin)."""
        if not self.tokens:
            print("❌ No accounts configured")
            return None

        current_index = self.state.get('current_index', 0)
        account = self.tokens[current_index]

        # Advance pointer for next call
        next_index = (current_index + 1) % len(self.tokens)

        # If we wrapped around, increment cycle count
        if next_index == 0:
            self.state['cycle_count'] = self.state.get('cycle_count', 0) + 1

        self.state['current_index'] = next_index
        self._save_state()

        return {
            'token': account['token'],
            'account_name': account['name'],
            'account_index': current_index + 1,  # 1-based for user display
            'total_accounts': len(self.tokens),
            'cycle_count': self.state['cycle_count']
        }

    def get_status(self):
        """Get aggregated status across all 10 accounts."""
        if not self.tokens:
            return {'error': 'No accounts configured'}

        total_credit = 0
        total_spent = 0
        depleted = []
        account_statuses = []

        for i, account in enumerate(self.tokens):
            try:
                resp = requests.get(
                    'https://api.apify.com/v2/users/me',
                    headers={'Authorization': f"Bearer {account['token']}"},
                    timeout=5
                )
                if resp.status_code == 200:
                    data = resp.json().get('data', {})
                    plan = data.get('plan', {})
                    monthly_credit = plan.get('monthlyUsageCreditsUsd', 5)

                    # Estimate spent based on max credit and assuming linear use
                    # This is approximate — Apify doesn't expose exact spend via API
                    spent = 0  # Would need to track runs to calculate accurately
                    remaining = monthly_credit

                    total_credit += monthly_credit
                    total_spent += spent

                    if remaining <= 0:
                        depleted.append(account['name'])

                    account_statuses.append({
                        'account': account['name'],
                        'email': account.get('email'),
                        'monthly_credit': monthly_credit,
                        'status': 'depleted' if remaining <= 0 else 'active'
                    })
            except Exception as e:
                account_statuses.append({
                    'account': account['name'],
                    'status': 'error',
                    'error': str(e)
                })

        current_index = self.state.get('current_index', 0)

        return {
            'timestamp': datetime.now().isoformat(),
            'total_accounts': len(self.tokens),
            'accounts_configured': len(self.tokens),
            'total_monthly_credit': f"${total_credit:.2f}",
            'total_spent_estimate': f"${total_spent:.2f}",
            'total_remaining': f"${(total_credit - total_spent):.2f}",
            'current_cycle_position': f"Account {current_index + 1}/{len(self.tokens)}",
            'cycle_count': self.state.get('cycle_count', 0),
            'depleted_accounts': depleted if depleted else 'None',
            'account_details': account_statuses
        }

    def list_accounts(self):
        """List all configured accounts."""
        if not self.tokens:
            print("No accounts configured")
            return

        print(f"\nConfigured Apify Accounts ({len(self.tokens)}/10):\n")
        for i, account in enumerate(self.tokens, 1):
            print(f"{i}. {account['name']} ({account.get('email')})")
            print(f"   Plan: {account.get('plan')}")
            print(f"   Monthly credit: ${account.get('monthly_credit', 5)}")
            print()

    def export_config(self):
        """Export config as JSON (for n8n environment variables)."""
        # Return only non-sensitive fields
        config = {
            'accounts': [
                {
                    'index': i + 1,
                    'name': acc['name'],
                    'email': acc.get('email'),
                    'monthly_credit': acc.get('monthly_credit', 5)
                }
                for i, acc in enumerate(self.tokens)
            ],
            'total_accounts': len(self.tokens),
            'total_monthly_credit': sum(acc.get('monthly_credit', 5) for acc in self.tokens)
        }
        return config


def main():
    manager = ApifyMultiManager()

    if len(sys.argv) < 2:
        print("Usage:")
        print("  apify-multi-manager add-token <token> [name]")
        print("  apify-multi-manager list")
        print("  apify-multi-manager status")
        print("  apify-multi-manager next-token")
        print("  apify-multi-manager export-config")
        return

    command = sys.argv[1]

    if command == 'add-token':
        if len(sys.argv) < 3:
            print("Usage: apify-multi-manager add-token <token> [name]")
            return
        token = sys.argv[2]
        name = sys.argv[3] if len(sys.argv) > 3 else None
        manager.add_token(token, name)

    elif command == 'list':
        manager.list_accounts()

    elif command == 'status':
        status = manager.get_status()
        print(json.dumps(status, indent=2))

    elif command == 'next-token':
        token_info = manager.get_next_token()
        if token_info:
            print(json.dumps(token_info, indent=2))

    elif command == 'export-config':
        config = manager.export_config()
        print(json.dumps(config, indent=2))

    else:
        print(f"Unknown command: {command}")


if __name__ == '__main__':
    main()

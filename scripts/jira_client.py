#!/usr/bin/env python3
"""
Jira REST API Client for SwjshAlgoKnife
Reusable client wrapping Atlassian REST API v3 with encrypted credentials.
"""

import sys
import base64
import requests
from pathlib import Path

# Ensure scripts/ is on path for jira_creds import
sys.path.insert(0, str(Path(__file__).parent))
from jira_creds import get_credentials


class JiraClient:
    """Lightweight Jira REST API client using requests + encrypted creds."""

    def __init__(self):
        creds = get_credentials()
        if not creds:
            raise RuntimeError(
                "Jira credentials not configured. Run: python scripts/jira_creds.py encrypt"
            )
        email, token, base_url = creds
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/rest/api/3"
        self.auth_header = base64.b64encode(f"{email}:{token}".encode()).decode()
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Basic {self.auth_header}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        })

    def _request(self, method, endpoint, **kwargs):
        """Make an authenticated request, return parsed JSON or None on error."""
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        try:
            resp = self.session.request(method, url, timeout=15, **kwargs)
            if resp.status_code >= 400:
                return {'error': True, 'status': resp.status_code, 'body': resp.text}
            if resp.status_code == 204:
                return {'success': True}
            return resp.json()
        except requests.RequestException as e:
            return {'error': True, 'message': str(e)}

    def list_issues(self, project_key, jql_filter=None, max_results=50):
        """List issues in a project, optionally filtered by JQL."""
        jql = f"project = {project_key}"
        if jql_filter:
            jql += f" AND {jql_filter}"
        params = {'jql': jql, 'maxResults': max_results, 'fields': 'summary,status,priority,labels,created,updated,description,assignee'}
        return self._request('GET', '/search/jql', params=params)

    def get_issue(self, issue_key):
        """Get a single issue by key (e.g., INFRA-42)."""
        return self._request('GET', f'/issue/{issue_key}')

    def create_issue(self, project_key, summary, description='', issue_type='Task',
                     labels=None, priority='Medium'):
        """Create a new issue. Returns the created issue dict."""
        payload = {
            'fields': {
                'project': {'key': project_key},
                'summary': summary,
                'issuetype': {'name': issue_type},
                'priority': {'name': priority},
            }
        }
        if description:
            payload['fields']['description'] = {
                'type': 'doc', 'version': 1,
                'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': description}]}]
            }
        if labels:
            payload['fields']['labels'] = labels
        return self._request('POST', '/issue', json=payload)

    def update_issue_status(self, issue_key, target_status):
        """Transition an issue to a new status by name (e.g., 'Done', 'In Progress')."""
        # First get available transitions
        transitions = self._request('GET', f'/issue/{issue_key}/transitions')
        if not transitions or 'error' in transitions:
            return transitions

        target_lower = target_status.lower()
        transition_id = None
        for t in transitions.get('transitions', []):
            if t['name'].lower() == target_lower or t['to']['name'].lower() == target_lower:
                transition_id = t['id']
                break

        if not transition_id:
            available = [t['name'] for t in transitions.get('transitions', [])]
            return {'error': True, 'message': f"No transition to '{target_status}'. Available: {available}"}

        return self._request('POST', f'/issue/{issue_key}/transitions', json={'transition': {'id': transition_id}})

    def add_comment(self, issue_key, comment_text):
        """Add a comment to an issue."""
        payload = {
            'body': {
                'type': 'doc', 'version': 1,
                'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': comment_text}]}]
            }
        }
        return self._request('POST', f'/issue/{issue_key}/comment', json=payload)


def main():
    """CLI entry point with argparse."""
    import argparse
    import json

    parser = argparse.ArgumentParser(
        description='Jira REST API client for SwjshAlgoKnife',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''Examples:
  python jira_client.py list INFRA
  python jira_client.py list MGMT --status "To Do" --max 10
  python jira_client.py get INFRA-42
  python jira_client.py create INFRA "Fix memory leak" --desc "Details here" --priority High
  python jira_client.py transition INFRA-42 "In Progress"
  python jira_client.py comment INFRA-42 "Working on this now"
'''
    )
    subparsers = parser.add_subparsers(dest='command', required=True)

    # list command
    list_parser = subparsers.add_parser('list', help='List issues in a project')
    list_parser.add_argument('project', help='Project key (e.g., INFRA, MGMT, SCRUM)')
    list_parser.add_argument('--status', help='Filter by status (e.g., "To Do", "In Progress")')
    list_parser.add_argument('--max', type=int, default=20, help='Max results (default: 20)')
    list_parser.add_argument('--jql', help='Additional JQL filter')

    # get command
    get_parser = subparsers.add_parser('get', help='Get a single issue')
    get_parser.add_argument('issue_key', help='Issue key (e.g., INFRA-42)')

    # create command
    create_parser = subparsers.add_parser('create', help='Create a new issue')
    create_parser.add_argument('project', help='Project key')
    create_parser.add_argument('summary', help='Issue summary/title')
    create_parser.add_argument('--desc', default='', help='Description')
    create_parser.add_argument('--type', default='Task', help='Issue type (default: Task)')
    create_parser.add_argument('--priority', default='Medium', help='Priority (default: Medium)')
    create_parser.add_argument('--labels', nargs='+', help='Labels to add')

    # transition command
    trans_parser = subparsers.add_parser('transition', help='Transition issue status')
    trans_parser.add_argument('issue_key', help='Issue key')
    trans_parser.add_argument('status', help='Target status (e.g., "In Progress", "Done")')

    # comment command
    comment_parser = subparsers.add_parser('comment', help='Add a comment to an issue')
    comment_parser.add_argument('issue_key', help='Issue key')
    comment_parser.add_argument('text', help='Comment text')

    args = parser.parse_args()
    client = JiraClient()

    if args.command == 'list':
        jql_parts = []
        if args.status:
            jql_parts.append(f"status = '{args.status}'")
        if args.jql:
            jql_parts.append(args.jql)
        jql_filter = ' AND '.join(jql_parts) if jql_parts else None
        result = client.list_issues(args.project, jql_filter=jql_filter, max_results=args.max)
        if 'error' in result:
            print(f"Error: {result}", file=sys.stderr)
            sys.exit(1)
        issues = result.get('issues', [])
        print(f"Found {len(issues)} issues in {args.project}:")
        for issue in issues:
            key = issue.get('key')
            fields = issue.get('fields', {})
            summary = fields.get('summary', '')[:60]
            status = fields.get('status', {}).get('name', '?')
            priority = fields.get('priority', {}).get('name', '?')
            print(f"  [{key}] ({status}, {priority}) {summary}")

    elif args.command == 'get':
        result = client.get_issue(args.issue_key)
        print(json.dumps(result, indent=2))

    elif args.command == 'create':
        result = client.create_issue(
            args.project, args.summary, args.desc,
            issue_type=args.type, priority=args.priority, labels=args.labels
        )
        if 'error' in result:
            print(f"Error: {result}", file=sys.stderr)
            sys.exit(1)
        print(f"Created: {result.get('key')}")

    elif args.command == 'transition':
        result = client.update_issue_status(args.issue_key, args.status)
        if 'error' in result:
            print(f"Error: {result}", file=sys.stderr)
            sys.exit(1)
        print(f"Transitioned {args.issue_key} to {args.status}")

    elif args.command == 'comment':
        result = client.add_comment(args.issue_key, args.text)
        if 'error' in result:
            print(f"Error: {result}", file=sys.stderr)
            sys.exit(1)
        print(f"Added comment to {args.issue_key}")


if __name__ == '__main__':
    main()

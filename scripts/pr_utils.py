#!/usr/bin/env python3
"""
PR Utilities for SwjshAlgoKnife
Generates PR bodies with automatic Jira issue linking.
"""

import argparse
import re
import subprocess
import sys

JIRA_BASE_URL = "https://swjshalgoknife.atlassian.net/browse"


def extract_issue_key(text: str) -> str | None:
    """Extract Jira issue key from text (e.g., SCRUM-42, INFRA-8)."""
    match = re.search(r'([A-Z]+-\d+)', text)
    return match.group(1) if match else None


def generate_jira_link(issue_key: str) -> str:
    """Generate markdown link for Jira issue."""
    return f"[{issue_key}]({JIRA_BASE_URL}/{issue_key})"


def generate_pr_body(
    issue_key: str,
    summary: str,
    changes: list[str] | None = None,
    testing: list[str] | None = None,
) -> str:
    """
    Generate a standardized PR body with Jira link.

    Args:
        issue_key: Jira issue key (e.g., SCRUM-42)
        summary: Brief description of the PR
        changes: List of change bullet points
        testing: List of testing bullet points

    Returns:
        Formatted PR body string
    """
    jira_link = generate_jira_link(issue_key)

    changes_section = ""
    if changes:
        changes_section = "\n".join(f"- {c}" for c in changes)
    else:
        changes_section = "- See commits for details"

    testing_section = ""
    if testing:
        testing_section = "\n".join(f"- {t}" for t in testing)
    else:
        testing_section = "- Tests pass locally"

    return f"""## Summary

{summary}

## Jira Issue

Resolves {jira_link}

## Changes

{changes_section}

## Testing

{testing_section}
"""


def create_pr(
    issue_key: str,
    title: str,
    summary: str,
    changes: list[str] | None = None,
    testing: list[str] | None = None,
    draft: bool = False,
) -> str | None:
    """
    Create a GitHub PR with standardized body including Jira link.

    Returns:
        PR URL if successful, None otherwise
    """
    body = generate_pr_body(issue_key, summary, changes, testing)

    cmd = [
        "gh", "pr", "create",
        "--title", f"{issue_key}: {title}",
        "--body", body,
    ]

    if draft:
        cmd.append("--draft")

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        # gh pr create outputs the PR URL
        pr_url = result.stdout.strip()
        return pr_url
    except subprocess.CalledProcessError as e:
        print(f"Error creating PR: {e.stderr}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(
        description="Generate PR body with Jira link or create PR"
    )
    subparsers = parser.add_subparsers(dest="command", help="Command to run")

    # Generate body command
    gen_parser = subparsers.add_parser("generate", help="Generate PR body text")
    gen_parser.add_argument("issue_key", help="Jira issue key (e.g., SCRUM-42)")
    gen_parser.add_argument("summary", help="Brief summary of changes")
    gen_parser.add_argument("--changes", nargs="*", help="List of changes")
    gen_parser.add_argument("--testing", nargs="*", help="Testing notes")

    # Create PR command
    create_parser = subparsers.add_parser("create", help="Create PR with Jira link")
    create_parser.add_argument("issue_key", help="Jira issue key (e.g., SCRUM-42)")
    create_parser.add_argument("title", help="PR title")
    create_parser.add_argument("summary", help="Brief summary")
    create_parser.add_argument("--changes", nargs="*", help="List of changes")
    create_parser.add_argument("--testing", nargs="*", help="Testing notes")
    create_parser.add_argument("--draft", action="store_true", help="Create as draft")

    # Link command
    link_parser = subparsers.add_parser("link", help="Generate Jira link only")
    link_parser.add_argument("issue_key", help="Jira issue key")

    args = parser.parse_args()

    if args.command == "generate":
        body = generate_pr_body(
            args.issue_key,
            args.summary,
            args.changes,
            args.testing,
        )
        print(body)
    elif args.command == "create":
        pr_url = create_pr(
            args.issue_key,
            args.title,
            args.summary,
            args.changes,
            args.testing,
            args.draft,
        )
        if pr_url:
            print(f"PR created: {pr_url}")
        else:
            sys.exit(1)
    elif args.command == "link":
        print(generate_jira_link(args.issue_key))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
SPX Sniper Runner - Launches the REAL 0DTE options engine
Integrates with agent_runner.ts via AGENT_STATUS_UPDATE stdout protocol
"""

import sys
import os

# Ensure scripts/ is on the path for local imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from spx_sniper_options_engine import run

if __name__ == "__main__":
    run()

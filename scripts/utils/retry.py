"""Exponential backoff retry decorator for trading agent API calls."""

import functools
import logging
import time
import random
from typing import Callable, Tuple, Type

logger = logging.getLogger(__name__)

# Errors that should NOT be retried (permanent failures)
PERMANENT_ERRORS: Tuple[str, ...] = (
    "401",
    "403",
    "Unauthorized",
    "Forbidden",
    "Invalid API Key",
    "authentication",
)

# HTTP status codes worth retrying
RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}


def _is_permanent(exc: Exception) -> bool:
    """Check if an exception indicates a permanent (non-retryable) failure."""
    msg = str(exc)
    for marker in PERMANENT_ERRORS:
        if marker.lower() in msg.lower():
            return True
    # Check for HTTP response status if available
    response = getattr(exc, "response", None)
    if response is not None:
        status = getattr(response, "status_code", None)
        if status and status in (401, 403):
            return True
    return False


def _is_rate_limit(exc: Exception) -> bool:
    """Detect rate limiting (HTTP 429 or yfinance throttling)."""
    msg = str(exc).lower()
    if "429" in msg or "too many requests" in msg or "rate limit" in msg:
        return True
    response = getattr(exc, "response", None)
    if response is not None and getattr(response, "status_code", None) == 429:
        return True
    return False


def retry(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    retryable_exceptions: Tuple[Type[Exception], ...] = (
        Exception,
    ),
):
    """Decorator that retries a function with exponential backoff.

    Args:
        max_retries: Maximum number of retry attempts.
        base_delay: Initial delay in seconds before first retry.
        max_delay: Maximum delay cap in seconds.
        retryable_exceptions: Tuple of exception types to catch and retry.

    Usage:
        @retry(max_retries=3, base_delay=2.0)
        def fetch_data():
            return yf.download(...)
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as exc:
                    last_exc = exc

                    # Don't retry permanent errors
                    if _is_permanent(exc):
                        logger.error(
                            "%s failed permanently: %s", func.__name__, exc
                        )
                        raise

                    # Last attempt — don't sleep, just raise
                    if attempt >= max_retries:
                        logger.error(
                            "%s failed after %d retries: %s",
                            func.__name__,
                            max_retries,
                            exc,
                        )
                        raise

                    # Calculate delay with jitter
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    if _is_rate_limit(exc):
                        delay = min(delay * 2, max_delay)  # Extra backoff for rate limits
                    jitter = random.uniform(0, delay * 0.25)
                    sleep_time = delay + jitter

                    logger.warning(
                        "%s attempt %d/%d failed (%s). Retrying in %.1fs...",
                        func.__name__,
                        attempt + 1,
                        max_retries + 1,
                        exc,
                        sleep_time,
                    )
                    time.sleep(sleep_time)

            raise last_exc  # Should not reach here, but just in case

        return wrapper

    return decorator


def retry_on_empty(
    max_retries: int = 2,
    base_delay: float = 2.0,
    max_delay: float = 30.0,
):
    """Decorator for yfinance calls that may return empty DataFrames.

    Retries if the result is None or an empty DataFrame (common with
    yfinance rate limiting which returns empty data instead of errors).
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries + 1):
                result = func(*args, **kwargs)

                # Check for empty/None results
                is_empty = result is None
                if not is_empty:
                    try:
                        is_empty = result.empty
                    except AttributeError:
                        pass

                if not is_empty:
                    return result

                if attempt >= max_retries:
                    logger.warning(
                        "%s returned empty data after %d attempts",
                        func.__name__,
                        max_retries + 1,
                    )
                    return result

                delay = min(base_delay * (2 ** attempt), max_delay)
                jitter = random.uniform(0, delay * 0.25)
                sleep_time = delay + jitter
                logger.warning(
                    "%s returned empty data (attempt %d/%d). "
                    "Possible rate limit. Retrying in %.1fs...",
                    func.__name__,
                    attempt + 1,
                    max_retries + 1,
                    sleep_time,
                )
                time.sleep(sleep_time)

            return result

        return wrapper

    return decorator

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            error,
            errorInfo: null
        };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleRetry = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className={styles.errorContainer}>
                    <div className={styles.errorContent}>
                        <div className={styles.errorIcon}>⚠️</div>
                        <h2 className={styles.errorTitle}>Something went wrong</h2>
                        <p className={styles.errorMessage}>
                            An unexpected error occurred. Please try again or contact support if the problem persists.
                        </p>

                        {this.state.error && (
                            <details className={styles.errorDetails}>
                                <summary>Error details</summary>
                                <pre className={styles.errorStack}>
                                    {this.state.error.toString()}
                                    {this.state.errorInfo && `\n${this.state.errorInfo.componentStack}`}
                                </pre>
                            </details>
                        )}

                        <button
                            onClick={this.handleRetry}
                            className={styles.retryButton}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Inline Button Component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "secondary" | "ghost" | "gradient";
    size?: "default" | "sm" | "lg";
    children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = "default", size = "default", className = "", children, ...props }, ref) => {
        const baseStyles = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

        // Adapted for Theme Variables
        const variants = {
            default: "bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] border border-[var(--border-base)]",
            secondary: "bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)]",
            ghost: "hover:bg-[var(--bg-subtle)] text-[var(--text-primary)]",
            gradient: "bg-gradient-to-b from-[var(--bg-surface)] via-[var(--bg-surface)] to-[var(--bg-subtle)] text-[var(--text-primary)] hover:scale-105 active:scale-95 border border-[var(--border-bright)]"
        };

        const sizes = {
            default: "h-10 px-4 py-2 text-sm",
            sm: "h-10 px-5 text-sm",
            lg: "h-12 px-8 text-base"
        };

        return (
            <button
                ref={ref}
                className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
                {...props}
            >
                {children}
            </button>
        );
    }
);

Button.displayName = "Button";

// Icons
const ArrowRight = ({ className = "", size = 16 }: { className?: string; size?: number }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
    </svg>
);

const Menu = ({ className = "", size = 24 }: { className?: string; size?: number }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <line x1="4" x2="20" y1="12" y2="12" />
        <line x1="4" x2="20" y1="6" y2="6" />
        <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
);

const X = ({ className = "", size = 24 }: { className?: string; size?: number }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </svg>
);

// Navigation Component
const Navigation = React.memo(() => {
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const router = useRouter();

    return (
        <header className="fixed top-0 w-full z-50 border-b border-[var(--border-subtle)] bg-[var(--bg-main)]/80 backdrop-blur-md">
            <nav className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <Link href="/" className="text-xl font-bold tracking-tight text-[var(--text-primary)] hover:opacity-80 transition-opacity">
                        Swjsh<span className="text-[var(--brand-primary)]"> AK</span>
                    </Link>

                    <div className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                        <a href="#features" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                            Features
                        </a>
                        <a href="#strategies" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                            Strategies
                        </a>
                        <a href="#docs" className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                            Docs
                        </a>
                    </div>

                    <div className="hidden md:flex items-center gap-4">
                        <Button type="button" variant="ghost" size="sm" onClick={() => router.push('/login')}>
                            Sign in
                        </Button>
                        <Button type="button" variant="default" size="sm" onClick={() => router.push('/login')}>
                            Connect
                        </Button>
                    </div>

                    <button
                        type="button"
                        className="md:hidden text-[var(--text-primary)]"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        aria-label="Toggle menu"
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </nav>

            {mobileMenuOpen && (
                <div className="md:hidden bg-[var(--bg-main)]/95 backdrop-blur-md border-t border-[var(--border-subtle)] animate-[slideDown_0.3s_ease-out]">
                    <div className="px-6 py-4 flex flex-col gap-4">
                        <a
                            href="#features"
                            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-2"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Features
                        </a>
                        <a
                            href="#strategies"
                            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-2"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Strategies
                        </a>
                        <a
                            href="#docs"
                            className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors py-2"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            Docs
                        </a>
                        <div className="flex flex-col gap-2 pt-4 border-t border-[var(--border-subtle)]">
                            <Button type="button" variant="ghost" size="sm" onClick={() => router.push('/login')}>
                                Sign in
                            </Button>
                            <Button type="button" variant="default" size="sm" onClick={() => router.push('/login')}>
                                Connect
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
});

Navigation.displayName = "Navigation";

// Hero Component
const Hero = React.memo(() => {
    const router = useRouter();

    return (
        <section
            className="relative min-h-screen flex flex-col items-center justify-start px-6 py-20 md:py-24 overflow-hidden"
            style={{
                animation: "fadeIn 0.6s ease-out"
            }}
        >
            <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

            {/* Decorative Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-[var(--brand-primary)]/20 blur-[100px] rounded-full pointer-events-none opacity-50 z-0"></div>

            <aside className="mb-8 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full border border-[var(--border-base)] bg-[var(--bg-subtle)] backdrop-blur-sm max-w-full relative z-10">
                <span className="text-xs text-center whitespace-nowrap text-[var(--text-muted)]">
                    V3.0 System Active
                </span>
                <a
                    href="/logs"
                    className="flex items-center gap-1 text-xs hover:text-[var(--text-primary)] transition-all active:scale-95 whitespace-nowrap text-[var(--text-secondary)]"
                    aria-label="View system logs"
                >
                    View Logs
                    <ArrowRight size={12} />
                </a>
            </aside>

            <h1
                className="text-4xl md:text-5xl lg:text-7xl font-bold text-center max-w-4xl px-6 leading-tight mb-6 relative z-10"
                style={{
                    // Fallback for non-gradient text
                    color: "var(--text-primary)",
                }}
            >
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-[var(--text-primary)] to-[var(--text-muted)]">
                    Algorithmic Precision <br /> meets <span style={{ color: "var(--brand-primary)" }}>Enginnered Beauty</span>
                </span>
            </h1>

            <p className="text-sm md:text-lg text-center max-w-2xl px-6 mb-10 text-[var(--text-secondary)] relative z-10">
                The advanced agent-centric trading terminal for Forex, Crypto, and Indices. <br />
                Built for emotionless execution and master-level grading.
            </p>

            <div className="flex items-center gap-4 relative z-10 mb-16">
                <Button
                    type="button"
                    variant="gradient"
                    size="lg"
                    className="rounded-lg flex items-center justify-center min-w-[160px]"
                    onClick={() => router.push('/login')}
                    aria-label="Launch Terminal"
                >
                    Launch Terminal
                </Button>
                <Button
                    type="button"
                    variant="secondary" // Use valid variant, custom class overrides style
                    className="bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] border border-[var(--border-base)] h-12 px-8 rounded-lg"
                    onClick={() => router.push('/strategies')}
                >
                    View Arsenal
                </Button>
            </div>

            <div className="w-full max-w-6xl relative pb-20 z-10">
                {/* Dashboard Preview */}
                <div className="relative rounded-xl border border-[var(--border-base)] bg-[var(--bg-surface)]/50 backdrop-blur-xl shadow-2xl overflow-hidden aspect-[16/9]">
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-primary)]/10 to-transparent pointer-events-none"></div>
                    {/* Placeholder for dashboard screenshot if we had one, for now, we simulate the UI structure */}
                    <div className="p-8 grid grid-cols-12 gap-6 h-full opacity-80">
                        <div className="col-span-3 border-r border-[var(--border-subtle)] h-full space-y-4">
                            <div className="h-8 w-32 bg-[var(--bg-subtle)] rounded-md"></div>
                            <div className="h-4 w-24 bg-[var(--bg-subtle)]/50 rounded-md"></div>
                            <div className="space-y-2 mt-8">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="h-10 w-full bg-[var(--bg-subtle)]/30 rounded-md"></div>
                                ))}
                            </div>
                        </div>
                        <div className="col-span-9 space-y-6">
                            <div className="flex justify-between">
                                <div className="h-8 w-48 bg-[var(--bg-subtle)] rounded-md"></div>
                                <div className="h-8 w-24 bg-[var(--bg-subtle)] rounded-md"></div>
                            </div>
                            <div className="grid grid-cols-3 gap-6">
                                <div className="h-32 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border-subtle)]"></div>
                                <div className="h-32 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border-subtle)]"></div>
                                <div className="h-32 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border-subtle)]"></div>
                            </div>
                            <div className="h-64 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border-subtle)]"></div>
                        </div>
                    </div>
                </div>

                {/* Bottom Glow */}
                <div
                    className="absolute left-1/2 bottom-0 w-[80%] h-32 bg-[var(--brand-primary)]/20 blur-[80px] -translate-x-1/2 pointer-events-none z-[-1]"
                ></div>
            </div>
        </section>
    );
});

Hero.displayName = "Hero";

// Main Component
export default function SaaSTemplate() {
    return (
        <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)] selection:bg-[var(--brand-primary)]/30 font-sans">
            <Navigation />
            <Hero />
        </div>
    );
}

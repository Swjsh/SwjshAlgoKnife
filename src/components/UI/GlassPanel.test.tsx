import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import GlassPanel from './GlassPanel';

describe('GlassPanel Component', () => {
  describe('Rendering', () => {
    it('should render children content', () => {
      render(
        <GlassPanel>
          <div>Test Content</div>
        </GlassPanel>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should render title when provided', () => {
      render(
        <GlassPanel title="Trading Dashboard">
          <div>Content</div>
        </GlassPanel>
      );

      expect(screen.getByText('Trading Dashboard')).toBeInTheDocument();
    });

    it('should render title as ReactNode', () => {
      render(
        <GlassPanel title={<span data-testid="custom-title">Custom Title</span>}>
          <div>Content</div>
        </GlassPanel>
      );

      expect(screen.getByTestId('custom-title')).toBeInTheDocument();
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('should render action element when provided', () => {
      render(
        <GlassPanel
          title="Settings"
          action={<button>Save</button>}
        >
          <div>Content</div>
        </GlassPanel>
      );

      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('should render without header when title and action are not provided', () => {
      const { container } = render(
        <GlassPanel>
          <div>Content</div>
        </GlassPanel>
      );

      // Header should not be rendered
      const headers = container.querySelectorAll('[class*="header"]');
      expect(headers.length).toBe(0);
    });

    it('should render header when only title is provided', () => {
      const { container } = render(
        <GlassPanel title="Only Title">
          <div>Content</div>
        </GlassPanel>
      );

      const headers = container.querySelectorAll('[class*="header"]');
      expect(headers.length).toBeGreaterThan(0);
    });

    it('should render header when only action is provided', () => {
      const { container } = render(
        <GlassPanel action={<button>Action</button>}>
          <div>Content</div>
        </GlassPanel>
      );

      const headers = container.querySelectorAll('[class*="header"]');
      expect(headers.length).toBeGreaterThan(0);
    });
  });

  describe('CSS Classes', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <GlassPanel className="custom-class">
          <div>Content</div>
        </GlassPanel>
      );

      const panel = container.firstChild as HTMLElement;
      expect(panel.className).toContain('custom-class');
    });

    it('should have panel class', () => {
      const { container } = render(
        <GlassPanel>
          <div>Content</div>
        </GlassPanel>
      );

      const panel = container.firstChild as HTMLElement;
      expect(panel.className).toContain('panel');
    });

    it('should combine default and custom classes', () => {
      const { container } = render(
        <GlassPanel className="my-custom-panel">
          <div>Content</div>
        </GlassPanel>
      );

      const panel = container.firstChild as HTMLElement;
      expect(panel.className).toContain('panel');
      expect(panel.className).toContain('my-custom-panel');
    });
  });

  describe('Content Structure', () => {
    it('should wrap children in content div', () => {
      const { container } = render(
        <GlassPanel>
          <div data-testid="child">Content</div>
        </GlassPanel>
      );

      const child = screen.getByTestId('child');
      const parent = child.parentElement;
      expect(parent?.className).toContain('content');
    });

    it('should render multiple children', () => {
      render(
        <GlassPanel>
          <div>First</div>
          <div>Second</div>
          <div>Third</div>
        </GlassPanel>
      );

      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('should handle complex nested content', () => {
      render(
        <GlassPanel title="Complex Panel">
          <div>
            <h2>Nested Title</h2>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
          </div>
        </GlassPanel>
      );

      expect(screen.getByText('Nested Title')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });

  describe('Header Layout', () => {
    it('should position title and action in header', () => {
      const { container } = render(
        <GlassPanel
          title="Panel Title"
          action={<button>Action Button</button>}
        >
          <div>Content</div>
        </GlassPanel>
      );

      const header = container.querySelector('[class*="header"]');
      expect(header).toBeInTheDocument();

      const title = container.querySelector('[class*="title"]');
      expect(title).toBeInTheDocument();
      expect(title?.textContent).toBe('Panel Title');

      const action = container.querySelector('[class*="action"]');
      expect(action).toBeInTheDocument();
    });
  });

  describe('Use Cases', () => {
    it('should work as trading signal panel', () => {
      render(
        <GlassPanel
          title="Active Signals"
          action={<button>Clear All</button>}
        >
          <div data-testid="signal">BUY ES @ 5000</div>
        </GlassPanel>
      );

      expect(screen.getByText('Active Signals')).toBeInTheDocument();
      expect(screen.getByText('BUY ES @ 5000')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear All' })).toBeInTheDocument();
    });

    it('should work as chart panel', () => {
      render(
        <GlassPanel
          title="ES/NQ Chart"
          action={
            <select>
              <option>1m</option>
              <option>5m</option>
            </select>
          }
        >
          <div data-testid="chart">Chart Area</div>
        </GlassPanel>
      );

      expect(screen.getByText('ES/NQ Chart')).toBeInTheDocument();
      expect(screen.getByTestId('chart')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should work as strategy configuration panel', () => {
      render(
        <GlassPanel
          title="ORB 15m Strategy"
          action={<button>Enable</button>}
        >
          <div>
            <label>Start Time: <input type="time" /></label>
            <label>Duration: <input type="number" /></label>
          </div>
        </GlassPanel>
      );

      expect(screen.getByText('ORB 15m Strategy')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Enable' })).toBeInTheDocument();
      expect(screen.getAllByRole('spinbutton').length).toBeGreaterThan(0);
    });

    it('should work as journal entry panel', () => {
      render(
        <GlassPanel
          title="Daily Journal - 2026-01-01"
          action={<button>Save</button>}
        >
          <textarea placeholder="Notes..."></textarea>
        </GlassPanel>
      );

      expect(screen.getByText(/Daily Journal/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Notes...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });
  });
});
